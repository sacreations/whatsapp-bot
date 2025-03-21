const dashboardManager = {
    // UI elements
    autoReplyToggle: null,
    socialMediaToggle: null,
    statusViewToggle: null,
    linkSavingToggle: null,
    hideOnlineToggle: null,
    disableReceiptsToggle: null,
    pauseBotToggle: null,
    maintenanceModeToggle: null,
    autoMediaToggle: null,
    
    init: function() {
        // Initialize toggle elements
        this.autoReplyToggle = document.getElementById('auto-reply-toggle');
        this.socialMediaToggle = document.getElementById('social-media-toggle');
        this.statusViewToggle = document.getElementById('status-view-toggle');
        this.linkSavingToggle = document.getElementById('link-saving-toggle');
        this.hideOnlineToggle = document.getElementById('hide-online-toggle');
        this.disableReceiptsToggle = document.getElementById('disable-receipts-toggle');
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
        console.log("Setting up toggle listeners in dashboard-manager");
        
        // Auto Reply toggle
        if (this.autoReplyToggle) {
            this.autoReplyToggle.addEventListener('change', () => {
                this.updateConfigSetting('ENABLE_AUTO_REPLY', this.autoReplyToggle.checked);
            });
        }
        
        // Social Media Download toggle
        if (this.socialMediaToggle) {
            this.socialMediaToggle.addEventListener('change', () => {
                this.updateConfigSetting('ENABLE_SOCIAL_MEDIA_DOWNLOAD', this.socialMediaToggle.checked);
            });
        }
        
        // Auto Status View toggle
        if (this.statusViewToggle) {
            this.statusViewToggle.addEventListener('change', () => {
                this.updateConfigSetting('ENABLE_AUTO_STATUS_VIEW', this.statusViewToggle.checked);
            });
        }
        
        // Link Saving toggle
        if (this.linkSavingToggle) {
            this.linkSavingToggle.addEventListener('change', () => {
                this.updateConfigSetting('ENABLE_LINK_SAVING', this.linkSavingToggle.checked);
            });
        }
        
        // Hide Online Status toggle
        if (this.hideOnlineToggle) {
            this.hideOnlineToggle.addEventListener('change', () => {
                this.updateConfigSetting('HIDE_ONLINE_STATUS', this.hideOnlineToggle.checked);
            });
        }
        
        // Disable Read Receipts toggle
        if (this.disableReceiptsToggle) {
            this.disableReceiptsToggle.addEventListener('change', () => {
                this.updateConfigSetting('DISABLE_READ_RECEIPTS', this.disableReceiptsToggle.checked);
            });
        }
        
        // Pause Bot toggle
        if (this.pauseBotToggle) {
            console.log("Setting up pause-bot-toggle listener");
            this.pauseBotToggle.addEventListener('change', () => {
                this.updateConfigSetting('BOT_PAUSED', this.pauseBotToggle.checked, 
                    this.pauseBotToggle.checked ? 'Bot paused successfully' : 'Bot resumed successfully');
            });
        }
        
        // Maintenance Mode toggle
        if (this.maintenanceModeToggle) {
            console.log("Setting up maintenance-mode-toggle listener");
            this.maintenanceModeToggle.addEventListener('change', () => {
                this.updateConfigSetting('MAINTENANCE_MODE', this.maintenanceModeToggle.checked,
                    this.maintenanceModeToggle.checked ? 'Maintenance mode enabled' : 'Maintenance mode disabled');
            });
        }
        
        // Auto Media Download toggle
        if (this.autoMediaToggle) {
            console.log("Setting up auto-media-toggle listener");
            this.autoMediaToggle.addEventListener('change', () => {
                this.updateConfigSetting('ENABLE_AUTO_MEDIA_DOWNLOAD', this.autoMediaToggle.checked,
                    'Auto media download setting updated');
            });
        }
    },
    
    updateConfigSetting: async function(key, value, successMessage = null) {
        console.log(`Updating setting ${key} to ${value}`);
        
        try {
            // Get current config first
            const response = await fetch('/api/config');
            const data = await response.json();
            
            if (data.success) {
                const config = data.config;
                config[key] = value.toString();
                
                // Send updated config
                const updateResponse = await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ config })
                });
                
                const updateData = await updateResponse.json();
                
                if (updateData.success) {
                    if (successMessage) {
                        showToast(successMessage, 'success');
                    } else {
                        showToast(`${key} updated successfully`, 'success');
                    }
                } else {
                    showToast(`Failed to update ${key}: ${updateData.message}`, 'error');
                    // Revert UI state since update failed
                    this.loadToggleStates();
                }
            } else {
                showToast('Failed to fetch current configuration', 'error');
                // Revert UI state
                this.loadToggleStates();
            }
        } catch (error) {
            console.error(`Error updating ${key}:`, error);
            showToast(`Error updating ${key}`, 'error');
            // Revert UI state
            this.loadToggleStates();
        }
    },
    
    loadToggleStates: async function() {
        try {
            console.log("Loading toggle states in dashboard manager");
            const response = await fetch('/api/config');
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            
            const data = await response.json();
            
            if (data.success) {
                const config = data.config;
                console.log("Retrieved config:", config);
                
                // Set toggle states based on config
                if (this.autoReplyToggle) {
                    this.autoReplyToggle.checked = config.ENABLE_AUTO_REPLY === 'true';
                }
                
                if (this.socialMediaToggle) {
                    this.socialMediaToggle.checked = config.ENABLE_SOCIAL_MEDIA_DOWNLOAD === 'true';
                }
                
                if (this.statusViewToggle) {
                    this.statusViewToggle.checked = config.ENABLE_AUTO_STATUS_VIEW === 'true';
                }
                
                if (this.linkSavingToggle) {
                    this.linkSavingToggle.checked = config.ENABLE_LINK_SAVING === 'true';
                }
                
                if (this.hideOnlineToggle) {
                    this.hideOnlineToggle.checked = config.HIDE_ONLINE_STATUS === 'true';
                }
                
                if (this.disableReceiptsToggle) {
                    this.disableReceiptsToggle.checked = config.DISABLE_READ_RECEIPTS === 'true';
                }
                
                if (this.pauseBotToggle) {
                    this.pauseBotToggle.checked = config.BOT_PAUSED === 'true';
                    console.log(`Pause bot toggle set to: ${this.pauseBotToggle.checked}`);
                }
                
                if (this.maintenanceModeToggle) {
                    this.maintenanceModeToggle.checked = config.MAINTENANCE_MODE === 'true';
                    console.log(`Maintenance mode toggle set to: ${this.maintenanceModeToggle.checked}`);
                }
                
                if (this.autoMediaToggle) {
                    this.autoMediaToggle.checked = config.ENABLE_AUTO_MEDIA_DOWNLOAD === 'true';
                    console.log(`Auto media toggle set to: ${this.autoMediaToggle.checked}`);
                }
            } else {
                console.error('Failed to load configuration:', data.message);
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
