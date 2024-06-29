const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const storage = require('electron-json-storage');
const { startTracking, stopTracking, setUserDataPath } = require('./timeTracker');
const os = require('os'); // Import the os module

let mainWindow;
let loginWindow;
let tray;
let userDataPath;


function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 400,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  loginWindow.loadFile('login.html');
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  createTray();
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

app.whenReady().then(() => {
     userDataPath = path.join(os.homedir(), 'softylus-timetracker-screenshots');

    // Ensure the directory exists
    async function ensureDirectoryExists(directory) {
        try {
            await fs.mkdir(directory, { recursive: true });
        } catch (error) {
            console.error('Error creating directory:', error);
        }
    }  
  storage.get('userData', (error, data) => {
    if (error) {
      console.error('Error retrieving user data:', error);
      createLoginWindow();
    } else if (data && data.email) {
      createMainWindow();
    } else {
      createLoginWindow();
    }
  });

  app.on('activate', function () {
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

ipcMain.on('login-success', (event, user) => {
  storage.set('userData', { email: user.email }, (error) => {
    if (error) console.error('Failed to save user data:', error);
    if (loginWindow) loginWindow.close();
    createMainWindow();
  });
});

ipcMain.on('logout', (event) => {
  storage.remove('userData', (error) => {
    if (error) console.error('Failed to clear user data:', error);
    if (mainWindow) mainWindow.close();
    createLoginWindow();
  });
});

ipcMain.on('get-user-email', (event) => {
  storage.get('userData', (error, data) => {
    if (error) {
      console.error('Error retrieving user data:', error);
      event.reply('user-email', null);
    } else {
      event.reply('user-email', data.email || null);
    }
  });
});

ipcMain.on('start-tracking', (event, userId) => {
  startTracking(userId);
});

ipcMain.on('stop-tracking', (event, userId) => {
  stopTracking(userId);
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Auto-start setup
app.setLoginItemSettings({
  openAtLogin: true,
  path: app.getPath('exe')
});