const configManager = {
    configForm: null,
    autoReplyToggle: null,
    socialMediaToggle: null,
    statusViewToggle: null,
    linkSavingToggle: null,
    
    init: function() {
        this.configForm = document.getElementById('config-form');
        this.autoReplyToggle = document.getElementById('auto-reply-toggle');
        this.socialMediaToggle = document.getElementById('social-media-toggle');
        this.statusViewToggle = document.getElementById('status-view-toggle');
        this.linkSavingToggle = document.getElementById('link-saving-toggle');
        
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
    },
    
    handleConfigSubmit: async function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(this.configForm);
        const config = {};
        
        for (const [key, value] of formData.entries()) {
            config[key] = value;
        }
        
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
                credentials: 'same-origin' // Include cookies
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
                
                // Fill form inputs
                Object.entries(config).forEach(([key, value]) => {
                    const input = document.querySelector(`[name="${key}"]`);
                    if (input) {
                        input.value = value;
                    }
                });
                
                // Set toggles
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
                
                // Load group IDs - this will be handled by the groups manager
                if (groupsManager && config.ALLOWED_DOWNLOAD_GROUPS) {
                    groupsManager.loadGroups(config.ALLOWED_DOWNLOAD_GROUPS);
                }
            } else {
                console.error('Failed to load configuration:', data.message);
                showToast('Failed to load configuration: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
            showToast('Error loading configuration: ' + (error.message || 'Unknown error'), 'error');
            
            // Redirect to login if appropriate
            if (error.message && error.message.includes('Authentication required')) {
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
            }
        }
    },
    
    updateConfig: async function(key, value) {
        try {
            // Get current config first
            const response = await fetch('/api/config');
            const data = await response.json();
            
            if (data.success) {
                const config = data.config;
                config[key] = value;
                
                // Send updated config
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
    }
};

window.configManager = configManager;
