const { desktopCapturer, screen } = require('electron');
const fs = require('fs').promises;
const { uploadScreenshot, saveTimeEntry } = require('../utils/supabaseClient');
const path = require('path');
const os = require('os');
const sharp = require('sharp');
const EventEmitter = require('events');

const timeTrackerEmitter = new EventEmitter();
let isTracking = false;
let screenshotInterval;

const userDataPath = path.join(os.homedir(), 'softylus-timetracker-screenshots');

async function ensureDirectoryExists(directory) {
    await fs.mkdir(directory, { recursive: true });
}

async function startTracking(userId) {
    if (!isTracking) {
        isTracking = true;
        await ensureDirectoryExists(userDataPath);
        screenshotInterval = setInterval(() => takeScreenshot(userId), 60000); // Take screenshot every minute
        timeTrackerEmitter.emit('tracking-started');
    }
}

async function stopTracking(userId) {
    if (isTracking) {
        isTracking = false;
        clearInterval(screenshotInterval);
        timeTrackerEmitter.emit('tracking-stopped');
    }
}

async function takeScreenshot(userId) {
    try {
        const displays = screen.getAllDisplays();
        let combinedImage = sharp({
            create: {
                width: displays.reduce((sum, display) => sum + display.bounds.width, 0),
                height: Math.max(...displays.map(display => display.bounds.height)),
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            }
        });

        for (let i = 0; i < displays.length; i++) {
            const display = displays[i];
            const sources = await desktopCapturer.getSources({ 
                types: ['screen'], 
                thumbnailSize: display.size
            });
            const source = sources.find(s => s.display_id === display.id.toString());
            if (source) {
                const image = sharp(source.thumbnail.toPNG());
                combinedImage = combinedImage.composite([{ 
                    input: await image.toBuffer(), 
                    left: displays.slice(0, i).reduce((sum, d) => sum + d.bounds.width, 0), 
                    top: 0 
                }]);
            }
        }

        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const fileName = `${userId}_${timestamp}.png`;
        const filePath = path.join(userDataPath, fileName);

        await combinedImage.png().toFile(filePath);
        console.log(`Screenshot saved: ${filePath}`);

        try {
            const screenshotUrl = await uploadScreenshot(userId, filePath);
            console.log('Screenshot uploaded to Supabase:', screenshotUrl);

            // Save time entry with screenshot URL
            const now = new Date();
            await saveTimeEntry(userId, now, now, screenshotUrl);

            timeTrackerEmitter.emit('screenshot-uploaded', screenshotUrl);
        } catch (uploadError) {
            console.error('Failed to upload screenshot to Supabase:', uploadError);
            timeTrackerEmitter.emit('screenshot-upload-failed', uploadError);
        }

        // Delete local file after upload attempt
        await fs.unlink(filePath);
    } catch (error) {
        console.error('Failed to capture or process screenshot:', error);
        timeTrackerEmitter.emit('screenshot-error', error);    }
}

function getTrackingStatus() {
    return isTracking;
}

module.exports = { 
    startTracking, 
    stopTracking, 
    getTrackingStatus, 
    timeTrackerEmitter 
};