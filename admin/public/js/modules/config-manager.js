const configManager = {
    configForm: null,
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
        this.configForm = document.getElementById('config-form');
        this.autoReplyToggle = document.getElementById('auto-reply-toggle');
        this.socialMediaToggle = document.getElementById('social-media-toggle');
        this.statusViewToggle = document.getElementById('status-view-toggle');
        this.linkSavingToggle = document.getElementById('link-saving-toggle');
        this.hideOnlineToggle = document.getElementById('hide-online-toggle');         
        this.disableReceiptsToggle = document.getElementById('disable-receipts-toggle');
        this.pauseBotToggle = document.getElementById('pause-bot-toggle');
        this.maintenanceModeToggle = document.getElementById('maintenance-mode-toggle');
        this.autoMediaToggle = document.getElementById('auto-media-toggle');
        
        // Create the admin information UI section
        this.createAdminInfoSection();
        
        this.setupEventListeners();
        this.loadConfig();
    },
    
    setupEventListeners: function() {
        if (this.configForm) {
            this.configForm.addEventListener('submit', this.handleConfigSubmit.bind(this));
        }
        
        if (this.autoReplyToggle) {
            this.autoReplyToggle.addEventListener('change', async function() {
                await configManager.updateConfig('ENABLE_AUTO_REPLY', this.checked.toString());
            });
        }
        
        if (this.socialMediaToggle) {
            this.socialMediaToggle.addEventListener('change', async function() {
                await configManager.updateConfig('ENABLE_SOCIAL_MEDIA_DOWNLOAD', this.checked.toString());
            });
        }
        
        if (this.statusViewToggle) {
            this.statusViewToggle.addEventListener('change', async function() {
                await configManager.updateConfig('ENABLE_AUTO_STATUS_VIEW', this.checked.toString());
            });
        }
        
        if (this.linkSavingToggle) {
            this.linkSavingToggle.addEventListener('change', async function() {
                await configManager.updateConfig('ENABLE_LINK_SAVING', this.checked.toString());
            });
        }

        if (this.hideOnlineToggle) {
            this.hideOnlineToggle.addEventListener('change', async function() {
                await configManager.updateConfig('HIDE_ONLINE_STATUS', this.checked.toString());
                showToast('Changes will take effect after bot restart', 'info');
            });
        }
        
        if (this.disableReceiptsToggle) {
            this.disableReceiptsToggle.addEventListener('change', async function() {
                await configManager.updateConfig('DISABLE_READ_RECEIPTS', this.checked.toString());
                showToast('Changes will take effect after bot restart', 'info');
            });
        }

        if (this.pauseBotToggle) {
            this.pauseBotToggle.addEventListener('change', async function() {
                await configManager.updateConfig('BOT_PAUSED', this.checked.toString());
                showToast(this.checked ? 'Bot paused successfully' : 'Bot resumed successfully', 'info');
            });
        }
        
        if (this.maintenanceModeToggle) {
            this.maintenanceModeToggle.addEventListener('change', async function() {
                await configManager.updateConfig('MAINTENANCE_MODE', this.checked.toString());
                showToast(this.checked ? 'Maintenance mode enabled' : 'Maintenance mode disabled', 'info');
            });
        }
        
        if (this.autoMediaToggle) {
            this.autoMediaToggle.addEventListener('change', async function() {
                await configManager.updateConfig('ENABLE_AUTO_MEDIA_DOWNLOAD', this.checked.toString());
                showToast('Auto media download setting updated', 'info');
            });
        }
    },
    
    handleConfigSubmit: async function(e) {
        e.preventDefault();
        
        const formData = new FormData(this.configForm);
        const config = {};
        
        for (const [key, value] of formData.entries()) {
            config[key] = value;
        }
        
        // Ensure admin fields are included
        config.ADMIN_NAME = document.getElementById('ADMIN_NAME').value;
        config.ADMIN_EMAIL = document.getElementById('ADMIN_EMAIL').value;
        config.ADMIN_BIO = document.getElementById('ADMIN_BIO').value;
        
        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('Configuration saved successfully!', 'success');
            } else {
                showToast('Failed to save configuration: ' + data.message, 'error');
            }
        } catch (error) {
            showToast('Error saving configuration', 'error');
        }
    },
    
    loadConfig: async function() {
        try {
            console.log('Fetching configuration...');
            const response = await fetch('/api/config', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'same-origin' 
            });
            
            console.log('Response status:', response.status);
            
            if (response.status === 401) {
                console.log('Authentication required, redirecting to login');
                window.location.href = '/login.html';
                return;
            }
            
            const data = await response.json();
            console.log('Response data:', data);
            
            if (data.success) {
                const config = data.config;
                
                Object.entries(config).forEach(([key, value]) => {
                    const input = document.querySelector(`[name="${key}"]`);
                    if (input) {
                        input.value = value;
                    }
                });
                
                if (this.autoReplyToggle) {
                    this.autoReplyToggle.checked = config.ENABLE_AUTO_REPLY === 'true';
                }
                
                if (this.socialMediaToggle) {
                    this.socialMediaToggle.checked = config.ENABLE_SOCIAL_MEDIA_DOWNLOAD === 'true';
                }
                
                if (this.statusViewToggle) {
                    this.statusViewToggle.checked = config.ENABLE_AUTO_STATUS_VIEW === 'true';
                }
                
                if (this.linkSavingToggle && config.ENABLE_LINK_SAVING !== undefined) {
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
                }
                
                if (this.maintenanceModeToggle) {
                    this.maintenanceModeToggle.checked = config.MAINTENANCE_MODE === 'true';
                }
                
                if (this.autoMediaToggle) {
                    this.autoMediaToggle.checked = config.ENABLE_AUTO_MEDIA_DOWNLOAD === 'true';
                }
                
                if (groupsManager && config.ALLOWED_DOWNLOAD_GROUPS) {
                    groupsManager.loadGroups(config.ALLOWED_DOWNLOAD_GROUPS);
                }

                // Load admin settings
                document.getElementById('ADMIN_NAME').value = config.ADMIN_NAME || '';
                document.getElementById('ADMIN_EMAIL').value = config.ADMIN_EMAIL || '';
                document.getElementById('ADMIN_BIO').value = config.ADMIN_BIO || '';
            } else {
                console.error('Failed to load configuration:', data.message);
                showToast('Failed to load configuration: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
            showToast('Error loading configuration: ' + (error.message || 'Unknown error'), 'error');
            
            if (error.message && error.message.includes('Authentication required')) {
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
            }
        }
    },
    
    updateConfig: async function(key, value) {
        try {
            const response = await fetch('/api/config');
            const data = await response.json();
            
            if (data.success) {
                const config = data.config;
                config[key] = value;
                
                const updateResponse = await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ config })
                });
                
                const updateData = await updateResponse.json();
                
                if (updateData.success) {
                    showToast(`Successfully updated ${key}`, 'success');
                } else {
                    showToast(`Failed to update ${key}: ${updateData.message}`, 'error');
                }
            } else {
                showToast('Failed to fetch current configuration', 'error');
            }
        } catch (error) {
            showToast(`Error updating ${key}`, 'error');
        }
    },
    
    /**
     * Create the admin information section in the config UI
     */
    createAdminInfoSection: function() {
        // Find the config container
        const configContainer = document.querySelector('.config-container') || document.getElementById('config-form');
        
        if (!configContainer) {
            console.error('Config container not found');
            return;
        }
        
        // Create Admin Information Section
        const adminSection = document.createElement('div');
        adminSection.className = 'config-section';
        adminSection.innerHTML = `
            <h3>Admin Information</h3>
            <div class="config-description">Information about the bot administrator that may be shared with users.</div>
            
            <div class="form-group">
                <label for="ADMIN_NAME">Admin Name:</label>
                <input type="text" id="ADMIN_NAME" name="ADMIN_NAME" class="form-control">
                <div class="description">Your name as the bot administrator</div>
            </div>
            
            <div class="form-group">
                <label for="ADMIN_EMAIL">Admin Email (Optional):</label>
                <input type="email" id="ADMIN_EMAIL" name="ADMIN_EMAIL" class="form-control">
                <div class="description">Your contact email (will not be shared automatically)</div>
            </div>
            
            <div class="form-group">
                <label for="ADMIN_BIO">Admin Bio (Optional):</label>
                <textarea id="ADMIN_BIO" name="ADMIN_BIO" class="form-control" rows="3"></textarea>
                <div class="description">Brief information about the bot administrator</div>
            </div>
        `;
        
        // Add admin section to the config container
        configContainer.appendChild(adminSection);
    }
};

window.configManager = configManager;
