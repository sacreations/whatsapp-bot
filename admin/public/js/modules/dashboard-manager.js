const dashboardManager = {
    // Add references to the new toggles
    pauseBotToggle: null,
    maintenanceModeToggle: null,
    autoMediaToggle: null,
    
    init: function() {
        // Initialize toggle references
        this.pauseBotToggle = document.getElementById('pause-bot-toggle');
        this.maintenanceModeToggle = document.getElementById('maintenance-mode-toggle');
        this.autoMediaToggle = document.getElementById('auto-media-toggle');
        
        // Set up event listeners for the toggles
        this.setupToggleListeners();
        
        // If dashboard is the active section on page load, load its data
        if (document.querySelector('.sidebar-nav li.active').getAttribute('data-section') === 'dashboard') {
            this.loadDashboard();
            this.loadToggleStates();
        }
    },
    
    setupToggleListeners: function() {
        // Pause Bot toggle
        if (this.pauseBotToggle) {
            this.pauseBotToggle.addEventListener('change', async () => {
                await configManager.updateConfig('BOT_PAUSED', this.pauseBotToggle.checked.toString());
                showToast(this.pauseBotToggle.checked ? 'Bot paused successfully' : 'Bot resumed successfully', 'info');
            });
        }
        
        // Maintenance Mode toggle
        if (this.maintenanceModeToggle) {
            this.maintenanceModeToggle.addEventListener('change', async () => {
                await configManager.updateConfig('MAINTENANCE_MODE', this.maintenanceModeToggle.checked.toString());
                showToast(this.maintenanceModeToggle.checked ? 'Maintenance mode enabled' : 'Maintenance mode disabled', 'info');
            });
        }
        
        // Auto Media Download toggle
        if (this.autoMediaToggle) {
            this.autoMediaToggle.addEventListener('change', async () => {
                await configManager.updateConfig('ENABLE_AUTO_MEDIA_DOWNLOAD', this.autoMediaToggle.checked.toString());
                showToast('Auto media download setting updated', 'info');
            });
        }
    },
    
    loadToggleStates: async function() {
        try {
            const response = await fetch('/api/config');
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            
            const data = await response.json();
            
            if (data.success) {
                const config = data.config;
                
                // Set toggle states based on config
                if (this.pauseBotToggle) {
                    this.pauseBotToggle.checked = config.BOT_PAUSED === 'true';
                }
                
                if (this.maintenanceModeToggle) {
                    this.maintenanceModeToggle.checked = config.MAINTENANCE_MODE === 'true';
                }
                
                if (this.autoMediaToggle) {
                    this.autoMediaToggle.checked = config.ENABLE_AUTO_MEDIA_DOWNLOAD === 'true';
                }
            }
        } catch (error) {
            console.error('Error loading toggle states:', error);
        }
    },
    
    loadDashboard: function() {
        // Get dashboard stats from the server
        fetch('/api/dashboard-stats')
            .then(response => {
                if (response.status === 401) {
                    window.location.href = '/login.html';
                    return null;
                }
                return response.json();
            })
            .then(data => {
                if (!data || !data.success) {
                    throw new Error(data?.message || 'Failed to load dashboard data');
                }
                
                // Update dashboard stats with real data
                document.getElementById('groups-count').textContent = data.stats.groupsCount;
                document.getElementById('plugins-count').textContent = data.stats.pluginsCount;
                document.getElementById('downloads-count').textContent = data.stats.downloadsCount;
                document.getElementById('uptime').textContent = data.stats.uptime;
                
                // Load toggle states after dashboard loads
                this.loadToggleStates();
            })
            .catch(error => {
                console.error('Error loading dashboard stats:', error);
                // Show error but don't redirect - just use placeholder text for the stats
                document.getElementById('groups-count').textContent = 'Error';
                document.getElementById('plugins-count').textContent = 'Error';
                document.getElementById('downloads-count').textContent = 'Error';
                document.getElementById('uptime').textContent = 'Error';
                
                // Show toast notification
                showToast('Failed to load dashboard statistics', 'error');
            });
    }
};

window.dashboardManager = dashboardManager;
