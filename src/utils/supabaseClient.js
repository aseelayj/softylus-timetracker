const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

const supabaseUrl = 'http://supabasekong-ok8gcko.65.21.12.12.sslip.io';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTcyMjQ0Njk0MCwiZXhwIjo0ODc4MTIwNTQwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.ETLRAIXPxBOEbDj7nclXRaHrq6Cs2ITUp71tbniO2-k'
const supabase = createClient(supabaseUrl, supabaseKey);

async function getTimeEntries(userId, startDate, endDate) {
    console.log('Getting time entries for:', userId, 'from', startDate, 'to', endDate);
    
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', startDate)
        .lte('end_time', endDate);
  
      if (error) {
        console.error('Error fetching time entries:', error);
        throw error;
      }
  
      console.log('Retrieved time entries:', data);
      return data;
    } catch (err) {
      console.error('getTimeEntries threw an error:', err);
      throw err;
    }
  }
  (async () => {
    try {
      const { data, error } = await supabase.from('time_entries').select('count', { count: 'exact' });
      if (error) {
        console.error('Supabase connection test failed:', error);
      } else {
        console.log('Supabase connection test successful. Row count:', data[0].count);
      }
    } catch (err) {
      console.error('Supabase connection test threw an error:', err);
    }
  })();
async function testConnection() {
    const { data, error } = await supabase.from('time_entries').select('count', { count: 'exact' });
    if (error) {
        console.error('Supabase connection test failed:', error);
    } else {
        console.log('Supabase connection test successful. Row count:', data[0].count);
    }
}

async function saveTimeEntry(userId, startTime, endTime, screenshotUrl) {
    console.log('Saving time entry:', { userId, startTime, endTime, screenshotUrl });
    const { data, error } = await supabase
        .from('time_entries')
        .insert([{ 
            user_id: userId, 
            start_time: startTime, 
            end_time: endTime, 
            screenshot_url: screenshotUrl 
        }]);

    if (error) {
        console.error('Error saving time entry:', error);
        throw error;
    }
    console.log('Time entry saved successfully:', data);
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

module.exports = { getTimeEntries, saveTimeEntry, uploadScreenshot, testConnection };
