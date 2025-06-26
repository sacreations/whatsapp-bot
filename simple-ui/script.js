// Global variables
let currentConfig = {};
let currentStatuses = [];

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    loadConfiguration();
    loadStatuses();
    setupEventListeners();
});

// Tab functionality
function initializeTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-tab');
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active content
            contents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetId) {
                    content.classList.add('active');
                }
            });
            
            // Load data when switching to status tab
            if (targetId === 'status') {
                loadStatuses();
            }
        });
    });
}

// Setup event listeners
function setupEventListeners() {
    // Toggle switches
    const toggles = document.querySelectorAll('.toggle-input');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', function() {
            updateToggle(this.id, this.checked);
        });
    });
    
    // Status filters
    document.getElementById('statusFilter').addEventListener('change', filterStatuses);
    document.getElementById('timeFilter').addEventListener('change', filterStatuses);
}

// Load configuration from server
async function loadConfiguration() {
    try {
        showToast('Loading configuration...', 'info');
        
        // For now, use localStorage as a fallback until server is available
        const savedConfig = localStorage.getItem('botConfig');
        if (savedConfig) {
            currentConfig = JSON.parse(savedConfig);
            updateUI();
            showToast('Configuration loaded', 'success');
        } else {
            // Set default values
            currentConfig = {
                ENABLE_AUTO_REPLY: 'false',
                ENABLE_SOCIAL_MEDIA_DOWNLOAD: 'true',
                ENABLE_AUTO_STATUS_VIEW: 'true',
                HIDE_ONLINE_STATUS: 'false',
                DISABLE_READ_RECEIPTS: 'false',
                BOT_PAUSED: 'false',
                PREFIX: '.',
                BOT_NAME: 'WhatsApp Bot',
                OWNER_NUMBER: ''
            };
            updateUI();
            showToast('Using default configuration', 'warning');
        }
        
        // Try to fetch from server (this will work when the simple server is implemented)
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    currentConfig = data.config;
                    updateUI();
                    showToast('Configuration synchronized', 'success');
                }
            }
        } catch (error) {
            console.log('Server not available, using local config');
        }
        
    } catch (error) {
        console.error('Error loading configuration:', error);
        showToast('Error loading configuration', 'error');
    }
}

// Update UI with current configuration
function updateUI() {
    // Update toggles
    document.getElementById('autoReply').checked = currentConfig.ENABLE_AUTO_REPLY === 'true';
    document.getElementById('socialMedia').checked = currentConfig.ENABLE_SOCIAL_MEDIA_DOWNLOAD === 'true';
    document.getElementById('statusView').checked = currentConfig.ENABLE_AUTO_STATUS_VIEW === 'true';
    document.getElementById('hideOnline').checked = currentConfig.HIDE_ONLINE_STATUS === 'true';
    document.getElementById('disableReceipts').checked = currentConfig.DISABLE_READ_RECEIPTS === 'true';
    document.getElementById('pauseBot').checked = currentConfig.BOT_PAUSED === 'true';
    
    // Update form fields
    document.getElementById('prefix').value = currentConfig.PREFIX || '.';
    document.getElementById('botName').value = currentConfig.BOT_NAME || 'WhatsApp Bot';
    document.getElementById('ownerNumber').value = currentConfig.OWNER_NUMBER || '';
}

// Update a toggle setting
async function updateToggle(settingKey, value) {
    const configKey = getConfigKey(settingKey);
    currentConfig[configKey] = value.toString();
    
    // Save to localStorage
    localStorage.setItem('botConfig', JSON.stringify(currentConfig));
    
    // Try to save to server
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: currentConfig })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                showToast(`${getSettingName(settingKey)} updated`, 'success');
            } else {
                throw new Error(data.message);
            }
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        console.log('Could not sync to server, saved locally');
        showToast(`${getSettingName(settingKey)} updated locally`, 'warning');
    }
}

// Map UI element IDs to config keys
function getConfigKey(elementId) {
    const mapping = {
        'autoReply': 'ENABLE_AUTO_REPLY',
        'socialMedia': 'ENABLE_SOCIAL_MEDIA_DOWNLOAD',
        'statusView': 'ENABLE_AUTO_STATUS_VIEW',
        'hideOnline': 'HIDE_ONLINE_STATUS',
        'disableReceipts': 'DISABLE_READ_RECEIPTS',
        'pauseBot': 'BOT_PAUSED'
    };
    return mapping[elementId] || elementId;
}

// Get human-readable setting names
function getSettingName(elementId) {
    const mapping = {
        'autoReply': 'Auto Reply',
        'socialMedia': 'Social Media Download',
        'statusView': 'Auto Status View',
        'hideOnline': 'Hide Online Status',
        'disableReceipts': 'Read Receipts',
        'pauseBot': 'Bot Pause'
    };
    return mapping[elementId] || elementId;
}

// Save configuration
async function saveSettings() {
    try {
        // Get form values
        currentConfig.PREFIX = document.getElementById('prefix').value || '.';
        currentConfig.BOT_NAME = document.getElementById('botName').value || 'WhatsApp Bot';
        currentConfig.OWNER_NUMBER = document.getElementById('ownerNumber').value || '';
        
        // Save to localStorage
        localStorage.setItem('botConfig', JSON.stringify(currentConfig));
        
        // Try to save to server
        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: currentConfig })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    showToast('Settings saved successfully!', 'success');
                } else {
                    throw new Error(data.message);
                }
            } else {
                throw new Error('Server error');
            }
        } catch (error) {
            console.log('Could not sync to server, saved locally');
            showToast('Settings saved locally', 'warning');
        }
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Error saving settings', 'error');
    }
}

// Load status updates
async function loadStatuses() {
    try {
        const grid = document.getElementById('statusGrid');
        grid.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Loading statuses...</div>';
        
        // Try to fetch from server
        try {
            const response = await fetch('/api/statuses');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    currentStatuses = data.statuses || [];
                    displayStatuses();
                    return;
                }
            }
        } catch (error) {
            console.log('Server not available for statuses');
        }
        
        // Fallback: Load from localStorage or show empty state
        const savedStatuses = localStorage.getItem('savedStatuses');
        if (savedStatuses) {
            currentStatuses = JSON.parse(savedStatuses);
            displayStatuses();
        } else {
            grid.innerHTML = '<div class="no-data">No saved status updates found.</div>';
        }
        
    } catch (error) {
        console.error('Error loading statuses:', error);
        document.getElementById('statusGrid').innerHTML = 
            '<div class="no-data">Error loading status updates.</div>';
    }
}

// Display status updates
function displayStatuses() {
    const grid = document.getElementById('statusGrid');
    
    if (!currentStatuses || currentStatuses.length === 0) {
        grid.innerHTML = '<div class="no-data">No saved status updates found.</div>';
        return;
    }
    
    const filteredStatuses = filterStatusesBySettings();
    
    if (filteredStatuses.length === 0) {
        grid.innerHTML = '<div class="no-data">No status updates match the current filters.</div>';
        return;
    }
    
    grid.innerHTML = filteredStatuses.map(status => createStatusCard(status)).join('');
}

// Filter statuses based on current filter settings
function filterStatusesBySettings() {
    let filtered = [...currentStatuses];
    
    // Filter by type
    const typeFilter = document.getElementById('statusFilter').value;
    if (typeFilter !== 'all') {
        filtered = filtered.filter(status => status.type === typeFilter);
    }
    
    // Filter by time
    const timeFilter = document.getElementById('timeFilter').value;
    if (timeFilter !== 'all') {
        const cutoffTime = getTimeFilterCutoff(timeFilter);
        filtered = filtered.filter(status => status.timestamp > cutoffTime);
    }
    
    // Sort by newest first
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    
    return filtered;
}

// Get cutoff time for time filter
function getTimeFilterCutoff(filter) {
    const now = Date.now();
    switch (filter) {
        case '24h':
            return now - (24 * 60 * 60 * 1000);
        case '7d':
            return now - (7 * 24 * 60 * 60 * 1000);
        case '30d':
            return now - (30 * 24 * 60 * 60 * 1000);
        default:
            return 0;
    }
}

// Create status card HTML
function createStatusCard(status) {
    const date = new Date(status.timestamp).toLocaleString();
    const fileExtension = status.filename ? status.filename.split('.').pop().toLowerCase() : '';
    const isVideo = ['mp4', 'avi', 'mov', 'mkv'].includes(fileExtension);
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
    
    return `
        <div class="status-card" data-id="${status.id || status.timestamp}">
            <div class="status-preview">
                ${isImage ? 
                    `<img src="/api/statuses/${status.filename}" alt="Status" onerror="this.parentElement.innerHTML='<i class=\\"fas fa-image placeholder\\"></i>'">` :
                    isVideo ? 
                        `<video src="/api/statuses/${status.filename}" muted onerror="this.parentElement.innerHTML='<i class=\\"fas fa-video placeholder\\"></i>'"></video>` :
                        `<i class="fas fa-file placeholder"></i>`
                }
            </div>
            <div class="status-info">
                <div class="status-contact">
                    <i class="fas fa-user"></i>
                    ${status.contactName || status.contact || 'Unknown'}
                </div>
                <div class="status-date">
                    <i class="fas fa-clock"></i>
                    ${date}
                </div>
                <div class="status-actions">
                    <button class="status-btn" onclick="viewStatus('${status.filename}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="status-btn" onclick="downloadStatus('${status.filename}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                    <button class="status-btn delete" onclick="deleteStatus('${status.id || status.timestamp}', '${status.filename}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Filter statuses when filter changes
function filterStatuses() {
    displayStatuses();
}

// View status in new tab
function viewStatus(filename) {
    if (filename) {
        window.open(`/api/statuses/${filename}`, '_blank');
    }
}

// Download status
function downloadStatus(filename) {
    if (filename) {
        const link = document.createElement('a');
        link.href = `/api/statuses/${filename}`;
        link.download = filename;
        link.click();
    }
}

// Delete status
async function deleteStatus(statusId, filename) {
    if (!confirm('Are you sure you want to delete this status?')) {
        return;
    }
    
    try {
        // Try to delete from server
        try {
            const response = await fetch(`/api/statuses/${filename}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    showToast('Status deleted successfully', 'success');
                    loadStatuses(); // Reload statuses
                    return;
                }
            }
        } catch (error) {
            console.log('Could not delete from server');
        }
        
        // Fallback: Remove from local storage
        currentStatuses = currentStatuses.filter(status => 
            (status.id || status.timestamp) !== statusId
        );
        localStorage.setItem('savedStatuses', JSON.stringify(currentStatuses));
        displayStatuses();
        showToast('Status deleted locally', 'warning');
        
    } catch (error) {
        console.error('Error deleting status:', error);
        showToast('Error deleting status', 'error');
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Hide toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Utility function to format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Export functions for global access
window.saveSettings = saveSettings;
window.loadStatuses = loadStatuses;
window.viewStatus = viewStatus;
window.downloadStatus = downloadStatus;
window.deleteStatus = deleteStatus;
