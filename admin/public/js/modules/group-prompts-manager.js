/**
 * Group Prompts Manager
 * Handles loading, saving, and managing custom AI prompts for groups
 */

class GroupPromptsManager {
    constructor() {
        // UI Elements - using the correct IDs from the HTML
        this.groupSelect = document.getElementById('groupSelect');
        this.promptText = document.getElementById('promptText');
        this.promptEnabledToggle = document.getElementById('promptEnabled');
        this.saveButton = document.getElementById('savePromptBtn');
        this.deleteButton = document.getElementById('deletePromptBtn');
        this.resetButton = document.getElementById('resetPromptBtn');
        this.promptsTableBody = document.getElementById('promptsTableBody');
        
        // Dashboard section elements (for the card in dashboard)
        this.dashboardGroupSelect = document.getElementById('group-select');
        this.dashboardPromptText = document.getElementById('group-prompt-text');
        this.dashboardPromptEnabledToggle = document.getElementById('group-prompt-enabled-toggle');
        this.dashboardSaveButton = document.getElementById('save-group-prompt');
        this.dashboardDeleteButton = document.getElementById('delete-group-prompt');
        this.dashboardGroupLoading = document.getElementById('group-loading');
        this.dashboardNoGroupsMessage = document.getElementById('no-groups-message');
        
        // Data storage
        this.groups = [];
        this.prompts = [];
        this.currentGroupId = null;
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize the manager
     */
    init() {
        console.log('Group Prompts Manager: initializing');
        
        // Add event listeners for the dedicated section
        if (this.groupSelect) {
            this.groupSelect.addEventListener('change', () => this.handleGroupChange('main'));
            console.log('Group Prompts Manager: groupSelect event listener attached');
        }
        
        if (this.saveButton) {
            this.saveButton.addEventListener('click', () => this.savePrompt('main'));
            console.log('Group Prompts Manager: saveButton event listener attached');
        }
        
        if (this.deleteButton) {
            this.deleteButton.addEventListener('click', () => this.deletePrompt('main'));
            console.log('Group Prompts Manager: deleteButton event listener attached');
        }
        
        if (this.resetButton) {
            this.resetButton.addEventListener('click', () => this.resetPrompt());
            console.log('Group Prompts Manager: resetButton event listener attached');
        }
        
        // Add event listeners for the dashboard section
        if (this.dashboardGroupSelect) {
            this.dashboardGroupSelect.addEventListener('change', () => this.handleGroupChange('dashboard'));
            console.log('Group Prompts Manager: dashboardGroupSelect event listener attached');
        }
        
        if (this.dashboardSaveButton) {
            this.dashboardSaveButton.addEventListener('click', () => this.savePrompt('dashboard'));
            console.log('Group Prompts Manager: dashboardSaveButton event listener attached');
        }
        
        if (this.dashboardDeleteButton) {
            this.dashboardDeleteButton.addEventListener('click', () => this.deletePrompt('dashboard'));
            console.log('Group Prompts Manager: dashboardDeleteButton event listener attached');
        }
        
        // Load groups and prompts
        this.loadGroups();
        this.loadPrompts();
        
        console.log('Group Prompts Manager initialized');
    }
    
    /**
     * Load all groups that the bot is in
     */
    async loadGroups() {
        try {
            this.showLoading(true);
            console.log('Group Prompts Manager: Loading groups');
            
            const response = await fetch('/api/groups');
            if (!response.ok) {
                throw new Error(`Error fetching groups: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.groups = data.groups || [];
                this.populateGroupDropdown();
                
                if (this.groups.length === 0) {
                    this.showNoGroupsMessage(true);
                } else {
                    this.showNoGroupsMessage(false);
                }
                
                console.log(`Group Prompts Manager: Loaded ${this.groups.length} groups`);
            } else {
                console.error('Failed to load groups:', data.message);
                this.showError('Failed to load groups: ' + data.message);
            }
        } catch (error) {
            console.error('Error loading groups:', error);
            this.showError('Error loading groups: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Load all saved group prompts
     */
    async loadPrompts() {
        try {
            const response = await fetch('/api/group-prompts');
            if (!response.ok) {
                throw new Error(`Error fetching prompts: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.prompts = data.prompts || [];
                
                // If we already have a group selected, update the UI
                if (this.currentGroupId) {
                    this.updatePromptUI(this.currentGroupId);
                }
            } else {
                console.error('Failed to load prompts:', data.message);
            }
        } catch (error) {
            console.error('Error loading prompts:', error);
        }
    }
    
    /**
     * Populate the group dropdown with loaded groups
     */
    populateGroupDropdown() {
        console.log('Group Prompts Manager: Populating group dropdowns');
        
        // Populate main section dropdown
        if (this.groupSelect) {
            this.groupSelect.innerHTML = '';
            
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '-- Select a Group --';
            defaultOption.disabled = true;
            defaultOption.selected = true;
            this.groupSelect.appendChild(defaultOption);
            
            this.groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name || group.id;
                this.groupSelect.appendChild(option);
            });
            
            console.log('Group Prompts Manager: Main dropdown populated');
        }
        
        // Populate dashboard dropdown
        if (this.dashboardGroupSelect) {
            this.dashboardGroupSelect.innerHTML = '';
            
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '-- Select a Group --';
            this.dashboardGroupSelect.appendChild(defaultOption);
            
            this.groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name || group.id;
                this.dashboardGroupSelect.appendChild(option);
            });
            
            console.log('Group Prompts Manager: Dashboard dropdown populated');
        }
    }
    
    /**
     * Handle group selection change
     */
    handleGroupChange(source) {
        const selectedGroupId = source === 'main' ? 
            this.groupSelect.value : 
            this.dashboardGroupSelect.value;
        
        console.log(`Group Prompts Manager: Group change from ${source} to ${selectedGroupId}`);
        
        if (!selectedGroupId) {
            // No group selected, hide editor if necessary
            if (source === 'main') {
                // No specific action needed
            } else {
                if (this.dashboardPromptEditor) {
                    this.dashboardPromptEditor.style.display = 'none';
                }
            }
            this.currentGroupId = null;
            return;
        }
        
        this.currentGroupId = selectedGroupId;
        this.updatePromptUI(selectedGroupId, source);
    }
    
    /**
     * Update UI with prompt data for the selected group
     */
    updatePromptUI(groupId, source) {
        console.log(`Group Prompts Manager: Updating ${source} UI for group ${groupId}`);
        
        // Find prompt for this group
        const groupPrompt = this.prompts.find(p => p.groupId === groupId);
        
        if (source === 'main') {
            if (this.promptText && this.promptEnabledToggle) {
                if (groupPrompt) {
                    this.promptText.value = groupPrompt.promptText || '';
                    this.promptEnabledToggle.checked = groupPrompt.enabled || false;
                } else {
                    this.promptText.value = '';
                    this.promptEnabledToggle.checked = false;
                }
            }
        } else {
            // Show the dashboard editor
            if (this.dashboardPromptEditor) {
                this.dashboardPromptEditor.style.display = 'block';
            }
            
            if (this.dashboardPromptText && this.dashboardPromptEnabledToggle) {
                if (groupPrompt) {
                    this.dashboardPromptText.value = groupPrompt.promptText || '';
                    this.dashboardPromptEnabledToggle.checked = groupPrompt.enabled || false;
                } else {
                    this.dashboardPromptText.value = '';
                    this.dashboardPromptEnabledToggle.checked = false;
                }
            }
        }
    }
    
    /**
     * Save the current prompt
     */
    async savePrompt(source) {
        if (!this.currentGroupId) {
            this.showError('No group selected');
            return;
        }
        
        try {
            const promptText = source === 'main' ? 
                this.promptText.value : 
                this.dashboardPromptText.value;
                
            const enabled = source === 'main' ? 
                this.promptEnabledToggle.checked : 
                this.dashboardPromptEnabledToggle.checked;
            
            const promptData = {
                groupId: this.currentGroupId,
                promptText: promptText,
                enabled: enabled
            };
            
            // Find the group name
            const group = this.groups.find(g => g.id === this.currentGroupId);
            if (group) {
                promptData.groupName = group.name || 'Unknown Group';
            }
            
            console.log(`Group Prompts Manager: Saving prompt from ${source}`, promptData);
            
            const response = await fetch('/api/group-prompts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(promptData)
            });
            
            if (!response.ok) {
                throw new Error(`Error saving prompt: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Prompt saved successfully');
                
                // Reload prompts to get the updated list
                this.loadPrompts();
            } else {
                this.showError('Failed to save prompt: ' + data.message);
            }
        } catch (error) {
            console.error('Error saving prompt:', error);
            this.showError('Error saving prompt: ' + error.message);
        }
    }
    
    /**
     * Delete the current prompt
     */
    async deletePrompt(source) {
        if (!this.currentGroupId) {
            this.showError('No group selected');
            return;
        }
        
        // Confirm deletion
        if (!confirm('Are you sure you want to delete this prompt?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/group-prompts/${this.currentGroupId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`Error deleting prompt: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Prompt deleted successfully');
                
                // Reset UI
                if (source === 'main') {
                    this.promptText.value = '';
                    this.promptEnabledToggle.checked = false;
                } else {
                    this.dashboardPromptText.value = '';
                    this.dashboardPromptEnabledToggle.checked = false;
                }
                
                // Reload prompts to get the updated list
                this.loadPrompts();
            } else {
                this.showError('Failed to delete prompt: ' + data.message);
            }
        } catch (error) {
            console.error('Error deleting prompt:', error);
            this.showError('Error deleting prompt: ' + error.message);
        }
    }
    
    /**
     * Show/hide loading indicator
     */
    showLoading(show) {
        if (this.dashboardGroupLoading) {
            this.dashboardGroupLoading.style.display = show ? 'block' : 'none';
        }
    }
    
    /**
     * Show/hide no groups message
     */
    showNoGroupsMessage(show) {
        if (this.dashboardNoGroupsMessage) {
            this.dashboardNoGroupsMessage.style.display = show ? 'block' : 'none';
        }
    }
    
    /**
     * Show success message
     */
    showSuccess(message) {
        // Create a toast or notification
        const event = new CustomEvent('showNotification', {
            detail: {
                message,
                type: 'success'
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * Show error message
     */
    showError(message) {
        // Create a toast or notification
        const event = new CustomEvent('showNotification', {
            detail: {
                message,
                type: 'error'
            }
        });
        document.dispatchEvent(event);
    }
}

// Initialize the manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.groupPromptsManager = new GroupPromptsManager();
});

// Export for use in other modules
export default GroupPromptsManager;
