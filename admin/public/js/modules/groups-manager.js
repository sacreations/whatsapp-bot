const groupsManager = {
    groupInput: null,
    addGroupBtn: null,
    groupsContainer: null,
    saveGroupsBtn: null,
    
    init: function() {
        this.groupInput = document.getElementById('group-input');
        this.addGroupBtn = document.getElementById('add-group');
        this.groupsContainer = document.getElementById('groups-container');
        this.saveGroupsBtn = document.getElementById('save-groups');
        
        this.setupEventListeners();
    },
    
    setupEventListeners: function() {
        if (this.addGroupBtn && this.groupInput) {
            this.addGroupBtn.addEventListener('click', () => {
                const groupId = this.groupInput.value.trim();
                if (groupId) {
                    // Ensure group ID has the right format
                    let formattedGroupId = groupId;
                    if (!formattedGroupId.endsWith('@g.us')) {
                        formattedGroupId += '@g.us';
                    }
                    
                    this.addGroupTag(formattedGroupId);
                    this.groupInput.value = '';
                    
                    // Auto-save after adding
                    this.saveGroupsToConfig();
                }
            });
            
            this.groupInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addGroupBtn.click();
                }
            });
        }
        
        if (this.saveGroupsBtn) {
            this.saveGroupsBtn.addEventListener('click', async () => {
                this.saveGroupsToConfig();
            });
        }
    },
    
    addGroupTag: function(groupId) {
        if (!this.groupsContainer) return;
        
        // Check if tag already exists
        const existingTags = Array.from(this.groupsContainer.querySelectorAll('.tag'))
                                 .map(tag => tag.getAttribute('data-id'));
        if (existingTags.includes(groupId)) {
            showToast('Group ID already added', 'error');
            return;
        }
        
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.setAttribute('data-id', groupId);
        tag.innerHTML = `
            <span>${groupId}</span>
            <span class="remove-tag"><i class="fas fa-times"></i></span>
        `;
        
        const removeBtn = tag.querySelector('.remove-tag');
        removeBtn.addEventListener('click', () => {
            tag.remove();
            // Auto-save after removing
            this.saveGroupsToConfig();
        });
        
        this.groupsContainer.appendChild(tag);
    },
    
    saveGroupsToConfig: function() {
        const groupTags = this.groupsContainer.querySelectorAll('.tag');
        const groupIds = Array.from(groupTags).map(tag => tag.getAttribute('data-id')).join(',');
        
        configManager.updateConfig('ALLOWED_DOWNLOAD_GROUPS', groupIds).then(() => {
            showToast('Group settings saved successfully', 'success');
        }).catch(error => {
            showToast('Failed to save group settings', 'error');
        });
    },
    
    loadGroups: function(groupsString) {
        if (!this.groupsContainer) return;
        
        // Clear existing groups
        this.groupsContainer.innerHTML = '';
        
        // Add each group as a tag
        if (groupsString) {
            groupsString.split(',').forEach(groupId => {
                if (groupId.trim()) {
                    this.addGroupTag(groupId.trim());
                }
            });
        }
    }
};

window.groupsManager = groupsManager;
