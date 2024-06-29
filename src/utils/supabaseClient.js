const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

const supabaseUrl = 'https://cdrgbdghnprdhzhiftwi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkcmdiZGdobnByZGh6aGlmdHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTk2NDAzNzMsImV4cCI6MjAzNTIxNjM3M30.CbiOTnvWFbVgUjTOEYTE1bXyapbjUZXFSkyARZM0OWw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getTimeEntries(userId, startDate, endDate) {
    const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', startDate)
        .lte('end_time', endDate);

    if (error) throw error;
    return data;
}

async function saveTimeEntry(userId, startTime, endTime, screenshotUrl) {
    const { data, error } = await supabase
        .from('time_entries')
        .insert([{ 
            user_id: userId, 
            start_time: startTime, 
            end_time: endTime, 
            screenshot_url: screenshotUrl 
        }]);

    if (error) throw error;
    return data;
}

async function uploadScreenshot(userId, screenshotPath) {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const fileName = `${now.getTime()}.png`;
    const filePath = `${userId}/${year}/${month}/${day}/${fileName}`;

    const fileBuffer = await fs.readFile(screenshotPath);

    const { data, error } = await supabase.storage
        .from('screenshots')
        .upload(filePath, fileBuffer, {
            contentType: 'image/png',
            cacheControl: '3600',
            upsert: false
        });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
        .from('screenshots')
        .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
}

module.exports = { getTimeEntries, saveTimeEntry, uploadScreenshot };