const { ipcRenderer } = require('electron');
const { getTimeEntries, saveTimeEntry } = require('.././utils/supabaseClient');


class TimeTracker {
    constructor() {
        this.userId = null;
        this.startTime = null;
        this.timerInterval = null;
        this.weeklyChart = null;

        this.initializeEventListeners();
    }



    initializeEventListeners() {
        document.getElementById('start-button').addEventListener('click', () => this.startTracking());
        document.getElementById('stop-button').addEventListener('click', () => {
            console.log('Stop button clicked');
            this.stopTracking();
        });        document.getElementById('logout-button').addEventListener('click', () => this.logout());

        ipcRenderer.on('user-email', (event, email) => this.setUserEmail(email));
        ipcRenderer.on('tracking-started', () => this.onTrackingStarted());
        ipcRenderer.on('tracking-stopped', () => this.onTrackingStopped());
        ipcRenderer.on('tracking-status', (event, isTracking) => this.updateTrackingStatus(isTracking));

        ipcRenderer.on('screenshot-uploaded', (event, path) => this.onScreenshotUploaded(path));
        ipcRenderer.on('screenshot-upload-failed', (event, error) => this.onScreenshotUploadFailed(error));
        ipcRenderer.on('screenshot-error', (event, error) => this.onScreenshotError(error));

    
    }

    setUserEmail(email) {
        if (email) {
            document.getElementById('user-email').textContent = email;
            this.userId = email;
            this.initializeWeeklyChart();
            this.updateTimeTotals();
            setInterval(() => this.updateTimeTotals(), 60000);
            this.initializeTracking();
        }
    }

    startTracking() {
        console.log('Starting tracking');
        this.startTime = new Date();
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);
        this.updateTrackingUI(true);
    }
    stopTracking() {
        console.log('Stopping tracking');
        ipcRenderer.send('stop-tracking', this.userId);
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        console.log('Timer interval cleared');
        console.log('this.timerInterval after clearing:', this.timerInterval);
        this.updateTrackingUI(false);
    }
    async stopTracking() {
        console.log('Stopping tracking');
        const endTime = new Date().toISOString();
        try {
            await saveTimeEntry(this.userId, this.startTime.toISOString(), endTime, null);
            console.log('Time entry saved');
        } catch (error) {
            console.error('Error saving time entry:', error);
        }
        ipcRenderer.send('stop-tracking', this.userId);
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        console.log('Timer interval cleared');
        this.updateTrackingUI(false);
        await this.updateTimeTotals(); // Make sure to await this if it's an async function
    }
    logout() {
        ipcRenderer.send('logout');
    }

    updateTrackingUI(isTracking) {
        console.log('Updating tracking UI, isTracking:', isTracking);
        document.getElementById('start-button').classList.toggle('hidden', isTracking);
        document.getElementById('stop-button').classList.toggle('hidden', !isTracking);
    }

    initializeTracking() {
        ipcRenderer.send('get-tracking-status');
    }

    updateTimer() {
        console.log('Updating timer');
        const now = new Date();
        const diff = now - this.startTime;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        document.getElementById('time-display').innerText = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    async updateTimeTotals() {
        console.log('Updating time totals for user:', this.userId);
        try {
            const todayTotal = await ipcRenderer.invoke('get-today-total', this.userId);
            console.log('Today total received:', todayTotal);
    
            const weekTotal = await ipcRenderer.invoke('get-week-total', this.userId);
            console.log('Week total received:', weekTotal);
    
            if (todayTotal && typeof todayTotal.hours === 'number' && typeof todayTotal.minutes === 'number') {
                document.getElementById('today-total').textContent = 
                    `${todayTotal.hours}h ${todayTotal.minutes}m`;
                console.log('Updated today-total element:', document.getElementById('today-total').textContent);
            } else {
                console.error('Invalid today total structure:', todayTotal);
            }
    
            if (weekTotal && typeof weekTotal.hours === 'number' && typeof weekTotal.minutes === 'number') {
                document.getElementById('week-total').textContent = 
                    `${weekTotal.hours}h ${weekTotal.minutes}m`;
                console.log('Updated week-total element:', document.getElementById('week-total').textContent);
            } else {
                console.error('Invalid week total structure:', weekTotal);
            }
    
            this.updateWeeklyChart();
        } catch (error) {
            console.error('Error updating time totals:', error);
        }
    }
    initializeTimeDistributionChart() {
        const ctx = document.getElementById('timeDistributionChart').getContext('2d');
        this.timeDistributionChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Development', 'Meetings', 'Planning', 'Other'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)'
                    ],
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#ffffff' }
                    }
                }
            }
        });
    }
    
    async updateCharts() {
        await this.updateWeeklyChart();
        await this.updateTimeDistributionChart();
    }


    async updateTimeDistributionChart() {
        // This is a placeholder. In a real application, you'd fetch this data from your backend.
        const timeDistribution = await ipcRenderer.invoke('get-time-distribution', this.userId);
        
        this.timeDistributionChart.data.datasets[0].data = [
            timeDistribution.development,
            timeDistribution.meetings,
            timeDistribution.planning,
            timeDistribution.other
        ];
        this.timeDistributionChart.update();

        // Update top activities list
        const topActivities = document.getElementById('topActivities');
        topActivities.innerHTML = '';
        Object.entries(timeDistribution)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .forEach(([activity, time]) => {
                const li = document.createElement('li');
                li.textContent = `${activity.charAt(0).toUpperCase() + activity.slice(1)}: ${time.toFixed(1)} hours`;
                li.className = 'mb-2';
                topActivities.appendChild(li);
            });
    }


    initializeWeeklyChart() {
        const ctx = document.getElementById('weeklyChart').getContext('2d');
        this.weeklyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Hours Worked',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: 'rgba(227, 30, 38, 0.6)',
                    borderColor: 'rgba(227, 30, 38, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#ffffff' }
                    },
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#ffffff' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#ffffff' }
                    }
                }
            }
        });
    }

    async updateWeeklyChart() {
        const weeklyData = await ipcRenderer.invoke('get-weekly-data', this.userId);
        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const data = labels.map(day => {
            const entry = weeklyData.find(d => d.day === day);
            return entry ? entry.hours : 0;
        });
    
        const formattedData = data.map(hours => {
            if (hours >= 1) {
                return parseFloat(hours.toFixed(2));
            } else {
                return parseFloat((hours * 60).toFixed(0));
            }
        });
    
        const yAxisLabel = (value) => {
            if (Math.max(...data) >= 1) {
                return value >= 1 ? `${value}h` : `${(value * 60).toFixed(0)}m`;
            } else {
                return `${value}m`;
            }
        };
    
        if (this.weeklyChart) {
            this.weeklyChart.data.datasets[0].data = formattedData;
            this.weeklyChart.options.scales.y.ticks.callback = yAxisLabel;
            this.weeklyChart.update();
        } else {
            const ctx = document.getElementById('weeklyChart').getContext('2d');
            this.weeklyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Time Worked',
                        data: formattedData,
                        backgroundColor: 'rgba(227, 30, 38, 0.6)',
                        borderColor: 'rgba(227, 30, 38, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: {
                                color: '#ffffff',
                                callback: yAxisLabel
                            }
                        },
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#ffffff' }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: { color: '#ffffff' }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const value = context.parsed.y;
                                    if (Math.max(...data) >= 1) {
                                        return value >= 1 ? `${value}h` : `${(value * 60).toFixed(0)}m`;
                                    } else {
                                        return `${value}m`;
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    onTrackingStarted() {
        this.startTime = new Date();
        this.updateTimer();
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);
        this.updateTrackingUI(true);
    }

    onTrackingStopped() {
        clearInterval(this.timerInterval);
        this.updateTrackingUI(false);
    }

    updateTrackingStatus(isTracking) {
        if (isTracking) {
            this.startTime = new Date();
            this.updateTimer();
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);
        }
        this.updateTrackingUI(isTracking);
    }



    onScreenshotUploaded(path) {
        console.log(`Screenshot uploaded: ${path}`);
        // Update UI to show success message if needed
    }

    onScreenshotUploadFailed(error) {
        console.error('Screenshot upload failed:', error);
        // Update UI to show error message if needed
    }

    onScreenshotError(error) {
        console.error('Screenshot error:', error);
        // Update UI to show error message if needed
    }


}

module.exports = TimeTracker;