document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sectionLinks = document.querySelectorAll('.sidebar-nav li');
    const sections = document.querySelectorAll('.content-section');
    const sectionTitle = document.getElementById('section-title');
    const logoutBtn = document.getElementById('logout-btn');
    const configForm = document.getElementById('config-form');
    const autoReplyToggle = document.getElementById('auto-reply-toggle');
    const socialMediaToggle = document.getElementById('social-media-toggle');
    const statusViewToggle = document.getElementById('status-view-toggle');
    const groupInput = document.getElementById('group-input');
    const addGroupBtn = document.getElementById('add-group');
    const groupsContainer = document.getElementById('groups-container');
    const saveGroupsBtn = document.getElementById('save-groups');
    
    // Toggle sidebar (for mobile)
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }
    
    // Load data based on active section
    function loadSectionData(sectionId) {
        switch(sectionId) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'chat-logs':
                loadChatLogs();
                break;
            case 'statuses':
                loadStatuses();
                break;
            // Add other section data loading as needed
        }
    }
    
    // Tab navigation - updated to load section-specific data
    sectionLinks.forEach(link => {
        link.addEventListener('click', function() {
            // Update active tab
            sectionLinks.forEach(el => el.classList.remove('active'));
            this.classList.add('active');
            
            // Show active section
            const sectionId = this.getAttribute('data-section');
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === sectionId) {
                    section.classList.add('active');
                    sectionTitle.textContent = this.textContent.trim();
                    // Load section-specific data
                    loadSectionData(sectionId);
                }
            });
            
            // Hide sidebar on mobile after selection
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('show');
            }
        });
    });
    
    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            try {
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = '/login.html';
            } catch (error) {
                showToast('Error logging out. Please try again.', 'error');
            }
        });
    }
    
    // Load configuration
    loadConfig();
    
    // Load dashboard data - only load on initial page load
    if (document.querySelector('.sidebar-nav li.active').getAttribute('data-section') === 'dashboard') {
        loadDashboard();
    }
    
    // Load chat logs
    loadChatLogs();
    
    // Save configuration
    if (configForm) {
        configForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(configForm);
            const config = {};
            
            for (const [key, value] of formData.entries()) {
                config[key] = value;
            }
            
            try {
                const response = await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ config })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showToast('Configuration saved successfully!', 'success');
                } else {
                    showToast('Failed to save configuration: ' + data.message, 'error');
                }
            } catch (error) {
                showToast('Error saving configuration', 'error');
            }
        });
    }
    
    // Toggle features
    if (autoReplyToggle && socialMediaToggle && statusViewToggle) {
        autoReplyToggle.addEventListener('change', async function() {
            await updateConfig('ENABLE_AUTO_REPLY', this.checked.toString());
        });
        
        socialMediaToggle.addEventListener('change', async function() {
            await updateConfig('ENABLE_SOCIAL_MEDIA_DOWNLOAD', this.checked.toString());
        });
        
        statusViewToggle.addEventListener('change', async function() {
            await updateConfig('ENABLE_AUTO_STATUS_VIEW', this.checked.toString());
        });
    }
    
    // Add group ID
    if (addGroupBtn && groupInput) {
        addGroupBtn.addEventListener('click', function() {
            const groupId = groupInput.value.trim();
            if (groupId) {
                // Ensure group ID has the right format
                let formattedGroupId = groupId;
                if (!formattedGroupId.endsWith('@g.us')) {
                    formattedGroupId += '@g.us';
                }
                
                addGroupTag(formattedGroupId);
                groupInput.value = '';
                
                // Auto-save after adding
                saveGroupsToConfig();
            }
        });
        
        groupInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addGroupBtn.click();
            }
        });
    }
    
    // Save group IDs
    if (saveGroupsBtn) {
        saveGroupsBtn.addEventListener('click', async function() {
            saveGroupsToConfig();
        });
    }
    
    // Function to save groups to config
    function saveGroupsToConfig() {
        const groupTags = document.querySelectorAll('.tag');
        const groupIds = Array.from(groupTags).map(tag => tag.getAttribute('data-id')).join(',');
        
        updateConfig('ALLOWED_DOWNLOAD_GROUPS', groupIds).then(() => {
            showToast('Group settings saved successfully', 'success');
        }).catch(error => {
            showToast('Failed to save group settings', 'error');
        });
    }
    
    // Chat logs functionality
    const refreshLogsBtn = document.getElementById('refresh-logs');
    const logsLimitSelect = document.getElementById('logs-limit');
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    if (refreshLogsBtn) {
        refreshLogsBtn.addEventListener('click', () => {
            loadChatLogs();
        });
    }
    
    if (logsLimitSelect) {
        logsLimitSelect.addEventListener('change', () => {
            loadChatLogs();
        });
    }
    
    if (filterBtns) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // Update active state
                filterBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                // Apply filter
                const filterType = this.getAttribute('data-filter');
                applyChatLogFilter(filterType);
            });
        });
    }
    
    // Status viewer functionality
    const refreshStatusesBtn = document.getElementById('refresh-statuses');
    const statusFilter = document.getElementById('status-filter');
    const contactSearch = document.getElementById('contact-search');
    const statusSort = document.getElementById('status-sort');
    const statusGrid = document.getElementById('status-grid');
    let allStatuses = []; // Store all statuses for filtering
    
    if (refreshStatusesBtn) {
        refreshStatusesBtn.addEventListener('click', () => {
            loadStatuses();
        });
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            filterAndSortStatuses();
        });
    }
    
    if (contactSearch) {
        contactSearch.addEventListener('input', () => {
            filterAndSortStatuses();
        });
    }
    
    if (statusSort) {
        statusSort.addEventListener('change', () => {
            filterAndSortStatuses();
        });
    }
    
    async function loadStatuses() {
        if (!statusGrid) return;
        
        try {
            statusGrid.innerHTML = '<div class="loading-indicator">Loading statuses...</div>';
            
            const response = await fetch('/api/statuses');
            
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            
            const data = await response.json();
            
            if (data.success && data.statuses) {
                allStatuses = data.statuses;
                
                if (allStatuses.length === 0) {
                    document.getElementById('no-statuses').style.display = 'block';
                    statusGrid.innerHTML = '';
                } else {
                    document.getElementById('no-statuses').style.display = 'none';
                    renderStatuses(allStatuses);
                }
            } else {
                statusGrid.innerHTML = '<div class="error-message">Failed to load statuses</div>';
            }
        } catch (error) {
            console.error('Error loading statuses:', error);
            statusGrid.innerHTML = '<div class="error-message">Error loading statuses</div>';
        }
    }
    
    function renderStatuses(statuses) {
        if (!statusGrid) return;
        
        let html = '<div class="status-grid">';
        
        statuses.forEach(status => {
            const date = new Date(status.timestamp);
            const formattedDate = date.toLocaleDateString();
            const formattedTime = date.toLocaleTimeString();
            
            // Use contact name if available, otherwise use contactId
            const contactDisplay = status.contactName || status.contactId;
            
            html += `
                <div class="status-card" data-id="${status.id}" data-contact="${status.contactId}" data-type="${status.type}">
                    <div class="status-preview">
                        ${status.type === 'video' ? 
                            `<video src="${status.url}" controls class="status-media"></video>` : 
                            `<img src="${status.url}" class="status-media" alt="Status image">`
                        }
                    </div>
                    <div class="status-info">
                        <div class="status-contact">
                            <i class="fas fa-user"></i> ${contactDisplay}
                        </div>
                        <div class="status-number">
                            <i class="fas fa-phone"></i> ${status.contactId}
                        </div>
                        <div class="status-date">
                            <i class="fas fa-calendar"></i> ${formattedDate}
                        </div>
                        <div class="status-time">
                            <i class="fas fa-clock"></i> ${formattedTime}
                        </div>
                    </div>
                    <div class="status-actions">
                        <a href="${status.url}" download="${status.id}" class="btn btn-sm btn-primary">
                            <i class="fas fa-download"></i> Download
                        </a>
                        <button class="btn btn-sm btn-danger delete-status" data-id="${status.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        statusGrid.innerHTML = html;
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-status').forEach(button => {
            button.addEventListener('click', async (e) => {
                const statusId = e.currentTarget.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this status?')) {
                    await deleteStatus(statusId);
                }
            });
        });
    }
    
    function filterAndSortStatuses() {
        if (!allStatuses || allStatuses.length === 0) return;
        
        // Apply filters
        let filtered = [...allStatuses];
        
        // Filter by type (image/video)
        const typeFilter = statusFilter.value;
        if (typeFilter !== 'all') {
            filtered = filtered.filter(status => status.type === typeFilter);
        }
        
        // Filter by contact search
        const search = contactSearch.value.toLowerCase();
        if (search) {
            filtered = filtered.filter(status => 
                (status.contactName && status.contactName.toLowerCase().includes(search)) || 
                status.contactId.toLowerCase().includes(search)
            );
        }
        
        // Apply sorting
        const sortMethod = statusSort.value;
        if (sortMethod === 'oldest') {
            filtered.sort((a, b) => a.timestamp - b.timestamp);
        } else {
            filtered.sort((a, b) => b.timestamp - a.timestamp);
        }
        
        // Update view
        if (filtered.length === 0) {
            statusGrid.innerHTML = '<div class="no-results">No matching statuses found</div>';
        } else {
            renderStatuses(filtered);
        }
    }
    
    async function deleteStatus(statusId) {
        try {
            const response = await fetch(`/api/statuses/${encodeURIComponent(statusId)}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('Status deleted successfully', 'success');
                // Remove from the allStatuses array
                allStatuses = allStatuses.filter(status => status.id !== statusId);
                filterAndSortStatuses(); // Re-render the list
            } else {
                showToast('Failed to delete status: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error deleting status:', error);
            showToast('Error deleting status', 'error');
        }
    }
    
    // Helper functions
    async function loadConfig() {
        try {
            console.log('Fetching configuration...');
            const response = await fetch('/api/config', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'same-origin' // Include cookies
            });
            
            console.log('Response status:', response.status);
            
            if (response.status === 401) {
                console.log('Authentication required, redirecting to login');
                window.location.href = '/login.html';
                return;
            }
            
            const data = await response.json();
            console.log('Response data:', data);
            
            if (data.success) {
                const config = data.config;
                
                // Fill form inputs
                Object.entries(config).forEach(([key, value]) => {
                    const input = document.querySelector(`[name="${key}"]`);
                    if (input) {
                        input.value = value;
                    }
                });
                
                // Set toggles
                if (autoReplyToggle) {
                    autoReplyToggle.checked = config.ENABLE_AUTO_REPLY === 'true';
                }
                
                if (socialMediaToggle) {
                    socialMediaToggle.checked = config.ENABLE_SOCIAL_MEDIA_DOWNLOAD === 'true';
                }
                
                if (statusViewToggle) {
                    statusViewToggle.checked = config.ENABLE_AUTO_STATUS_VIEW === 'true';
                }
                
                // Load group IDs
                if (groupsContainer) {
                    groupsContainer.innerHTML = '';
                    if (config.ALLOWED_DOWNLOAD_GROUPS) {
                        config.ALLOWED_DOWNLOAD_GROUPS.split(',').forEach(groupId => {
                            if (groupId.trim()) {
                                addGroupTag(groupId.trim());
                            }
                        });
                    }
                }
            } else {
                console.error('Failed to load configuration:', data.message);
                showToast('Failed to load configuration: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
            showToast('Error loading configuration: ' + (error.message || 'Unknown error'), 'error');
            
            // Redirect to login if appropriate
            if (error.message && error.message.includes('Authentication required')) {
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
            }
        }
    }
    
    async function updateConfig(key, value) {
        try {
            // Get current config first
            const response = await fetch('/api/config');
            const data = await response.json();
            
            if (data.success) {
                const config = data.config;
                config[key] = value;
                
                // Send updated config
                const updateResponse = await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ config })
                });
                
                const updateData = await updateResponse.json();
                
                if (updateData.success) {
                    showToast(`Successfully updated ${key}`, 'success');
                } else {
                    showToast(`Failed to update ${key}: ${updateData.message}`, 'error');
                }
            } else {
                showToast('Failed to fetch current configuration', 'error');
            }
        } catch (error) {
            showToast(`Error updating ${key}`, 'error');
        }
    }
    
    async function loadChatLogs() {
        const chatLogsContainer = document.getElementById('chat-logs-container');
        if (!chatLogsContainer) return;
        
        try {
            chatLogsContainer.innerHTML = '<div class="loading-indicator">Loading logs...</div>';
            
            const limit = logsLimitSelect ? logsLimitSelect.value : 100;
            const response = await fetch(`/api/chat-logs?limit=${limit}`);
            
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            
            const data = await response.json();
            
            if (data.success && data.logs) {
                renderChatLogs(data.logs);
                
                // Apply current filter
                const activeFilter = document.querySelector('.filter-btn.active');
                if (activeFilter) {
                    applyChatLogFilter(activeFilter.getAttribute('data-filter'));
                }
            } else {
                chatLogsContainer.innerHTML = '<div class="error-message">Failed to load chat logs</div>';
            }
        } catch (error) {
            console.error('Error loading chat logs:', error);
            chatLogsContainer.innerHTML = '<div class="error-message">Error loading chat logs</div>';
        }
    }
    
    function renderChatLogs(logs) {
        const chatLogsContainer = document.getElementById('chat-logs-container');
        if (!chatLogsContainer) return;
        
        if (!logs || logs.length === 0) {
            chatLogsContainer.innerHTML = '<div class="no-logs-message">No chat logs available</div>';
            return;
        }
        
        let html = '';
        
        logs.forEach(log => {
            const timestamp = new Date(log.timestamp);
            const timeStr = timestamp.toLocaleTimeString();
            const dateStr = timestamp.toLocaleDateString();
            
            // Determine sender display name
            let senderDisplay = log.fromMe ? 'Bot' : formatPhoneNumber(log.sender);
            if (log.senderName && !log.fromMe) {
                senderDisplay = `${log.senderName} (${formatPhoneNumber(log.sender)})`;
            }
            
            // Create CSS classes for filtering
            let classes = ['chat-log-entry'];
            classes.push(log.isGroup ? 'group' : 'private');
            classes.push(log.fromMe ? 'from-me' : 'from-user');
            
            if (log.messageType === 'text') {
                classes.push('type-text');
            } else {
                classes.push('type-media');
            }
            
            // Prepare content - render media if available
            let contentHtml = '';
            
            // Show media if available
            if (log.media && log.media.data) {
                if (log.media.type === 'image' || log.media.type === 'sticker') {
                    contentHtml += `<div class="chat-media">
                        <img src="data:${log.media.mimeType};base64,${log.media.data}" 
                             alt="${log.media.type}" class="chat-media-img" />
                    </div>`;
                }
            }
            
            // Add text content
            contentHtml += `<div class="chat-text">
                ${log.messageType !== 'text' ? `<span class="media-tag">${log.messageType}</span>` : ''}
                ${escapeHtml(log.content)}
            </div>`;
            
            html += `
                <div class="${classes.join(' ')}">
                    <div class="chat-log-header">
                        <span class="chat-log-sender ${log.fromMe ? 'bot' : ''}">${senderDisplay}</span>
                        <span class="chat-log-time">${timeStr} - ${dateStr}</span>
                    </div>
                    <div class="chat-log-content">
                        ${contentHtml}
                    </div>
                </div>
            `;
        });
        
        chatLogsContainer.innerHTML = html;
    }
    
    function applyChatLogFilter(filterType) {
        const allLogs = document.querySelectorAll('.chat-log-entry');
        
        allLogs.forEach(log => {
            switch (filterType) {
                case 'all':
                    log.style.display = 'block';
                    break;
                case 'text':
                    log.style.display = log.classList.contains('type-text') ? 'block' : 'none';
                    break;
                case 'media':
                    log.style.display = log.classList.contains('type-media') ? 'block' : 'none';
                    break;
                case 'group':
                    log.style.display = log.classList.contains('group') ? 'block' : 'none';
                    break;
                case 'private':
                    log.style.display = log.classList.contains('private') ? 'block' : 'none';
                    break;
            }
        });
    }
    
    function formatPhoneNumber(number) {
        if (!number) return 'Unknown';
        
        // Remove the WhatsApp suffix if present
        return number.split('@')[0];
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    function addGroupTag(groupId) {
        if (!groupsContainer) return;
        
        // Check if tag already exists
        const existingTags = Array.from(groupsContainer.querySelectorAll('.tag'))
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
            saveGroupsToConfig();
        });
        
        groupsContainer.appendChild(tag);
    }
    
    function loadDashboard() {
        // Get dashboard stats from the server
        fetch('/api/dashboard-stats')
            .then(response => {
                if (response.status === 401) {
                    window.location.href = '/login.html';
                    return null;
                }
                return response.json();
            })
            .then(data => {
                if (!data || !data.success) {
                    throw new Error(data?.message || 'Failed to load dashboard data');
                }
                
                // Update dashboard stats with real data
                document.getElementById('groups-count').textContent = data.stats.groupsCount;
                document.getElementById('plugins-count').textContent = data.stats.pluginsCount;
                document.getElementById('downloads-count').textContent = data.stats.downloadsCount;
                document.getElementById('uptime').textContent = data.stats.uptime;
            })
            .catch(error => {
                console.error('Error loading dashboard stats:', error);
                // Show error but don't redirect - just use placeholder text for the stats
                document.getElementById('groups-count').textContent = 'Error';
                document.getElementById('plugins-count').textContent = 'Error';
                document.getElementById('downloads-count').textContent = 'Error';
                document.getElementById('uptime').textContent = 'Error';
                
                // Show toast notification
                showToast('Failed to load dashboard statistics', 'error');
            });
    }
    
    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = 'toast show';
        if (type) {
            toast.classList.add(type);
        }
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
});
