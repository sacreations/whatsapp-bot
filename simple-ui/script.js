// Global variables
let currentConfig = {};
let currentStatuses = [];
let isAuthenticated = false;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let sessionTimer;

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    initializeTabs();
    setupEventListeners();
});

// Check if user is already authenticated
function checkAuthentication() {
    const authData = localStorage.getItem('botAuth');
    const loginModal = document.getElementById('loginModal');
    const mainContainer = document.getElementById('mainContainer');
    
    if (authData) {
        try {
            const { timestamp, authenticated } = JSON.parse(authData);
            const now = Date.now();
                  // Check if session is still valid (30 minutes)
        if (authenticated && (now - timestamp) < SESSION_TIMEOUT) {
            isAuthenticated = true;
            loginModal.style.display = 'none';
            mainContainer.style.display = 'block';
            startSessionTimer();
            addLogoutButton();
            loadConfiguration();
            loadStatuses();
            return;
        }
        } catch (error) {
            console.error('Error parsing auth data:', error);
        }
    }
    
    // Show login modal
    loginModal.style.display = 'flex';
    mainContainer.style.display = 'none';
    isAuthenticated = false;
}

// Handle login
async function handleLogin(event) {
    event.preventDefault();
    
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    const loginBtn = document.querySelector('.login-btn');
    
    if (!password) {
        showLoginError('Please enter a password');
        return;
    }
    
    // Show loading state
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
    loginBtn.disabled = true;
    
    try {
        // Verify password with server
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });

        const result = await response.json();

        if (result.success) {
            // Save authentication state
            localStorage.setItem('botAuth', JSON.stringify({
                authenticated: true,
                timestamp: Date.now()
            }));

            isAuthenticated = true;
            document.getElementById('loginModal').style.display = 'none';
            document.getElementById('mainContainer').style.display = 'block';

            startSessionTimer();
            addLogoutButton();
            loadConfiguration();
            loadStatuses();

            showToast('Login successful!', 'success');
        } else {
            showLoginError(result.message || 'Invalid password');
            // Do not reset password field if login failed
            return;
        }
    } catch (error) {
        console.error('Login error:', error);
        showLoginError('Connection error. Please try again.');
        return;
    } finally {
        // Reset login button
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        loginBtn.disabled = false;
        // Only clear password if login was successful
        if (isAuthenticated) {
            document.getElementById('loginPassword').value = '';
        }
    }
}

// Show login error
function showLoginError(message) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    
    setTimeout(() => {
        errorDiv.classList.remove('show');
    }, 5000);
}

// Toggle password visibility
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('loginPassword');
    const toggleBtn = document.querySelector('.password-toggle i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.className = 'fas fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        toggleBtn.className = 'fas fa-eye';
    }
}

// Start session timer
function startSessionTimer() {
    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(() => {
        logout();
        showToast('Session expired. Please login again.', 'warning');
    }, SESSION_TIMEOUT);
}

// Logout function
function logout() {
    localStorage.removeItem('botAuth');
    isAuthenticated = false;
    clearTimeout(sessionTimer);
    
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('mainContainer').style.display = 'none';
    
    // Clear sensitive data
    currentConfig = {};
    currentStatuses = [];
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
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

// Export functions for global access
window.saveSettings = saveSettings;
window.loadStatuses = loadStatuses;
window.viewStatus = viewStatus;
window.downloadStatus = downloadStatus;
window.deleteStatus = deleteStatus;
window.togglePasswordVisibility = togglePasswordVisibility;
window.handleLogin = handleLogin;
window.logout = logout;

// --- Fix missing function errors ---
function saveSettings() {
    // Save settings from form fields to config and server
    currentConfig.PREFIX = document.getElementById('prefix').value || '.';
    currentConfig.BOT_NAME = document.getElementById('botName').value || 'WhatsApp Bot';
    currentConfig.OWNER_NUMBER = document.getElementById('ownerNumber').value || '';
    localStorage.setItem('botConfig', JSON.stringify(currentConfig));
    updateUI();
    showToast('Settings saved!', 'success');
    // Optionally sync to server
    fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: currentConfig })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            showToast('Settings synced!', 'success');
        }
    }).catch(() => {
        showToast('Settings saved locally', 'warning');
    });
}

function filterStatuses() {
    // Dummy implementation: reload statuses (can be improved)
    loadStatuses();
}

function loadStatuses() {
    // Basic implementation: show loading or placeholder
    const statusGrid = document.getElementById('statusGrid');
    if (!statusGrid) return;
    statusGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading statuses...</div>';
    // TODO: Fetch statuses from server and render them
    // For now, show a placeholder after 1s
    setTimeout(() => {
        statusGrid.innerHTML = '<div class="no-data">No statuses found.</div>';
    }, 1000);
}

function viewStatus(statusId) {
    // Basic implementation: show alert
    showToast(`Viewing status: ${statusId}`, 'info');
    // TODO: Open status in modal or new window
}

function downloadStatus(statusId) {
    // Basic implementation: show alert
    showToast(`Downloading status: ${statusId}`, 'info');
    // TODO: Trigger download from server
}

function deleteStatus(statusId) {
    // Basic implementation: show confirmation
    if (confirm(`Delete status ${statusId}?`)) {
        showToast(`Status ${statusId} deleted`, 'success');
        // TODO: Delete from server and refresh list
    }
}

function showToast(message, type = 'info') {
    // Basic toast implementation
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function addLogoutButton() {
    // Add logout button to header if not already present
    const header = document.querySelector('.header');
    if (!header || header.querySelector('.logout-btn')) return;
    
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'logout-btn';
    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
    logoutBtn.onclick = logout;
    header.appendChild(logoutBtn);
}
