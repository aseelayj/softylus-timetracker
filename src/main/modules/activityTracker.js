const { ipcMain } = require('electron');
const activeWin = require('active-win');

let isTracking = false;
let activityInterval;

function startActivityTracking() {
  if (!isTracking) {
    isTracking = true;
    activityInterval = setInterval(trackActivity, 5000); // Track every 5 seconds
  }
}

function stopActivityTracking() {
  if (isTracking) {
    isTracking = false;
    clearInterval(activityInterval);
  }
}

async function trackActivity() {
  try {
    const activeWindow = await activeWin();
    if (activeWindow) {
      const activityData = {
        title: activeWindow.title,
        owner: {
          name: activeWindow.owner.name,
          path: activeWindow.owner.path
        },
        timestamp: new Date().toISOString()
      };
      ipcMain.emit('activity-tracked', activityData);
    }
  } catch (error) {
    console.error('Error tracking activity:', error);
  }
}

function getActivityTrackingStatus() {
  return isTracking;
}

ipcMain.on('start-activity-tracking', startActivityTracking);
ipcMain.on('stop-activity-tracking', stopActivityTracking);
ipcMain.handle('get-activity-tracking-status', getActivityTrackingStatus);

module.exports = {
  startActivityTracking,
  stopActivityTracking,
  getActivityTrackingStatus
};