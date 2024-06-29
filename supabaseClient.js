const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const { decode } = require('base64-arraybuffer');

const supabaseUrl = 'https://cdrgbdghnprdhzhiftwi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkcmdiZGdobnByZGh6aGlmdHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTk2NDAzNzMsImV4cCI6MjAzNTIxNjM3M30.CbiOTnvWFbVgUjTOEYTE1bXyapbjUZXFSkyARZM0OWw';
const supabase = createClient(supabaseUrl, supabaseKey);
async function saveTimeEntry(userId, startTime, endTime, screenshotUrl) {
    try {
        const { data, error } = await supabase
            .from('time_entries')
            .insert([
                { 
                    user_id: userId, 
                    start_time: startTime, 
                    end_time: endTime, 
                    screenshot_url: screenshotUrl 
                }
            ]);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error saving time entry:', error);
        return null;
    }
}

async function uploadScreenshot(userId, screenshotPath) {
    try {
        const fileName = `${userId}_${Date.now()}.png`;
        
        // Read the file as a buffer
        const fileBuffer = await fs.readFile(screenshotPath);

        const { data, error } = await supabase.storage
            .from('screenshots')
            .upload(fileName, fileBuffer, {
                contentType: 'image/png',
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // Get the public URL of the uploaded file
        const { data: publicUrlData } = supabase.storage
            .from('screenshots')
            .getPublicUrl(fileName);

        return publicUrlData.publicUrl;
    } catch (error) {
        console.error('Error uploading screenshot:', error);
        return null;
    }
}

module.exports = { saveTimeEntry, uploadScreenshot };