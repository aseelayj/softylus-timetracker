const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const storage = require('electron-json-storage');
const { startTracking, stopTracking, getTrackingStatus, timeTrackerEmitter } = require('./mainTimeTracker');
const os = require('os');
const { getTimeEntries } = require('../utils/supabaseClient');

let mainWindow, loginWindow, tray;
let isTracking = false;

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
    title: 'Softylus Time Tracker'
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
    const iconPath = path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);
    
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show App', click: () => mainWindow.show() },
        { label: 'Quit', click: () => app.quit() }
    ]);
    
    tray.setToolTip('Timetracker');
    tray.setContextMenu(contextMenu);
    
    if (process.platform === 'darwin') {
        app.dock.show();
    }
}

async function calculateTotalTime(userId, startDate, endDate) {
    try {
        const entries = await getTimeEntries(userId, startDate, endDate);
        let totalMilliseconds = 0;

        entries.forEach(entry => {
            const start = new Date(entry.start_time);
            const end = new Date(entry.end_time);
            totalMilliseconds += end - start;
        });

        const totalHours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
        const totalMinutes = Math.floor((totalMilliseconds % (1000 * 60 * 60)) / (1000 * 60));

        return { hours: totalHours, minutes: totalMinutes };
    } catch (error) {
        console.error('Error calculating total time:', error);
        return { hours: 0, minutes: 0 };
    }
}

app.whenReady().then(() => {
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


timeTrackerEmitter.on('screenshot-taken', (filePath) => {
  // Here you can handle the screenshot, e.g., upload it to a server
  console.log(`Screenshot taken: ${filePath}`);
  // You might want to send an event to the renderer process to update the UI
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return calculateTotalTime(userId, today.toISOString(), tomorrow.toISOString());
});

ipcMain.handle('get-week-total', async (event, userId) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    return calculateTotalTime(userId, startOfWeek.toISOString(), endOfWeek.toISOString());
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

app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe')
});
