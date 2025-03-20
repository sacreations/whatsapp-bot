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
            case 'saved-links':
                loadSavedLinks();
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
        
        // New toggle for link saving
        const linkSavingToggle = document.getElementById('link-saving-toggle');
        if (linkSavingToggle) {
            linkSavingToggle.addEventListener('change', async function() {
                await updateConfig('ENABLE_LINK_SAVING', this.checked.toString());
            });
        }
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
    
    // Saved Links functionality
    const refreshLinksBtn = document.getElementById('refresh-links');
    const linksSearch = document.getElementById('links-search');
    const platformFilter = document.getElementById('links-platform-filter');
    const savedLinksContainer = document.getElementById('saved-links-container');
    let allSavedLinks = []; // Store all saved links for filtering
    
    if (refreshLinksBtn) {
        refreshLinksBtn.addEventListener('click', () => {
            loadSavedLinks();
        });
    }
    
    if (linksSearch) {
        linksSearch.addEventListener('input', () => {
            filterSavedLinks();
        });
    }
    
    if (platformFilter) {
        platformFilter.addEventListener('change', () => {
            filterSavedLinks();
        });
    }
    
    async function loadSavedLinks() {
        if (!savedLinksContainer) return;
        
        try {
            savedLinksContainer.innerHTML = '<div class="loading-indicator">Loading saved links...</div>';
            
            const response = await fetch('/api/saved-links');
            
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            
            const data = await response.json();
            
            if (data.success && data.groups) {
                allSavedLinks = data.groups;
                
                if (data.groups.length === 0) {
                    document.getElementById('no-links').style.display = 'block';
                    savedLinksContainer.innerHTML = '';
                } else {
                    document.getElementById('no-links').style.display = 'none';
                    renderSavedLinks(data.groups);
                }
            } else {
                savedLinksContainer.innerHTML = '<div class="error-message">Error loading saved links</div>';
            }
        } catch (error) {
            console.error('Error loading saved links:', error);
            savedLinksContainer.innerHTML = '<div class="error-message">Error loading saved links</div>';
        }
    }
    
    function renderSavedLinks(groups) {
        if (!savedLinksContainer) return;
        
        let html = '<div class="links-container">';
        
        groups.forEach(group => {
            html += `
                <div class="links-group" data-group-id="${group.groupId}">
                    <div class="links-group-header">
                        <div>${group.groupName} (${group.links.length} links)</div>
                        <button class="btn btn-sm btn-danger clear-group-btn" data-group-id="${group.groupId}">
                            <i class="fas fa-trash"></i> Clear All
                        </button>
                    </div>
                    <div class="links-group-body">
            `;
            
            group.links.forEach(link => {
                const date = new Date(link.timestamp).toLocaleDateString();
                const time = new Date(link.timestamp).toLocaleTimeString();
                
                // Create message context if available
                const messageContext = link.messageText ? 
                    `<div class="link-message-context">"${link.messageText.substring(0, 100)}${link.messageText.length > 100 ? '...' : ''}"</div>` : '';
                
                html += `
                    <div class="link-item" data-url="${link.url}" data-platform="${link.platform}">
                        <div class="link-header">
                            <div>
                                <span class="link-platform">${link.platform}</span>
                                <div class="link-title">${link.url}</div>
                                ${messageContext}
                            </div>
                        </div>
                        <div class="link-details">
                            <span><i class="fas fa-user"></i> ${link.senderName || 'Unknown'}</span>
                            <span><i class="fas fa-calendar"></i> ${date}</span>
                            <span><i class="fas fa-clock"></i> ${time}</span>
                        </div>
                        <div class="link-actions">
                            <button class="btn btn-sm btn-primary download-link-btn" data-url="${encodeURIComponent(link.url)}">
                                <i class="fas fa-download"></i> Download & Send
                            </button>
                            <button class="btn btn-sm btn-danger delete-link-btn" data-url="${encodeURIComponent(link.url)}">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        savedLinksContainer.innerHTML = html;
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-link-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const url = e.currentTarget.getAttribute('data-url');
                await deleteLink(url);
            });
        });
        
        // Add event listeners to download buttons const originalText = button.innerHTML;
        document.querySelectorAll('.download-link-btn').forEach(button => {     
            button.addEventListener('click', async (e) => {        // Update button to show processing state
                const url = e.currentTarget.getAttribute('data-url');spinner fa-spin"></i> Processing...`;
                showToast('This feature is only available in the WhatsApp chat. Use .dllink command in WhatsApp.', 'info');
            });
        });
        
        // Add event listeners to clear group buttonsapi/saved-links/download/${url}`, {
        document.querySelectorAll('.clear-group-btn').forEach(button => {       method: 'POST'
            button.addEventListener('click', async (e) => {     });
                const groupId = e.currentTarget.getAttribute('data-group-id');         
                if (confirm('Are you sure you want to delete all saved links for this group?')) {               const data = await response.json();
                    await clearGroupLinks(groupId);                
                }ess) {
            });l be sent to the chat when ready.', 'success');
        });                // Refresh the links to update the view
    }(), 1000);
    
    function filterSavedLinks() {                showToast('Failed to download and send media: ' + data.message, 'error');
        if (!allSavedLinks || allSavedLinks.length === 0) return;
        riginalText;
        const search = linksSearch.value.toLowerCase();
        const platform = platformFilter.value;
        
        const filteredGroups = allSavedLinks.map(group => {('Error sending download request:', error);
            // Filter links within the group   showToast('Error processing download request', 'error');
            const filteredLinks = group.links.filter(link => {    // Restore the button
                // Filter by platformriginalText;
                if (platform !== 'all' && link.platform !== platform) {sabled = false;
                    return false;
                }
                
                // Filter by search term
                if (search) {isteners to clear group buttons
                    return (querySelectorAll('.clear-group-btn').forEach(button => {
                        link.url.toLowerCase().includes(search) ||on.addEventListener('click', async (e) => {
                        (link.senderName && link.senderName.toLowerCase().includes(search)) ||d = e.currentTarget.getAttribute('data-group-id');
                        group.groupName.toLowerCase().includes(search) if (confirm('Are you sure you want to delete all saved links for this group?')) {
                    );        await clearGroupLinks(groupId);
                }
                
                return true;
            });
            
            // Return a new group object with filtered links
            return {if (!allSavedLinks || allSavedLinks.length === 0) return;
                ...group,
                links: filteredLinks
            };
        }).filter(group => group.links.length > 0); // Only keep groups with matching links
        
        if (filteredGroups.length === 0) {
            document.getElementById('no-links').style.display = 'block';   const filteredLinks = group.links.filter(link => {
            savedLinksContainer.innerHTML = '';           // Filter by platform
        } else {            if (platform !== 'all' && link.platform !== platform) {
            document.getElementById('no-links').style.display = 'none';
            renderSavedLinks(filteredGroups);   }
        }
    }er by search term
       if (search) {
    async function deleteLink(encodedUrl) {        return (
        try {
            if (!confirm('Are you sure you want to delete this link?')) {nderName && link.senderName.toLowerCase().includes(search)) ||
                return;         group.groupName.toLowerCase().includes(search)
            }        );
            
            const response = await fetch(`/api/saved-links/${encodedUrl}`, {    
                method: 'DELETE'
            });
            
            const data = await response.json();n a new group object with filtered links
            
            if (data.success) {   ...group,
                showToast('Link deleted successfully', 'success');lteredLinks
                loadSavedLinks(); // Reload the links
            } else { Only keep groups with matching links
                showToast('Failed to delete link', 'error');
            }   if (filteredGroups.length === 0) {
        } catch (error) {        document.getElementById('no-links').style.display = 'block';
            console.error('Error deleting link:', error);';
            showToast('Error deleting link', 'error');e {
        }
    }teredGroups);
    
    async function clearGroupLinks(groupId) {
        try {
            const response = await fetch(`/api/saved-links/group/${groupId}`, {nction deleteLink(encodedUrl) {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {onst response = await fetch(`/api/saved-links/${encodedUrl}`, {
                showToast('All links in the group have been deleted', 'success');DELETE'
                loadSavedLinks(); // Reload the links
            } else {
                showToast('Failed to clear group links', 'error');   const data = await response.json();
            }       
        } catch (error) {        if (data.success) {
            console.error('Error clearing group links:', error);st('Link deleted successfully', 'success');
            showToast('Error clearing group links', 'error'); // Reload the links
        } else {
    }rror');
    
    // Helper functions
    async function loadConfig() {'Error deleting link:', error);
        try {
            console.log('Fetching configuration...');
            const response = await fetch('/api/config', {
                method: 'GET',
                headers: {ion clearGroupLinks(groupId) {
                    'Content-Type': 'application/json',{
                    'Accept': 'application/json'oup/${groupId}`, {
                },    method: 'DELETE'
                credentials: 'same-origin' // Include cookies
            });
            
            console.log('Response status:', response.status);
            f (data.success) {
            if (response.status === 401) {    showToast('All links in the group have been deleted', 'success');
                console.log('Authentication required, redirecting to login'); links
                window.location.href = '/login.html';
                return;    showToast('Failed to clear group links', 'error');
            }
            
            const data = await response.json();ole.error('Error clearing group links:', error);
            console.log('Response data:', data);ng group links', 'error');
            
            if (data.success) {
                const config = data.config;
                
                // Fill form inputsadConfig() {
                Object.entries(config).forEach(([key, value]) => {
                    const input = document.querySelector(`[name="${key}"]`);ole.log('Fetching configuration...');
                    if (input) {wait fetch('/api/config', {
                        input.value = value;
                    }
                });   'Content-Type': 'application/json',
                    'Accept': 'application/json'
                // Set toggles
                if (autoReplyToggle) {
                    autoReplyToggle.checked = config.ENABLE_AUTO_REPLY === 'true';
                }
                s:', response.status);
                if (socialMediaToggle) {
                    socialMediaToggle.checked = config.ENABLE_SOCIAL_MEDIA_DOWNLOAD === 'true';esponse.status === 401) {
                }console.log('Authentication required, redirecting to login');
                n.html';
                if (statusViewToggle) {
                    statusViewToggle.checked = config.ENABLE_AUTO_STATUS_VIEW === 'true';
                }
                 data = await response.json();
                // Set new link saving toggleole.log('Response data:', data);
                const linkSavingToggle = document.getElementById('link-saving-toggle');
                if (linkSavingToggle && config.ENABLE_LINK_SAVING !== undefined) {
                    linkSavingToggle.checked = config.ENABLE_LINK_SAVING === 'true';
                }
                
                // Load group IDskey, value]) => {
                if (groupsContainer) {ame="${key}"]`);
                    groupsContainer.innerHTML = '';) {
                    if (config.ALLOWED_DOWNLOAD_GROUPS) {ut.value = value;
                        config.ALLOWED_DOWNLOAD_GROUPS.split(',').forEach(groupId => {
                            if (groupId.trim()) {);
                                addGroupTag(groupId.trim());
                            }
                        });
                    }       autoReplyToggle.checked = config.ENABLE_AUTO_REPLY === 'true';
                }
            } else {
                console.error('Failed to load configuration:', data.message);
                showToast('Failed to load configuration: ' + data.message, 'error');        socialMediaToggle.checked = config.ENABLE_SOCIAL_MEDIA_DOWNLOAD === 'true';
            }
        } catch (error) {
            console.error('Error loading configuration:', error);le) {
            showToast('Error loading configuration: ' + (error.message || 'Unknown error'), 'error');BLE_AUTO_STATUS_VIEW === 'true';
            
            // Redirect to login if appropriate   
            if (error.message && error.message.includes('Authentication required')) {       // Set new link saving toggle
                setTimeout(() => {           const linkSavingToggle = document.getElementById('link-saving-toggle');
                    window.location.href = '/login.html';            if (linkSavingToggle && config.ENABLE_LINK_SAVING !== undefined) {
                }, 2000);= config.ENABLE_LINK_SAVING === 'true';
            }   }
        }
    }
    
    async function updateConfig(key, value) {        groupsContainer.innerHTML = '';
        try {ALLOWED_DOWNLOAD_GROUPS) {
            // Get current config firstLOAD_GROUPS.split(',').forEach(groupId => {
            const response = await fetch('/api/config');pId.trim()) {
            const data = await response.json();                addGroupTag(groupId.trim());
            
            if (data.success) {
                const config = data.config;
                config[key] = value;
                
                // Send updated configsole.error('Failed to load configuration:', data.message);
                const updateResponse = await fetch('/api/config', {showToast('Failed to load configuration: ' + data.message, 'error');
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },(error) {
                    body: JSON.stringify({ config })configuration:', error);
                });| 'Unknown error'), 'error');
                
                const updateData = await updateResponse.json();
                rror.message && error.message.includes('Authentication required')) {
                if (updateData.success) {imeout(() => {
                    showToast(`Successfully updated ${key}`, 'success');
                } else {   }, 2000);
                    showToast(`Failed to update ${key}: ${updateData.message}`, 'error');
                }
            } else {
                showToast('Failed to fetch current configuration', 'error');
            }async function updateConfig(key, value) {
        } catch (error) {
            showToast(`Error updating ${key}`, 'error');
        }h('/api/config');
    }    const data = await response.json();
    
    async function loadChatLogs() {
        const chatLogsContainer = document.getElementById('chat-logs-container');    const config = data.config;
        if (!chatLogsContainer) return;
        
        try {    // Send updated config
            chatLogsContainer.innerHTML = '<div class="loading-indicator">Loading logs...</div>';it fetch('/api/config', {
            
            const limit = logsLimitSelect ? logsLimitSelect.value : 100;ders: { 'Content-Type': 'application/json' },
            const response = await fetch(`/api/chat-logs?limit=${limit}`);       body: JSON.stringify({ config })
                });
            if (response.status === 401) {
                window.location.href = '/login.html';    const updateData = await updateResponse.json();
                return;
            }
                showToast(`Successfully updated ${key}`, 'success');
            const data = await response.json();
            rror');
            if (data.success && data.logs) {
                renderChatLogs(data.logs);
                howToast('Failed to fetch current configuration', 'error');
                // Apply current filter
                const activeFilter = document.querySelector('.filter-btn.active');
                if (activeFilter) {howToast(`Error updating ${key}`, 'error');
                    applyChatLogFilter(activeFilter.getAttribute('data-filter'));
                }
            } else {
                chatLogsContainer.innerHTML = '<div class="error-message">Failed to load chat logs</div>'; function loadChatLogs() {
            }   const chatLogsContainer = document.getElementById('chat-logs-container');
        } catch (error) {    if (!chatLogsContainer) return;
            console.error('Error loading chat logs:', error);
            chatLogsContainer.innerHTML = '<div class="error-message">Error loading chat logs</div>';
        } = '<div class="loading-indicator">Loading logs...</div>';
    }    
     ? logsLimitSelect.value : 100;
    function renderChatLogs(logs) {
        const chatLogsContainer = document.getElementById('chat-logs-container');
        if (!chatLogsContainer) return;   if (response.status === 401) {
                window.location.href = '/login.html';
        if (!logs || logs.length === 0) {;
            chatLogsContainer.innerHTML = '<div class="no-logs-message">No chat logs available</div>';    }
            return;
        }
        
        let html = '';
            renderChatLogs(data.logs);
        logs.forEach(log => {
            const timestamp = new Date(log.timestamp);
            const timeStr = timestamp.toLocaleTimeString();erySelector('.filter-btn.active');
            const dateStr = timestamp.toLocaleDateString();
                   applyChatLogFilter(activeFilter.getAttribute('data-filter'));
            // Determine sender display name    }
            let senderDisplay = log.fromMe ? 'Bot' : formatPhoneNumber(log.sender);
            if (log.senderName && !log.fromMe) { '<div class="error-message">Failed to load chat logs</div>';
                senderDisplay = `${log.senderName} (${formatPhoneNumber(log.sender)})`;
            }
            console.error('Error loading chat logs:', error);
            // Create CSS classes for filteringiv class="error-message">Error loading chat logs</div>';
            let classes = ['chat-log-entry'];
            classes.push(log.isGroup ? 'group' : 'private');
            classes.push(log.fromMe ? 'from-me' : 'from-user');
            renderChatLogs(logs) {
            if (log.messageType === 'text') {t chatLogsContainer = document.getElementById('chat-logs-container');
                classes.push('type-text');
            } else {
                classes.push('type-media');!logs || logs.length === 0) {
            }L = '<div class="no-logs-message">No chat logs available</div>';
            
            // Prepare content - render media if available
            let contentHtml = '';
            
            // Show media if available
            if (log.media && log.media.data) {{
                if (log.media.type === 'image' || log.media.type === 'sticker') { timestamp = new Date(log.timestamp);
                    contentHtml += `<div class="chat-media">onst timeStr = timestamp.toLocaleTimeString();
                        <img src="data:${log.media.mimeType};base64,${log.media.data}" const dateStr = timestamp.toLocaleDateString();
                             alt="${log.media.type}" class="chat-media-img" />
                    </div>`;
                }
            }mMe) {
            erDisplay = `${log.senderName} (${formatPhoneNumber(log.sender)})`;
            // Add text content}
            contentHtml += `<div class="chat-text">
                ${log.messageType !== 'text' ? `<span class="media-tag">${log.messageType}</span>` : ''}
                ${escapeHtml(log.content)}
            </div>`;
            
            html += `
                <div class="${classes.join(' ')}">
                    <div class="chat-log-header">t');
                        <span class="chat-log-sender ${log.fromMe ? 'bot' : ''}">${senderDisplay}</span>
                        <span class="chat-log-time">${timeStr} - ${dateStr}</span>s.push('type-media');
                    </div>
                    <div class="chat-log-content"> 
                        ${contentHtml}    // Prepare content - render media if available
                    </div>
                </div>       
            `;        // Show media if available
        });{
        'sticker') {
        chatLogsContainer.innerHTML = html;            contentHtml += `<div class="chat-media">
    }="data:${log.media.mimeType};base64,${log.media.data}" 
    "${log.media.type}" class="chat-media-img" />
    function applyChatLogFilter(filterType) {;
        const allLogs = document.querySelectorAll('.chat-log-entry');
        
        allLogs.forEach(log => {
            switch (filterType) {
                case 'all': `<div class="chat-text">
                    log.style.display = 'block';Type !== 'text' ? `<span class="media-tag">${log.messageType}</span>` : ''}
                    break;
                case 'text':
                    log.style.display = log.classList.contains('type-text') ? 'block' : 'none';
                    break;
                case 'media':="${classes.join(' ')}">
                    log.style.display = log.classList.contains('type-media') ? 'block' : 'none';"chat-log-header">
                    break;lay}</span>
                case 'group':pan class="chat-log-time">${timeStr} - ${dateStr}</span>
                    log.style.display = log.classList.contains('group') ? 'block' : 'none';       </div>
                    break;         <div class="chat-log-content">
                case 'private':                   ${contentHtml}
                    log.style.display = log.classList.contains('private') ? 'block' : 'none';                </div>
                    break;
            }
        });});
    }
    = html;
    function formatPhoneNumber(number) {
        if (!number) return 'Unknown';
        r(filterType) {
        // Remove the WhatsApp suffix if presentment.querySelectorAll('.chat-log-entry');
        return number.split('@')[0];
    }
    
    function escapeHtml(str) {
        if (!str) return '';y = 'block';
        return str
            .replace(/&/g, '&amp;')           case 'text':
            .replace(/</g, '&lt;')                log.style.display = log.classList.contains('type-text') ? 'block' : 'none';
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');            log.style.display = log.classList.contains('type-media') ? 'block' : 'none';
    }
    
    function addGroupTag(groupId) {'block' : 'none';
        if (!groupsContainer) return;            break;
        
        // Check if tag already existstains('private') ? 'block' : 'none';
        const existingTags = Array.from(groupsContainer.querySelectorAll('.tag')) break;
                                 .map(tag => tag.getAttribute('data-id'));   }
        });
        if (existingTags.includes(groupId)) {
            showToast('Group ID already added', 'error');
            return;
        }rn 'Unknown';
        
        const tag = document.createElement('div');
        tag.className = 'tag';turn number.split('@')[0];
        tag.setAttribute('data-id', groupId);
        tag.innerHTML = `
            <span>${groupId}</span>
            <span class="remove-tag"><i class="fas fa-times"></i></span>'';
        `;
        ')
        const removeBtn = tag.querySelector('.remove-tag'); .replace(/</g, '&lt;')
        removeBtn.addEventListener('click', () => {    .replace(/>/g, '&gt;')
            tag.remove();
            // Auto-save after removing       .replace(/'/g, '&#039;');
            saveGroupsToConfig();}
        });
        
        groupsContainer.appendChild(tag);
    }
    
    function loadDashboard() {uerySelectorAll('.tag'))
        // Get dashboard stats from the server .map(tag => tag.getAttribute('data-id'));
        fetch('/api/dashboard-stats')
            .then(response => {Id)) {
                if (response.status === 401) {owToast('Group ID already added', 'error');
                    window.location.href = '/login.html';
                    return null;
                }
                return response.json(); = document.createElement('div');
            })sName = 'tag';
            .then(data => {
                if (!data || !data.success) {
                    throw new Error(data?.message || 'Failed to load dashboard data');
                }
                
                // Update dashboard stats with real data
                document.getElementById('groups-count').textContent = data.stats.groupsCount;.querySelector('.remove-tag');
                document.getElementById('plugins-count').textContent = data.stats.pluginsCount;
                document.getElementById('downloads-count').textContent = data.stats.downloadsCount;
                document.getElementById('uptime').textContent = data.stats.uptime;
            })
            .catch(error => {
                console.error('Error loading dashboard stats:', error);
                // Show error but don't redirect - just use placeholder text for the statsntainer.appendChild(tag);
                document.getElementById('groups-count').textContent = 'Error';
                document.getElementById('plugins-count').textContent = 'Error';
                document.getElementById('downloads-count').textContent = 'Error';adDashboard() {
                document.getElementById('uptime').textContent = 'Error';   // Get dashboard stats from the server
                    fetch('/api/dashboard-stats')
                // Show toast notification
                showToast('Failed to load dashboard statistics', 'error');
            });location.href = '/login.html';
    }            return null;
    
    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
               if (!data || !data.success) {
        toast.textContent = message;            throw new Error(data?.message || 'Failed to load dashboard data');
        toast.className = 'toast show';
        if (type) {
            toast.classList.add(type);/ Update dashboard stats with real data
        }           document.getElementById('groups-count').textContent = data.stats.groupsCount;
                     document.getElementById('plugins-count').textContent = data.stats.pluginsCount;
        setTimeout(() => {                document.getElementById('downloads-count').textContent = data.stats.downloadsCount;





});    }        }, 3000);            toast.classList.remove('show');                document.getElementById('uptime').textContent = data.stats.uptime;
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
