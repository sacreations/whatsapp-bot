const contactsManager = {
    contactForm: null,
    contactNumber: null,
    contactName: null,
    contactId: null,
    saveContactBtn: null,
    clearFormBtn: null,
    refreshContactsBtn: null,
    contactsSearch: null,
    contactsList: null,
    contacts: [],
    
    init: function() {
        this.contactForm = document.getElementById('contact-form');
        this.contactNumber = document.getElementById('contact-number');
        this.contactName = document.getElementById('contact-name');
        this.contactId = document.getElementById('contact-id');
        this.saveContactBtn = document.getElementById('save-contact-btn');
        this.clearFormBtn = document.getElementById('clear-contact-form');
        this.refreshContactsBtn = document.getElementById('refresh-contacts-list');
        this.contactsSearch = document.getElementById('contacts-search');
        this.contactsList = document.getElementById('contacts-list');
        
        this.setupEventListeners();
        this.loadContacts();
    },
    
    setupEventListeners: function() {
        if (this.contactForm) {
            this.contactForm.addEventListener('submit', this.handleContactSubmit.bind(this));
        }
        
        if (this.clearFormBtn) {
            this.clearFormBtn.addEventListener('click', this.clearForm.bind(this));
        }
        
        if (this.refreshContactsBtn) {
            this.refreshContactsBtn.addEventListener('click', this.loadContacts.bind(this));
        }
        
        if (this.contactsSearch) {
            this.contactsSearch.addEventListener('input', this.filterContacts.bind(this));
        }
    },
    
    loadContacts: async function() {
        try {
            if (!this.contactsList) return;
            
            this.contactsList.innerHTML = '<div class="loading-indicator">Loading contacts...</div>';
            
            const response = await fetch('/api/custom-contacts');
            
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.contacts = data.contacts || [];
                this.renderContacts();
            } else {
                showToast('Failed to load contacts: ' + data.message, 'error');
                this.contactsList.innerHTML = '<div class="error-message">Error loading contacts</div>';
            }
        } catch (error) {
            console.error('Error loading contacts:', error);
            showToast('Error loading contacts: ' + error.message, 'error');
            this.contactsList.innerHTML = '<div class="error-message">Error loading contacts</div>';
        }
    },
    
    renderContacts: function() {
        if (!this.contactsList) return;
        
        if (this.contacts.length === 0) {
            this.contactsList.innerHTML = '<div class="no-data-message">No contacts found. Add your first contact above.</div>';
            return;
        }
        
        let html = '<div class="contacts-table">';
        
        html += `
            <div class="contact-row header">
                <div class="contact-cell">Phone Number</div>
                <div class="contact-cell">Name</div>
                <div class="contact-cell">Actions</div>
            </div>
        `;
        
        this.contacts.forEach(contact => {
            html += `
                <div class="contact-row" data-id="${contact.id}">
                    <div class="contact-cell">${contact.number}</div>
                    <div class="contact-cell">${contact.name}</div>
                    <div class="contact-cell actions">
                        <button class="btn btn-sm edit-contact" data-id="${contact.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-contact" data-id="${contact.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        this.contactsList.innerHTML = html;
        
        // Add event listeners
        document.querySelectorAll('.edit-contact').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                this.editContact(id);
            });
        });
        
        document.querySelectorAll('.delete-contact').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                this.deleteContact(id);
            });
        });
    },
    
    handleContactSubmit: async function(e) {
        e.preventDefault();
        
        const number = this.contactNumber.value.trim();
        const name = this.contactName.value.trim();
        const id = this.contactId.value;
        
        if (!number || !name) {
            showToast('Please enter both phone number and name', 'error');
            return;
        }
        
        // Format the phone number (remove spaces, hyphens, etc.)
        const formattedNumber = number.replace(/[\s-+()]/g, '');
        
        try {
            const saveBtn = this.saveContactBtn;
            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            saveBtn.disabled = true;
            
            const payload = {
                number: formattedNumber,
                name: name
            };
            
            if (id) {
                payload.id = id;
            }
            
            const response = await fetch('/api/custom-contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
            
            if (data.success) {
                showToast('Contact saved successfully', 'success');
                this.clearForm();
                this.loadContacts();
            } else {
                showToast('Failed to save contact: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error saving contact:', error);
            this.saveContactBtn.innerHTML = '<i class="fas fa-save"></i> Save Contact';
            this.saveContactBtn.disabled = false;
            showToast('Error saving contact: ' + error.message, 'error');
        }
    },
    
    editContact: function(id) {
        const contact = this.contacts.find(c => c.id === id);
        if (!contact) return;
        
        this.contactNumber.value = contact.number;
        this.contactName.value = contact.name;
        this.contactId.value = contact.id;
        
        // Change button text
        this.saveContactBtn.innerHTML = '<i class="fas fa-save"></i> Update Contact';
        
        // Scroll to form
        this.contactForm.scrollIntoView({ behavior: 'smooth' });
    },
    
    deleteContact: async function(id) {
        if (!confirm('Are you sure you want to delete this contact?')) return;
        
        try {
            const response = await fetch(`/api/custom-contacts/${id}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('Contact deleted successfully', 'success');
                this.loadContacts();
                
                // If currently editing this contact, clear the form
                if (this.contactId.value === id) {
                    this.clearForm();
                }
            } else {
                showToast('Failed to delete contact: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error deleting contact:', error);
            showToast('Error deleting contact: ' + error.message, 'error');
        }
    },
    
    clearForm: function() {
        this.contactNumber.value = '';
        this.contactName.value = '';
        this.contactId.value = '';
        this.saveContactBtn.innerHTML = '<i class="fas fa-save"></i> Save Contact';
    },
    
    filterContacts: function() {
        const searchTerm = this.contactsSearch.value.toLowerCase();
        
        if (!searchTerm) {
            this.renderContacts();
            return;
        }
        
        const filteredContacts = this.contacts.filter(contact => 
            contact.name.toLowerCase().includes(searchTerm) || 
            contact.number.toLowerCase().includes(searchTerm)
        );
        
        // Save original contacts
        const originalContacts = this.contacts;
        
        // Temporarily set filtered contacts and render
        this.contacts = filteredContacts;
        this.renderContacts();
        
        // Restore original contacts
        this.contacts = originalContacts;
    }
};

window.contactsManager = contactsManager;
