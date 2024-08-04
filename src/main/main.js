const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const storage = require('electron-json-storage');
const { startTracking, stopTracking, getTrackingStatus, timeTrackerEmitter } = require('./mainTimeTracker');
const os = require('os');
const { getTimeEntries, testConnection } = require('../utils/supabaseClient');
const AutoLaunch = require('auto-launch');

let mainWindow, loginWindow, tray;
let isTracking = false;

if (process.platform === 'win32') {
  app.setAppUserModelId("Softylus Time Tracker");
}

// Set up auto-launch
let autoLauncher = new AutoLaunch({
  name: "Softylus Time Tracker",
  path: app.getPath('exe'),
});

autoLauncher.isEnabled().then((isEnabled) => {
  if (!isEnabled) autoLauncher.enable();
}).catch((err) => {
  console.error('Failed to enable auto-launch:', err);
});



function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 400,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    frame: false,
    title: 'Softylus Time Tracker - Login'
  });

  loginWindow.loadFile('src/renderer/login.html');
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#000000',
    title: 'Softylus Time Tracker',
    show: true,
    icon: path.join(__dirname, 'favicon.ico') // Add this line

  });

  mainWindow.loadFile('src/renderer/index.html');
  createTray();

  storage.get('userData', (error, data) => {
    if (!error && data && data.email) {
      if (!getTrackingStatus()) {
        startTracking(data.email);
        mainWindow.webContents.send('tracking-started');
      }
    }
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'app icon', process.platform === 'win32' ? 'softylus.ico' : 'softylus.svg');
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    {
      label: 'Quit', click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Softylus Time Tracker');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });

  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, '..', 'app icon', 'softylus.svg'));
  }
}

async function calculateTotalTime(userId, startDate, endDate) {
  console.log(`Calculating total time for user ${userId} from ${startDate} to ${endDate}`);
  try {
    const entries = await getTimeEntries(userId, startDate, endDate);
    console.log(`Retrieved ${entries.length} time entries`);

    let totalMilliseconds = 0;

    entries.forEach(entry => {
      const start = new Date(entry.start_time);
      const end = new Date(entry.end_time);
      const duration = end - start;
      totalMilliseconds += duration;
      console.log(`Entry: ${start.toISOString()} to ${end.toISOString()}, duration: ${duration}ms`);
    });

    const totalHours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
    const totalMinutes = Math.floor((totalMilliseconds % (1000 * 60 * 60)) / (1000 * 60));

    console.log(`Total time calculated: ${totalHours}h ${totalMinutes}m`);
    return { hours: totalHours, minutes: totalMinutes };
  } catch (error) {
    console.error('Error calculating total time:', error);
    return { hours: 0, minutes: 0 };
  }
}

app.whenReady().then(() => {
  testConnection();
  storage.get('userData', (error, data) => {
    if (error || !data || !data.email) {
      createLoginWindow();
    } else {
      createMainWindow();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      storage.get('userData', (error, data) => {
        if (!error && data && data.email) {
          createMainWindow();
        } else {
          createLoginWindow();
        }
      });
    }
  });
});

// IPC Handlers and Event Listeners
timeTrackerEmitter.on('screenshot-taken', (filePath) => {
  console.log(`Screenshot taken: ${filePath}`);
  if (mainWindow) {
    mainWindow.webContents.send('screenshot-taken', filePath);
  }
});

ipcMain.on('login-success', (event, user) => {
  storage.set('userData', { email: user.email }, (error) => {
    if (error) console.error('Failed to save user data:', error);
    if (loginWindow) loginWindow.close();
    createMainWindow();
    if (!getTrackingStatus()) {
      startTracking(user.email);
    }
  });
});

ipcMain.on('logout', () => {
  storage.remove('userData', (error) => {
    if (error) console.error('Failed to clear user data:', error);
    if (mainWindow) mainWindow.close();
    createLoginWindow();
  });
});

ipcMain.on('get-user-email', (event) => {
  storage.get('userData', (error, data) => {
    event.reply('user-email', error ? null : (data.email || null));
  });
});

ipcMain.on('start-tracking', (event, userId) => {
  if (!getTrackingStatus()) {
    startTracking(userId);
  }
});

ipcMain.on('stop-tracking', (event, userId) => {
  if (getTrackingStatus()) {
    stopTracking(userId);
  }
});

ipcMain.on('get-tracking-status', (event) => {
  event.reply('tracking-status', getTrackingStatus());
});

timeTrackerEmitter.on('tracking-started', () => {
  if (mainWindow) {
    mainWindow.webContents.send('tracking-started');
  }
});

timeTrackerEmitter.on('tracking-stopped', () => {
  if (mainWindow) {
    mainWindow.webContents.send('tracking-stopped');
  }
});

ipcMain.handle('get-today-total', async (event, userId) => {
  console.log('Calculating today total for userId:', userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log('Date range:', today.toISOString(), 'to', tomorrow.toISOString());

  try {
    const entries = await getTimeEntries(userId, today.toISOString(), tomorrow.toISOString());
    console.log('Retrieved entries:', entries);

    const total = await calculateTotalTime(userId, today.toISOString(), tomorrow.toISOString());
    console.log('Calculated today total:', total);
    return total;
  } catch (error) {
    console.error('Error getting today total:', error);
    return { hours: 0, minutes: 0 };
  }
});

ipcMain.handle('get-week-total', async (event, userId) => {
  console.log('Calculating week total for userId:', userId);
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  console.log('Week range:', startOfWeek.toISOString(), 'to', endOfWeek.toISOString());

  try {
    const total = await calculateTotalTime(userId, startOfWeek.toISOString(), endOfWeek.toISOString());
    console.log('Calculated week total:', total);
    return total;
  } catch (error) {
    console.error('Error calculating week total:', error);
    return { hours: 0, minutes: 0 };
  }
});

ipcMain.handle('get-time-distribution', async (event, userId) => {
  // This is a placeholder. In a real application, you'd fetch this data from your database.
  return {
    development: Math.random() * 20,
    meetings: Math.random() * 10,
    planning: Math.random() * 5,
    other: Math.random() * 3
  };
});

ipcMain.handle('get-weekly-data', async (event, userId) => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const entries = await getTimeEntries(userId, startOfWeek.toISOString(), endOfWeek.toISOString());

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyData = weekDays.map(day => ({
    day,
    hours: 0
  }));

  entries.forEach(entry => {
    const start = new Date(entry.start_time);
    const end = new Date(entry.end_time);
    const dayIndex = start.getDay();
    const hours = (end - start) / (1000 * 60 * 60);
    weeklyData[dayIndex].hours += hours;
  });

  return weeklyData;
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});