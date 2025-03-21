const privacyManager = {
    // UI Elements
    profilePicturePrivacy: null,
    profilePictureUpload: null,
    uploadProfilePictureBtn: null,
    lastSeenPrivacy: null,
    hideOnlineStatus: null,
    aboutPrivacy: null,
    aboutText: null,
    updateAboutBtn: null,
    disableReadReceipts: null,
    groupsPrivacy: null,
    statusPrivacy: null,
    savePrivacySettingsBtn: null,
    privacySettingsStatus: null,
    
    init: function() {
        // Initialize UI element references
        this.profilePicturePrivacy = document.getElementById('profile-picture-privacy');
        this.profilePictureUpload = document.getElementById('profile-picture-upload');
        this.uploadProfilePictureBtn = document.getElementById('upload-profile-picture');
        this.lastSeenPrivacy = document.getElementById('last-seen-privacy');
        this.hideOnlineStatus = document.getElementById('hide-online-status');
        this.aboutPrivacy = document.getElementById('about-privacy');
        this.aboutText = document.getElementById('about-text');
        this.updateAboutBtn = document.getElementById('update-about');
        this.disableReadReceipts = document.getElementById('disable-read-receipts');
        this.groupsPrivacy = document.getElementById('groups-privacy');
        this.statusPrivacy = document.getElementById('status-privacy');
        this.savePrivacySettingsBtn = document.getElementById('save-privacy-settings');
        this.privacySettingsStatus = document.getElementById('privacy-settings-status');
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial privacy settings
        this.loadPrivacySettings();
    },
    
    setupEventListeners: function() {
        // Profile picture upload
        if (this.uploadProfilePictureBtn && this.profilePictureUpload) {
            this.uploadProfilePictureBtn.addEventListener('click', this.handleProfilePictureUpload.bind(this));
        }
        
        // About text update
        if (this.updateAboutBtn && this.aboutText) {
            this.updateAboutBtn.addEventListener('click', this.handleAboutUpdate.bind(this));
        }
        
        // Save all privacy settings
        if (this.savePrivacySettingsBtn) {
            this.savePrivacySettingsBtn.addEventListener('click', this.handleSavePrivacySettings.bind(this));
        }
        
        // Real-time toggle of online status
        if (this.hideOnlineStatus) {
            this.hideOnlineStatus.addEventListener('change', async function() {
                try {
                    const response = await fetch('/api/whatsapp/privacy/online-status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ hidden: this.checked })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        showToast('Online status setting updated', 'success');
                    } else {
                        showToast(data.message || 'Failed to update online status setting', 'error');
                        // Revert toggle if update failed
                        this.checked = !this.checked;
                    }
                } catch (error) {
                    console.error('Error updating online status setting:', error);
                    showToast('Error updating online status setting', 'error');
                    // Revert toggle if update failed
                    this.checked = !this.checked;
                }
            });
        }
        
        // Real-time toggle of read receipts
        if (this.disableReadReceipts) {
            this.disableReadReceipts.addEventListener('change', async function() {
                try {
                    const response = await fetch('/api/whatsapp/privacy/read-receipts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ disabled: this.checked })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        showToast('Read receipts setting updated', 'success');
                    } else {
                        showToast(data.message || 'Failed to update read receipts setting', 'error');
                        // Revert toggle if update failed
                        this.checked = !this.checked;
                    }
                } catch (error) {
                    console.error('Error updating read receipts setting:', error);
                    showToast('Error updating read receipts setting', 'error');
                    // Revert toggle if update failed
                    this.checked = !this.checked;
                }
            });
        }
    },
    
    loadPrivacySettings: async function() {
        try {
            const response = await fetch('/api/whatsapp/privacy');
            
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            
            const data = await response.json();
            
            if (data.success) {
                const settings = data.settings;
                
                // Update UI with loaded settings
                if (this.profilePicturePrivacy) {
                    this.profilePicturePrivacy.value = settings.profilePicture || 'all';
                }
                
                if (this.lastSeenPrivacy) {
                    this.lastSeenPrivacy.value = settings.lastSeen || 'all';
                }
                
                if (this.hideOnlineStatus) {
                    this.hideOnlineStatus.checked = settings.hideOnlineStatus === true;
                }
                
                if (this.aboutPrivacy) {
                    this.aboutPrivacy.value = settings.about.privacy || 'all';
                }
                
                if (this.aboutText) {
                    this.aboutText.value = settings.about.text || '';
                }
                
                if (this.disableReadReceipts) {
                    this.disableReadReceipts.checked = settings.disableReadReceipts === true;
                }
                
                if (this.groupsPrivacy) {
                    this.groupsPrivacy.value = settings.groups || 'all';
                }
                
                if (this.statusPrivacy) {
                    this.statusPrivacy.value = settings.status || 'all';
                }
            } else {
                showToast('Failed to load privacy settings: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error loading privacy settings:', error);
            showToast('Error loading privacy settings', 'error');
        }
    },
    
    handleProfilePictureUpload: async function() {
        if (!this.profilePictureUpload.files || !this.profilePictureUpload.files[0]) {
            showToast('Please select an image to upload', 'error');
            return;
        }
        
        const file = this.profilePictureUpload.files[0];
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            showToast('Please select a valid image file', 'error');
            return;
        }
        
        try {
            // Create FormData object to send the file
            const formData = new FormData();
            formData.append('profilePicture', file);
            
            // Update button state
            this.uploadProfilePictureBtn.disabled = true;
            this.uploadProfilePictureBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
            
            // Send request to update profile picture
            const response = await fetch('/api/whatsapp/privacy/profile-picture', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            // Restore button state
            this.uploadProfilePictureBtn.disabled = false;
            this.uploadProfilePictureBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Picture';
            
            if (data.success) {
                showToast('Profile picture updated successfully', 'success');
                this.profilePictureUpload.value = ''; // Clear the file input
            } else {
                showToast('Failed to update profile picture: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error updating profile picture:', error);
            
            // Restore button state
            this.uploadProfilePictureBtn.disabled = false;
            this.uploadProfilePictureBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Picture';
            
            showToast('Error updating profile picture', 'error');
        }
    },
    
    handleAboutUpdate: async function() {
        const aboutText = this.aboutText.value.trim();
        
        if (!aboutText) {
            showToast('Please enter about text', 'error');
            return;
        }
        
        try {
            // Update button state
            this.updateAboutBtn.disabled = true;
            this.updateAboutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            
            // Send request to update about text
            const response = await fetch('/api/whatsapp/privacy/about', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: aboutText })
            });
            
            const data = await response.json();
            
            // Restore button state
            this.updateAboutBtn.disabled = false;
            this.updateAboutBtn.innerHTML = '<i class="fas fa-save"></i> Update About';
            
            if (data.success) {
                showToast('About text updated successfully', 'success');
            } else {
                showToast('Failed to update about text: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error updating about text:', error);
            
            // Restore button state
            this.updateAboutBtn.disabled = false;
            this.updateAboutBtn.innerHTML = '<i class="fas fa-save"></i> Update About';
            
            showToast('Error updating about text', 'error');
        }
    },
    
    handleSavePrivacySettings: async function() {
        try {
            // Update status message
            this.setStatusMessage('Saving privacy settings...', '');
            
            // Prepare privacy settings data
            const settings = {
                profilePicture: this.profilePicturePrivacy.value,
                lastSeen: this.lastSeenPrivacy.value,
                hideOnlineStatus: this.hideOnlineStatus.checked,
                about: {
                    privacy: this.aboutPrivacy.value,
                    // Don't include text here as it's updated separately
                },
                disableReadReceipts: this.disableReadReceipts.checked,
                groups: this.groupsPrivacy.value,
                status: this.statusPrivacy.value
            };
            
            // Update button state
            this.savePrivacySettingsBtn.disabled = true;
            this.savePrivacySettingsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            
            // Send request to update privacy settings
            const response = await fetch('/api/whatsapp/privacy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings })
            });
            
            const data = await response.json();
            
            // Restore button state
            this.savePrivacySettingsBtn.disabled = false;
            this.savePrivacySettingsBtn.innerHTML = '<i class="fas fa-save"></i> Save Privacy Settings';
            
            if (data.success) {
                this.setStatusMessage('Privacy settings saved successfully!', 'success');
                showToast('Privacy settings saved successfully', 'success');
            } else {
                this.setStatusMessage('Failed to save privacy settings: ' + data.message, 'error');
                showToast('Failed to save privacy settings: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error saving privacy settings:', error);
            
            // Restore button state
            this.savePrivacySettingsBtn.disabled = false;
            this.savePrivacySettingsBtn.innerHTML = '<i class="fas fa-save"></i> Save Privacy Settings';
            
            this.setStatusMessage('Error saving privacy settings', 'error');
            showToast('Error saving privacy settings', 'error');
        }
    },
    
    setStatusMessage: function(message, type) {
        if (this.privacySettingsStatus) {
            this.privacySettingsStatus.textContent = message;
            this.privacySettingsStatus.className = type; // Clear previous classes
        }
    }
};

window.privacyManager = privacyManager;
