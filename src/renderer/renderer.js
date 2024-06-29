const { ipcRenderer } = require('electron');
const TimeTracker = require('./timeTracker.js');

const timeTracker = new TimeTracker();

// Initialize the application
ipcRenderer.send('get-user-email');