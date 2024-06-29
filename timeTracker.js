const { desktopCapturer, BrowserWindow } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { saveTimeEntry, uploadScreenshot } = require('./supabaseClient');

let isTracking = false;
let startTime;
let trackingInterval;

const userDataPath = path.join(os.homedir(), 'softylus-timetracker-screenshots');

// Ensure the directory exists
async function ensureDirectoryExists(directory) {
    try {
        await fs.mkdir(directory, { recursive: true });
    } catch (error) {
        console.error('Error creating directory:', error);
    }
}

async function startTracking(userId) {
    isTracking = true;
    startTime = new Date();
    await ensureDirectoryExists(userDataPath).catch(console.error);
    trackingInterval = setInterval(() => takeScreenshot(userId).catch(console.error), 60000); // Every 1 minute
}

async function stopTracking(userId) {
    isTracking = false;
    clearInterval(trackingInterval);
    const endTime = new Date();
    await saveTimeEntry(userId, startTime, endTime).catch(console.error);
}






async function takeScreenshot(userId) {
    try {
        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
        const screenShot = sources[0].thumbnail.toPNG();

        
       // const pngBuffer = image.toPNG();
        const filePath = path.join(userDataPath, `Screenshot-${Date.now()}.png`);
        
        // Log file path and buffer size
        console.log(`Saving screenshot to: ${filePath}`);
        console.log(`Screenshot buffer size: ${screenShot.length} bytes`);

        fs.writeFile(filePath, screenShot, (error) => {
            if (error) console.error('Failed to save screenshot:', error);
            else mainWindow.webContents.send('screenshot-taken', filePath);
          });

        
        const uploadedPath = await uploadScreenshot(userId, filePath).catch(console.error);
        if (uploadedPath) {
            await saveTimeEntry(userId, new Date(), new Date(), uploadedPath).catch(console.error);
        }
        
        return filePath;
    } catch (error) {
        console.error('Failed to capture or save screenshot:', error);
    }
}

module.exports = { startTracking, stopTracking };
