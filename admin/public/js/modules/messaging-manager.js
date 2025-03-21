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
            console.log('Loading contacts and groups...');
            this.groupRecipientSelect.innerHTML = '<option value="">Loading groups...</option>';
            this.individualRecipientSelect.innerHTML = '<option value="">Loading contacts...</option>';
            
            const response = await fetch('/api/contacts');
            
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            
            const data = await response.json();
            console.log('Contacts API response:', data);
            
            if (data.success) {
                this.groups = data.groups || [];
                this.contacts = data.contacts || [];
                
                console.log(`Loaded ${this.groups.length} groups and ${this.contacts.length} contacts`);
                
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
        console.log(`Rendering ${this.groups.length} groups`);
        
        if (this.groups.length === 0) {
            this.groupRecipientSelect.innerHTML = '<option value="">No groups available</option>';
            return;
        }
        
        let options = '<option value="">Select a group...</option>';
        
        this.groups.forEach(group => {
            console.log(`Adding group: ${group.name} (${group.id})`);
            options += `<option value="${group.id}">${group.name}</option>`;
        });
        
        this.groupRecipientSelect.innerHTML = options;
    },
    
    renderContactOptions: function() {
        console.log(`Rendering ${this.contacts.length} contacts`);
        
        // Always start with empty and manual entry options
        let options = '<option value="">Select a contact...</option>';
        options += '<option value="manual-entry">-- Manual Number Entry --</option>';
        
        // Add all contacts
        this.contacts.forEach(contact => {
            console.log(`Adding contact: ${contact.name} (${contact.id})`);
            options += `<option value="${contact.id}">${contact.name}</option>`;
        });
        
        this.individualRecipientSelect.innerHTML = options;
        
        // Make sure the manual number container exists and is styled properly
        const manualNumberContainer = document.querySelector('.manual-number-container');
        if (manualNumberContainer) {
            // Make sure it's visible
            manualNumberContainer.style.display = 'block';
            
            // Add the OR divider for clarity
            if (!manualNumberContainer.classList.contains('with-divider')) {
                manualNumberContainer.classList.add('with-divider');
            }
        }
        
        // Set up the event listener for the manual entry option
        // Remove any existing event listener first to avoid duplicates
        const oldSelect = this.individualRecipientSelect;
        const newSelect = oldSelect.cloneNode(true);
        oldSelect.parentNode.replaceChild(newSelect, oldSelect);
        this.individualRecipientSelect = newSelect;
        
        // Add the event listener
        this.individualRecipientSelect.addEventListener('change', () => {
            const manualNumberContainer = document.querySelector('.manual-number-container');
            if (this.individualRecipientSelect.value === 'manual-entry') {
                manualNumberContainer.classList.add('manual-entry-active');
                // Focus on the input field
                setTimeout(() => {
                    this.manualPhoneNumber.focus();
                }, 100);
            } else {
                manualNumberContainer.classList.remove('manual-entry-active');
            }
        });
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
            let recipientName = 'Unknown';
            
            console.log(`Preparing to send ${recipientType} message`);
            
            if (recipientType === 'group') {
                recipientId = this.groupRecipientSelect.value;
                console.log(`Selected group ID: ${recipientId}`);
                
                if (!recipientId) {
                    return showToast('Please select a group', 'error');
                }
                
                // Get group name for display
                const group = this.groups.find(g => g.id === recipientId);
                if (group) {
                    recipientName = group.name;
                    console.log(`Found group name: ${recipientName}`);
                }
            } else {
                // Check both dropdown and manual entry
                const selectedContact = this.individualRecipientSelect.value;
                const manualNumber = this.manualPhoneNumber.value.trim();
                
                console.log(`Selected contact: ${selectedContact}`);
                console.log(`Manual number: ${manualNumber}`);
                
                if (selectedContact === 'manual-entry') {
                    // Using manual entry
                    if (!manualNumber) {
                        return showToast('Please enter a phone number', 'error');
                    }
                    
                    // Ensure it doesn't already have the @s.whatsapp.net suffix
                    recipientId = manualNumber.includes('@') ? manualNumber : `${manualNumber}@s.whatsapp.net`;
                    recipientName = manualNumber; // Use number as name
                    console.log(`Using manual number: ${recipientId}`);
                } else if (selectedContact) {
                    // Using selected contact from dropdown
                    recipientId = selectedContact;
                    
                    // Get contact name for display
                    const contact = this.contacts.find(c => c.id === recipientId);
                    if (contact) {
                        recipientName = contact.name;
                        console.log(`Found contact name: ${recipientName}`);
                    }
                } else {
                    return showToast('Please select a contact or enter a phone number', 'error');
                }
            }
            
            const messageText = this.messageTextArea.value;
            const mediaFile = this.mediaInput.files[0];
            
            if (!messageText && !mediaFile) {
                return showToast('Please enter a message or attach media', 'error');
            }
            
            console.log(`Sending message to ${recipientId} (${recipientName})`);
            
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
                console.log(`Attaching media: ${mediaFile.name} (${mediaFile.type})`);
            }
            
            // Send the message
            console.log('Submitting message to server...');
            const response = await fetch('/api/send-message', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            console.log('Server response:', data);
            
            // Restore button state
            sendBtn.innerHTML = originalBtnText;
            sendBtn.disabled = false;
            
            if (data.success) {
                showToast('Message sent successfully', 'success');
                
                // Reset form
                this.messageForm.reset();
                this.mediaPreview.innerHTML = '';
                
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
