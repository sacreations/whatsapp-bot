const statusUpdater = {
    statusForm: null,
    statusMediaInput: null,
    statusPreviewContainer: null,
    statusCaption: null,
    postButton: null,
    recentStatusContainer: null,
    
    init: function() {
        this.statusForm = document.getElementById('status-update-form');
        this.statusMediaInput = document.getElementById('status-media');
        this.statusPreviewContainer = document.getElementById('status-preview');
        this.statusCaption = document.getElementById('status-caption');
        this.postButton = document.getElementById('post-status-btn');
        this.recentStatusContainer = document.getElementById('recent-status-updates');
        
        this.setupEventListeners();
        this.loadRecentStatusUpdates();
    },
    
    setupEventListeners: function() {
        if (this.statusForm) {
            this.statusForm.addEventListener('submit', this.handleStatusSubmit.bind(this));
        }
        
        if (this.statusMediaInput) {
            this.statusMediaInput.addEventListener('change', this.handleMediaPreview.bind(this));
        }
    },
    
    handleMediaPreview: function(e) {
        // Clear previous preview
        this.statusPreviewContainer.innerHTML = '';
        
        const file = e.target.files[0];
        if (!file) return;
        
        // File size validation (15MB max)
        const maxSize = 15 * 1024 * 1024; // 15MB in bytes
        if (file.size > maxSize) {
            showToast('File size exceeds 15MB limit', 'error');
            this.statusMediaInput.value = '';
            return;
        }
        
        const fileReader = new FileReader();
        
        fileReader.onload = (event) => {
            const fileUrl = event.target.result;
            const fileType = file.type;
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            
            if (fileType.startsWith('image/')) {
                const img = document.createElement('img');
                img.className = 'preview-image';
                img.src = fileUrl;
                previewItem.appendChild(img);
            } else if (fileType.startsWith('video/')) {
                const video = document.createElement('video');
                video.className = 'preview-video';
                video.src = fileUrl;
                video.controls = true;
                video.autoplay = false;
                video.muted = true;
                previewItem.appendChild(video);
            }
            
            const fileInfo = document.createElement('div');
            fileInfo.className = 'preview-name';
            fileInfo.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
            previewItem.appendChild(fileInfo);
            
            this.statusPreviewContainer.appendChild(previewItem);
        };
        
        fileReader.readAsDataURL(file);
    },
    
    handleStatusSubmit: async function(e) {
        e.preventDefault();
        
        if (!this.statusMediaInput.files || !this.statusMediaInput.files[0]) {
            showToast('Please select a media file to upload', 'error');
            return;
        }
        
        // Disable button and show loading state
        this.postButton.disabled = true;
        this.postButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        
        const formData = new FormData();
        formData.append('statusMedia', this.statusMediaInput.files[0]);
        formData.append('caption', this.statusCaption.value || '');
        
        try {
            const response = await fetch('/api/status/update', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('Status posted successfully!', 'success');
                this.statusForm.reset();
                this.statusPreviewContainer.innerHTML = '';
                this.loadRecentStatusUpdates(); // Reload the recent status list
            } else {
                showToast('Failed to post status: ' + data.message, 'error');
            }
        } catch (error) {
            showToast('Error posting status: ' + error.message, 'error');
        } finally {
            // Reset button state
            this.postButton.disabled = false;
            this.postButton.innerHTML = '<i class="fas fa-share-square"></i> Post Status';
        }
    },
    
    loadRecentStatusUpdates: async function() {
        try {
            const response = await fetch('/api/status/recent');
            const data = await response.json();
            
            if (data.success) {
                const statusList = document.querySelector('.status-updates-list');
                
                if (data.statuses && data.statuses.length > 0) {
                    statusList.innerHTML = '';
                    
                    data.statuses.forEach(status => {
                        const statusItem = document.createElement('div');
                        statusItem.className = 'recent-message';
                        
                        const statusHeader = document.createElement('div');
                        statusHeader.className = 'message-header';
                        
                        const statusTime = document.createElement('span');
                        statusTime.className = 'message-time';
                        statusTime.textContent = new Date(status.timestamp).toLocaleString();
                        
                        statusHeader.appendChild(statusTime);
                        statusItem.appendChild(statusHeader);
                        
                        if (status.caption) {
                            const statusCaption = document.createElement('div');
                            statusCaption.className = 'message-content';
                            statusCaption.textContent = status.caption;
                            statusItem.appendChild(statusCaption);
                        }
                        
                        const statusInfo = document.createElement('div');
                        statusInfo.className = 'message-media-info';
                        statusInfo.innerHTML = `<i class="fas fa-${status.type === 'image' ? 'image' : 'video'}-"></i> ${status.type} status update`;
                        statusItem.appendChild(statusInfo);
                        
                        statusList.appendChild(statusItem);
                    });
                } else {
                    statusList.innerHTML = '<p class="text-muted">No recent status updates.</p>';
                }
            }
        } catch (error) {
            console.error('Error loading recent status updates:', error);
        }
    }
};

window.statusUpdater = statusUpdater;
