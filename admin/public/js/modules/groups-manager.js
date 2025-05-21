const groupsManager = {
    groupInput: null,
    addGroupBtn: null,
    groupsContainer: null,
    saveGroupsBtn: null,
    // New properties for AI groups
    aiGroupInput: null,
    addAiGroupBtn: null,
    aiGroupsContainer: null,
    saveAiGroupsBtn: null,
    
    init: function() {
        // Initialize download groups elements
        this.groupInput = document.getElementById('group-input');
        this.addGroupBtn = document.getElementById('add-group');
        this.groupsContainer = document.getElementById('groups-container');
        this.saveGroupsBtn = document.getElementById('save-groups');
        
        // Initialize AI groups elements
        this.aiGroupInput = document.getElementById('ai-group-input');
        this.addAiGroupBtn = document.getElementById('add-ai-group');
        this.aiGroupsContainer = document.getElementById('ai-groups-container');
        this.saveAiGroupsBtn = document.getElementById('save-ai-groups');
        
        this.setupEventListeners();
        
        // Load both types of groups
        this.loadGroups();
        this.loadAiGroups();
    },
    
    setupEventListeners: function() {
        // Download groups event listeners
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
        
        // AI groups event listeners
        if (this.addAiGroupBtn && this.aiGroupInput) {
            this.addAiGroupBtn.addEventListener('click', () => {
                const groupId = this.aiGroupInput.value.trim();
                if (groupId) {
                    // Ensure group ID has the right format
                    let formattedGroupId = groupId;
                    if (!formattedGroupId.endsWith('@g.us')) {
                        formattedGroupId += '@g.us';
                    }
                    
                    this.addAiGroupTag(formattedGroupId);
                    this.aiGroupInput.value = '';
                    
                    // Auto-save after adding
                    this.saveAiGroupsToConfig();
                }
            });
            
            this.aiGroupInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addAiGroupBtn.click();
                }
            });
        }
        
        if (this.saveAiGroupsBtn) {
            this.saveAiGroupsBtn.addEventListener('click', async () => {
                this.saveAiGroupsToConfig();
            });
        }
    },
    
    addGroupTag: function(groupId) {
        if (!this.groupsContainer) return;
        groupId = groupId.trim();
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
    },
    
    addAiGroupTag: function(groupId) {
        if (!this.aiGroupsContainer) return;
        groupId = groupId.trim();
        // Check if tag already exists
        const existingTags = Array.from(this.aiGroupsContainer.querySelectorAll('.tag'))
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
            this.saveAiGroupsToConfig();
        });
        
        this.aiGroupsContainer.appendChild(tag);
    },
    
    saveAiGroupsToConfig: function() {
        const groupTags = this.aiGroupsContainer.querySelectorAll('.tag');
        const groupIds = Array.from(groupTags).map(tag => tag.getAttribute('data-id')).join(',');
        
        configManager.updateConfig('AI_ALLOWED_GROUPS', groupIds).then(() => {
            showToast('AI Group settings saved successfully', 'success');
        }).catch(error => {
            showToast('Failed to save AI group settings', 'error');
        });
    },
    
    loadAiGroups: function() {
        if (!this.aiGroupsContainer) return;
        
        // Get AI allowed groups from config
        fetch('/api/config')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const aiGroupsString = data.config.AI_ALLOWED_GROUPS || '';
                    
                    // Clear existing groups
                    this.aiGroupsContainer.innerHTML = '';
                    
                    // Add each group as a tag
                    if (aiGroupsString) {
                        aiGroupsString.split(',').forEach(groupId => {
                            if (groupId.trim()) {
                                this.addAiGroupTag(groupId.trim());
                            }
                        });
                    }
                }
            })
            .catch(error => {
                console.error('Error loading AI groups:', error);
                showToast('Error loading AI group settings', 'error');
            });
    }
};

window.groupsManager = groupsManager;
