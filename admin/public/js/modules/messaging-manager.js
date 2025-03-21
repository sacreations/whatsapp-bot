const messagingManager = {
    recipientTypeSelect: null,
    groupRecipientSelect: null,
    individualRecipientSelect: null,
    groupContainer: null,
    individualContainer: null,
    messageTextArea: null,
    mediaInput: null,
    mediaPreview: null,
    messageForm: null,
    refreshContactsBtn: null,
    recentMessagesContainer: null,
    manualPhoneNumber: null,
    groups: [],
    contacts: [],
    
    init: function() {
        this.recipientTypeSelect = document.getElementById('recipient-type');
        this.groupRecipientSelect = document.getElementById('group-recipient');
        this.individualRecipientSelect = document.getElementById('individual-recipient');
        this.groupContainer = document.getElementById('group-recipient-container');
        this.individualContainer = document.getElementById('individual-recipient-container');
        this.messageTextArea = document.getElementById('message-text');
        this.mediaInput = document.getElementById('message-media');
        this.mediaPreview = document.getElementById('media-preview');
        this.messageForm = document.getElementById('message-form');
        this.refreshContactsBtn = document.getElementById('refresh-contacts');
        this.recentMessagesContainer = document.getElementById('recent-messages');
        this.manualPhoneNumber = document.getElementById('manual-phone-number');
        
        this.setupEventListeners();
        this.loadContacts();
    },
    
    setupEventListeners: function() {
        if (this.recipientTypeSelect) {
            this.recipientTypeSelect.addEventListener('change', () => {
                this.toggleRecipientContainer();
            });
        }
        
        if (this.refreshContactsBtn) {
            this.refreshContactsBtn.addEventListener('click', () => {
                this.loadContacts();
            });
        }
        
        if (this.mediaInput) {
            this.mediaInput.addEventListener('change', () => {
                this.handleMediaPreview();
            });
        }
        
        if (this.messageForm) {
            this.messageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }
    },
    
    toggleRecipientContainer: function() {
        const type = this.recipientTypeSelect.value;
        
        if (type === 'group') {
            this.groupContainer.style.display = 'block';
            this.individualContainer.style.display = 'none';
        } else {
            this.groupContainer.style.display = 'none';
            this.individualContainer.style.display = 'block';
        }
    },
    
    loadContacts: async function() {
        try {
            this.groupRecipientSelect.innerHTML = '<option value="">Loading groups...</option>';
            this.individualRecipientSelect.innerHTML = '<option value="">Loading contacts...</option>';
            
            const response = await fetch('/api/contacts');
            
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.groups = data.groups || [];
                this.contacts = data.contacts || [];
                
                this.renderGroupOptions();
                this.renderContactOptions();
            } else {
                showToast('Failed to load contacts: ' + data.message, 'error');
                this.groupRecipientSelect.innerHTML = '<option value="">Error loading groups</option>';
                this.individualRecipientSelect.innerHTML = '<option value="">Error loading contacts</option>';
            }
        } catch (error) {
            console.error('Error loading contacts:', error);
            showToast('Error loading contacts: ' + error.message, 'error');
            this.groupRecipientSelect.innerHTML = '<option value="">Error loading groups</option>';
            this.individualRecipientSelect.innerHTML = '<option value="">Error loading contacts</option>';
        }
    },
    
    renderGroupOptions: function() {
        if (this.groups.length === 0) {
            this.groupRecipientSelect.innerHTML = '<option value="">No groups available</option>';
            return;
        }
        
        let options = '<option value="">Select a group...</option>';
        
        this.groups.forEach(group => {
            options += `<option value="${group.id}">${group.name}</option>`;
        });
        
        this.groupRecipientSelect.innerHTML = options;
    },
    
    renderContactOptions: function() {
        if (this.contacts.length === 0) {
            this.individualRecipientSelect.innerHTML = '<option value="">No contacts available</option>';
            return;
        }
        
        let options = '<option value="">Select a contact...</option>';
        
        this.contacts.forEach(contact => {
            options += `<option value="${contact.id}">${contact.name}</option>`;
        });
        
        this.individualRecipientSelect.innerHTML = options;
    },
    
    handleMediaPreview: function() {
        const file = this.mediaInput.files[0];
        this.mediaPreview.innerHTML = '';
        
        if (!file) return;
        
        const fileReader = new FileReader();
        
        fileReader.onload = (e) => {
            const fileType = file.type.split('/')[0];
            
            if (fileType === 'image') {
                this.mediaPreview.innerHTML = `
                    <div class="preview-item">
                        <img src="${e.target.result}" alt="Preview" class="preview-image">
                        <div class="preview-name">${file.name}</div>
                    </div>
                `;
            } else if (fileType === 'video') {
                this.mediaPreview.innerHTML = `
                    <div class="preview-item">
                        <video src="${e.target.result}" controls class="preview-video"></video>
                        <div class="preview-name">${file.name}</div>
                    </div>
                `;
            } else if (fileType === 'audio') {
                this.mediaPreview.innerHTML = `
                    <div class="preview-item">
                        <audio src="${e.target.result}" controls class="preview-audio"></audio>
                        <div class="preview-name">${file.name}</div>
                    </div>
                `;
            } else {
                this.mediaPreview.innerHTML = `
                    <div class="preview-item">
                        <div class="preview-file">
                            <i class="fas fa-file"></i>
                        </div>
                        <div class="preview-name">${file.name}</div>
                    </div>
                `;
            }
        };
        
        fileReader.readAsDataURL(file);
    },
    
    sendMessage: async function() {
        try {
            const recipientType = this.recipientTypeSelect.value;
            let recipientId = '';
            
            if (recipientType === 'group') {
                recipientId = this.groupRecipientSelect.value;
                if (!recipientId) {
                    return showToast('Please select a group', 'error');
                }
            } else {
                // Check if a contact is selected from dropdown or manual number is entered
                const selectedContact = this.individualRecipientSelect.value;
                const manualNumber = this.manualPhoneNumber.value.trim();
                
                if (selectedContact) {
                    // Use selected contact from dropdown
                    recipientId = selectedContact;
                } else if (manualNumber) {
                    // Use manually entered number
                    // Ensure it doesn't already have the @s.whatsapp.net suffix
                    recipientId = manualNumber.includes('@') ? manualNumber : `${manualNumber}@s.whatsapp.net`;
                } else {
                    return showToast('Please select a contact or enter a phone number', 'error');
                }
            }
            
            const messageText = this.messageTextArea.value;
            const mediaFile = this.mediaInput.files[0];
            
            if (!messageText && !mediaFile) {
                return showToast('Please enter a message or attach media', 'error');
            }
            
            // Show loading state
            const sendBtn = document.getElementById('send-message-btn');
            const originalBtnText = sendBtn.innerHTML;
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            sendBtn.disabled = true;
            
            // Create form data for submission (to handle files)
            const formData = new FormData();
            formData.append('recipientType', recipientType);
            formData.append('recipientId', recipientId);
            formData.append('message', messageText);
            
            if (mediaFile) {
                formData.append('media', mediaFile);
            }
            
            // Send the message
            const response = await fetch('/api/send-message', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            // Restore button state
            sendBtn.innerHTML = originalBtnText;
            sendBtn.disabled = false;
            
            if (data.success) {
                showToast('Message sent successfully', 'success');
                
                // Reset form
                this.messageForm.reset();
                this.mediaPreview.innerHTML = '';
                
                // Get recipient name for display
                let recipientName = 'Unknown';
                if (recipientType === 'group') {
                    const group = this.groups.find(g => g.id === recipientId);
                    if (group) recipientName = group.name;
                } else if (selectedContact) {
                    const contact = this.contacts.find(c => c.id === recipientId);
                    if (contact) recipientName = contact.name;
                } else {
                    // For manual number, just show the number
                    recipientName = manualNumber;
                }
                
                // Add to recent messages
                this.addToRecentMessages(recipientType, recipientId, messageText, mediaFile, recipientName);
            } else {
                showToast('Failed to send message: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            document.getElementById('send-message-btn').innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
            document.getElementById('send-message-btn').disabled = false;
            showToast('Error sending message: ' + error.message, 'error');
        }
    },
    
    addToRecentMessages: function(recipientType, recipientId, messageText, mediaFile, recipientName = 'Unknown') {
        const timestamp = new Date().toLocaleString();
        
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = 'recent-message';
        
        // Show media info if any
        const mediaInfo = mediaFile ? 
            `<div class="message-media-info">
                <i class="fas fa-${mediaFile.type.includes('image') ? 'image' : mediaFile.type.includes('video') ? 'video' : 'file'}"></i>
                ${mediaFile.name}
            </div>` : '';
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-recipient">To: ${recipientName} (${recipientType})</span>
                <span class="message-time">${timestamp}</span>
            </div>
            <div class="message-content">${messageText}</div>
            ${mediaInfo}
        `;
        
        // Clear "no messages" text if present
        if (this.recentMessagesContainer.querySelector('.text-muted')) {
            this.recentMessagesContainer.innerHTML = '';
        }
        
        // Add to container (at the top)
        this.recentMessagesContainer.insertBefore(messageElement, this.recentMessagesContainer.firstChild);
    }
};

window.messagingManager = messagingManager;
