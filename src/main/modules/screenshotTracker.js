const { desktopCapturer, ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

let isTracking = false;
let screenshotInterval;
const screenshotDir = path.join(os.homedir(), 'softylus-timetracker-screenshots');

async function ensureDirectoryExists() {
  try {
    await fs.mkdir(screenshotDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create screenshot directory:', error);
  }
}

async function takeScreenshot() {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
    const primaryDisplay = sources[0]; // Assuming the primary display is the first one

    if (primaryDisplay) {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const fileName = `screenshot_${timestamp}.png`;
      const filePath = path.join(screenshotDir, fileName);

      await fs.writeFile(filePath, primaryDisplay.thumbnail.toPNG());
      console.log(`Screenshot saved: ${filePath}`);
      ipcMain.emit('screenshot-taken', filePath);
    }
  } catch (error) {
    console.error('Error taking screenshot:', error);
  }
}

function startScreenshotTracking() {
  if (!isTracking) {
    isTracking = true;
    ensureDirectoryExists();
    screenshotInterval = setInterval(takeScreenshot, 300000); // Take screenshot every 5 minutes
  }
}

function stopScreenshotTracking() {
  if (isTracking) {
    isTracking = false;
    clearInterval(screenshotInterval);
  }
}

function getScreenshotTrackingStatus() {
  return isTracking;
}

ipcMain.on('start-screenshot-tracking', startScreenshotTracking);
ipcMain.on('stop-screenshot-tracking', stopScreenshotTracking);
ipcMain.handle('get-screenshot-tracking-status', getScreenshotTrackingStatus);

module.exports = {
  startScreenshotTracking,
  stopScreenshotTracking,
  getScreenshotTrackingStatus
};