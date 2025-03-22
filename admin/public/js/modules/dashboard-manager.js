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
    aiAutoReplyToggle: null,
    aiSearchToggle: null,
    aiWikipediaToggle: null,
    aiWallpapersToggle: null,
    groqApiKeyInput: null,
    toggleApiVisibilityBtn: null,
    saveApiKeyBtn: null,
    aiTemperatureRange: null,
    tempValueDisplay: null,
    aiHtmlExtractToggle: null,
    aiModelSelect: null,
    
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
        this.aiAutoReplyToggle = document.getElementById('ai-auto-reply-toggle');
        this.aiSearchToggle = document.getElementById('ai-search-toggle');
        this.aiWikipediaToggle = document.getElementById('ai-wikipedia-toggle');
        this.aiWallpapersToggle = document.getElementById('ai-wallpapers-toggle');
        this.groqApiKeyInput = document.getElementById('groq-api-key');
        this.toggleApiVisibilityBtn = document.getElementById('toggle-api-visibility');
        this.saveApiKeyBtn = document.getElementById('save-api-key');
        this.aiTemperatureRange = document.getElementById('ai-temperature');
        this.tempValueDisplay = document.getElementById('temp-value');
        this.aiHtmlExtractToggle = document.getElementById('ai-html-extract-toggle');
        this.aiModelSelect = document.getElementById('ai-model-select');
        
        // Set up event listeners for the toggles
        this.setupToggleListeners();
        this.setupAIEventListeners();
        
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
    
    setupAIEventListeners: function() {
        // AI Auto Reply toggle
        if (this.aiAutoReplyToggle) {
            this.aiAutoReplyToggle.addEventListener('change', () => {
                this.updateConfigSetting('ENABLE_AI_AUTO_REPLY', this.aiAutoReplyToggle.checked);
            });
        }
        
        // AI Search toggle
        if (this.aiSearchToggle) {
            this.aiSearchToggle.addEventListener('change', () => {
                this.updateConfigSetting('ENABLE_AI_SEARCH', this.aiSearchToggle.checked);
            });
        }
        
        // AI Wikipedia toggle
        if (this.aiWikipediaToggle) {
            this.aiWikipediaToggle.addEventListener('change', () => {
                this.updateConfigSetting('ENABLE_AI_WIKIPEDIA', this.aiWikipediaToggle.checked);
            });
        }
        
        // AI Wallpapers toggle
        if (this.aiWallpapersToggle) {
            this.aiWallpapersToggle.addEventListener('change', () => {
                this.updateConfigSetting('ENABLE_AI_WALLPAPERS', this.aiWallpapersToggle.checked);
            });
        }
        
        // AI HTML Extract toggle
        if (this.aiHtmlExtractToggle) {
            this.aiHtmlExtractToggle.addEventListener('change', () => {
                this.updateConfigSetting('ENABLE_AI_HTML_EXTRACT', this.aiHtmlExtractToggle.checked);
            });
        }
        
        // Toggle API key visibility
        if (this.toggleApiVisibilityBtn) {
            this.toggleApiVisibilityBtn.addEventListener('click', () => {
                const inputType = this.groqApiKeyInput.type;
                this.groqApiKeyInput.type = inputType === 'password' ? 'text' : 'password';
                this.toggleApiVisibilityBtn.innerHTML = `<i class="fas fa-eye${inputType === 'password' ? '-slash' : ''}"></i>`;
            });
        }
        
        // Save API key
        if (this.saveApiKeyBtn) {
            this.saveApiKeyBtn.addEventListener('click', () => {
                const apiKey = this.groqApiKeyInput.value.trim();
                if (apiKey) {
                    this.updateConfigSetting('GROQ_API_KEY', apiKey, 'API key saved successfully');
                } else {
                    showToast('Please enter a valid API key', 'error');
                }
            });
        }
        
        // Update temperature display
        if (this.aiTemperatureRange && this.tempValueDisplay) {
            this.aiTemperatureRange.addEventListener('input', () => {
                const temp = parseFloat(this.aiTemperatureRange.value) / 10;
                this.tempValueDisplay.textContent = temp.toFixed(1);
            });
        }
        
        // AI Model selection
        if (this.aiModelSelect) {
            this.aiModelSelect.addEventListener('change', () => {
                const selectedModel = this.aiModelSelect.value;
                this.updateConfigSetting('AI_MODEL', selectedModel, `AI Model set to ${selectedModel}`);
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
                
                // Load AI toggle states
                if (this.aiAutoReplyToggle) {
                    this.aiAutoReplyToggle.checked = config.ENABLE_AI_AUTO_REPLY === 'true';
                }
                
                if (this.aiSearchToggle) {
                    this.aiSearchToggle.checked = config.ENABLE_AI_SEARCH === 'true';
                }
                
                if (this.aiWikipediaToggle) {
                    this.aiWikipediaToggle.checked = config.ENABLE_AI_WIKIPEDIA === 'true';
                }
                
                if (this.aiWallpapersToggle) {
                    this.aiWallpapersToggle.checked = config.ENABLE_AI_WALLPAPERS === 'true';
                }
                
                if (this.aiHtmlExtractToggle) {
                    this.aiHtmlExtractToggle.checked = config.ENABLE_AI_HTML_EXTRACT === 'true';
                }
                
                // Load API key (masked)
                if (this.groqApiKeyInput && config.GROQ_API_KEY) {
                    // Show just first and last 4 characters if available
                    const apiKey = config.GROQ_API_KEY;
                    if (apiKey.length > 8) {
                        const maskedKey = apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.slice(-4);
                        this.groqApiKeyInput.placeholder = maskedKey;
                    } else {
                        this.groqApiKeyInput.placeholder = '********';
                    }
                }
                
                // Load AI temperature
                if (this.aiTemperatureRange && this.tempValueDisplay && config.AI_TEMPERATURE) {
                    const temp = parseFloat(config.AI_TEMPERATURE);
                    this.aiTemperatureRange.value = (temp * 10).toString();
                    this.tempValueDisplay.textContent = temp.toFixed(1);
                }
                
                // Load AI model selection
                if (this.aiModelSelect && config.AI_MODEL) {
                    // Set the selected model
                    const aiModelOptions = Array.from(this.aiModelSelect.options);
                    const matchingOption = aiModelOptions.find(option => option.value === config.AI_MODEL);
                    
                    if (matchingOption) {
                        this.aiModelSelect.value = config.AI_MODEL;
                    } else {
                        // If model not in list, default to LLaMA
                        this.aiModelSelect.value = 'llama-3.3-70b-versatile';
                    }
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
