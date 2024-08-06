module.exports = {
    APP_NAME: "Softylus Time Tracker",
    APP_ID: "com.softylus.timetracker",
    IDLE_THRESHOLD: 10000, // 10 seconds in milliseconds
    AUTO_LAUNCH: true,
    ICON_PATH: '../app icon/softylus.ico',
    TRAY_ICON_PATH: '../app icon/softylus.ico',
    DOCK_ICON_PATH: '../app icon/softylus.svg',
    WINDOW_CONFIG: {
      login: {
        width: 400,
        height: 600,
        frame: false,
        title: 'Softylus Time Tracker - Login',
        htmlFile: 'src/renderer/login.html'
      },
      main: {
        width: 1000,
        height: 700,
        frame: false,
        titleBarStyle: 'hidden',
        backgroundColor: '#000000',
        title: 'Softylus Time Tracker',
        show: true,
        htmlFile: 'src/renderer/index.html'
      }
    },
    TRAY_MENU_TEMPLATE: [
      { label: 'Show App', role: 'show' },
      { label: 'Quit', role: 'quit' }
    ]
  };