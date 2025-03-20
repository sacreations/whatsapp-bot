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
            savedLinksContainer.innerHTML = '<div class="loading-indicator">Loading saved links...</div>';
            const response = await fetch('/api/saved-links');
            const response = await fetch('/api/saved-links');
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;location.href = '/login.html';
            }   return;
            }
            const data = await response.json();
            const data = await response.json();
            if (data.success && data.groups) {ived:', data);
                allSavedLinks = data.groups;
                data.success && data.groups) {
                if (data.groups.length === 0) {
                    document.getElementById('no-links').style.display = 'block';
                    savedLinksContainer.innerHTML = '';
                } else {ole.log('No saved links found');
                    document.getElementById('no-links').style.display = 'none';;
                    renderSavedLinks(data.groups);= '';
                } else {
            } else {console.log(`Rendering ${data.groups.length} groups with saved links`);
                savedLinksContainer.innerHTML = '<div class="error-message">Error loading saved links</div>';
                    renderSavedLinks(data.groups);
                }
            } else {
                console.error('Error in links data:', data);
                savedLinksContainer.innerHTML = '<div class="error-message">Error loading saved links: ' + 
                    (data.message || 'Unknown error') + '</div>';
            }
        } catch (error) {
            console.error('Error loading saved links:', error);
            savedLinksContainer.innerHTML = '<div class="error-message">Error loading saved links: ' + 
                (error.message || 'Unknown error') + '</div>';
        }    console.log(`Rendering ${groups.length} groups with saved links`);
    }
    = '<div class="links-container">';
    function renderSavedLinks(groups) {
        if (!savedLinksContainer) return;
        
        let html = '<div class="links-container">';
        
        groups.forEach(group => {${group.groupName} (${group.links.length} links)</div>
            html += `  <button class="btn btn-sm btn-danger clear-group-btn" data-group-id="${group.groupId}">
                <div class="links-group" data-group-id="${group.groupId}">rash"></i> Clear All
                    <div class="links-group-header">              </button>
                        <div>${group.groupName} (${group.links.length} links)</div>            </div>
                        <button class="btn btn-sm btn-danger clear-group-btn" data-group-id="${group.groupId}">-group-body">
                            <i class="fas fa-trash"></i> Clear All
                        </button>
                    </div>group.links.forEach(link => {
                    <div class="links-group-body">mp).toLocaleDateString();
            `;toLocaleTimeString();
            
            group.links.forEach(link => {    // Create message context if available
                const date = new Date(link.timestamp).toLocaleDateString(); messageContext = link.messageText ? 
                const time = new Date(link.timestamp).toLocaleTimeString();link.messageText.length > 100 ? '...' : ''}"</div>` : '';
                
                // Create message context if available
                const messageContext = link.messageText ? ="${link.platform}">
                    `<div class="link-message-context">"${link.messageText.substring(0, 100)}${link.messageText.length > 100 ? '...' : ''}"</div>` : '';
                
                html += `  <span class="link-platform">${link.platform}</span>
                    <div class="link-item" data-url="${link.url}" data-platform="${link.platform}">      <div class="link-title">${link.url}</div>
                        <div class="link-header">xt}
                            <div>
                                <span class="link-platform">${link.platform}</span>
                                <div class="link-title">${link.url}</div>
                                ${messageContext}  <span><i class="fas fa-user"></i> ${link.senderName || 'Unknown'}</span>
                            </div>s fa-calendar"></i> ${date}</span>
                        </div>
                        <div class="link-details">
                            <span><i class="fas fa-user"></i> ${link.senderName || 'Unknown'}</span>s="link-actions">
                            <span><i class="fas fa-calendar"></i> ${date}</span>url)}">
                            <span><i class="fas fa-clock"></i> ${time}</span> Download & Send
                        </div>ton>
                        <div class="link-actions">  <button class="btn btn-sm btn-danger delete-link-btn" data-url="${encodeURIComponent(link.url)}">
                            <button class="btn btn-sm btn-primary download-link-btn" data-url="${encodeURIComponent(link.url)}">          <i class="fas fa-trash"></i> Delete
                                <i class="fas fa-download"></i> Download & Send              </button>
                            </button>             </div>
                            <button class="btn btn-sm btn-danger delete-link-btn" data-url="${encodeURIComponent(link.url)}">            </div>
                                <i class="fas fa-trash"></i> Delete;
                            </button>
                        </div>
                    </div>  html += `
                `;             </div>
            });            </div>
            
            html += `
                    </div>    
                </div>
            `;
        });
        ndlers');
        html += '</div>';
        savedLinksContainer.innerHTML = html;Add event listeners to delete buttons
         document.querySelectorAll('.delete-link-btn').forEach(button => {
        // Add event listeners to delete buttons        button.addEventListener('click', async (e) => {
        document.querySelectorAll('.delete-link-btn').forEach(button => {tAttribute('data-url');
            button.addEventListener('click', async (e) => {
                const url = e.currentTarget.getAttribute('data-url');
                await deleteLink(url);
            });
        });
        ment.querySelectorAll('.download-link-btn').forEach(button => {
        // Add event listeners to download buttons) => {
                    const url = e.currentTarget.getAttribute('data-url');
                    const button = e.currentTarget;ick', async (e) => {
                    const originalText = button.innerHTML;const url = e.currentTarget.getAttribute('data-url');
                     button = e.currentTarget;
                    // Update button to show processing state
                    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
                    button.disabled = true;ow processing state
                    innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
                    try {on.disabled = true;
                        // Call the API to download and send the link
                        const response = await fetch(`/api/saved-links/download/${url}`, {{
                            method: 'POST'download and send the link
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            showToast('Media download started. It will be sent to the chat when ready.', 'success');
                            // Refresh the links to update the view
                            setTimeout(() => loadSavedLinks(), 1000);d started. It will be sent to the chat when ready.', 'success');
                        } else {   // Refresh the links to update the view
                            showToast('Failed to download and send media: ' + data.message, 'error');t(() => loadSavedLinks(), 1000);
                            // Restore the button
                            button.innerHTML = originalText;ta.message, 'error');
                            button.disabled = false;tton
                        }ext;
                    } catch (error) {lse;
                        console.error('Error sending download request:', error);   }
                        showToast('Error processing download request', 'error'); } catch (error) {
                        // Restore the button         console.error('Error sending download request:', error);
                        button.innerHTML = originalText;            showToast('Error processing download request', 'error');
                        button.disabled = false;
                    }
                });
            });
            
            // Add event listeners to clear group buttons
            document.querySelectorAll('.clear-group-btn').forEach(button => {
                button.addEventListener('click', async (e) => {event listeners to clear group buttons
                    const groupId = e.currentTarget.getAttribute('data-group-id');ument.querySelectorAll('.clear-group-btn').forEach(button => {
                    if (confirm('Are you sure you want to delete all saved links for this group?')) {       button.addEventListener('click', async (e) => {
                        await clearGroupLinks(groupId);            const groupId = e.currentTarget.getAttribute('data-group-id');
                    }you sure you want to delete all saved links for this group?')) {
                });
            });        }
        } catch (error) {
            console.error('Error rendering saved links:', error);
            savedLinksContainer.innerHTML = '<div class="error-message">Error rendering saved links: ' + 
                (error.message || 'Unknown error') + '</div>';
        }
    }rn;
    
    function filterSavedLinks() {
        if (!allSavedLinks || allSavedLinks.length === 0) return;Filter.value;
        
        const search = linksSearch.value.toLowerCase();lteredGroups = allSavedLinks.map(group => {
        const platform = platformFilter.value;roup
        ks = group.links.filter(link => {
        const filteredGroups = allSavedLinks.map(group => { platform
            // Filter links within the grouprm) {
            const filteredLinks = group.links.filter(link => {
                // Filter by platform
                if (platform !== 'all' && link.platform !== platform) {
                    return false;/ Filter by search term
                }if (search) {
                
                // Filter by search term         link.url.toLowerCase().includes(search) ||
                if (search) {            (link.senderName && link.senderName.toLowerCase().includes(search)) ||
                    return (es(search)
                        link.url.toLowerCase().includes(search) ||);
                        (link.senderName && link.senderName.toLowerCase().includes(search)) ||
                        group.groupName.toLowerCase().includes(search)
                    );  return true;
                }
                    
                return true;ith filtered links
            });
            
            // Return a new group object with filtered linkslinks: filteredLinks
            return {
                ...group, > 0); // Only keep groups with matching links
                links: filteredLinks
            };   if (filteredGroups.length === 0) {
        }).filter(group => group.links.length > 0); // Only keep groups with matching links        document.getElementById('no-links').style.display = 'block';
         '';
        if (filteredGroups.length === 0) {e {
            document.getElementById('no-links').style.display = 'block';
            savedLinksContainer.innerHTML = '';Links(filteredGroups);
        } else {
            document.getElementById('no-links').style.display = 'none';
            renderSavedLinks(filteredGroups);
        }codedUrl) {
    }
    if (!confirm('Are you sure you want to delete this link?')) {
    async function deleteLink(encodedUrl) {
        try {}
            if (!confirm('Are you sure you want to delete this link?')) {
                return;edUrl}`, {
            }
            
            const response = await fetch(`/api/saved-links/${encodedUrl}`, {
                method: 'DELETE'onst data = await response.json();
            });
            
            const data = await response.json(); 'success');
                   loadSavedLinks(); // Reload the links
            if (data.success) {       } else {
                showToast('Link deleted successfully', 'success');            showToast('Failed to delete link', 'error');
                loadSavedLinks(); // Reload the links
            } else {ch (error) {
                showToast('Failed to delete link', 'error');
            }eting link', 'error');
        } catch (error) {
            console.error('Error deleting link:', error);
            showToast('Error deleting link', 'error');
        }nction clearGroupLinks(groupId) {
    }
    
    async function clearGroupLinks(groupId) {
        try {
            const response = await fetch(`/api/saved-links/group/${groupId}`, {
                method: 'DELETE'onst data = await response.json();
            });
            
            const data = await response.json();eleted', 'success');
                   loadSavedLinks(); // Reload the links
            if (data.success) {       } else {
                showToast('All links in the group have been deleted', 'success');            showToast('Failed to clear group links', 'error');
                loadSavedLinks(); // Reload the links
            } else {
                showToast('Failed to clear group links', 'error');onsole.error('Error clearing group links:', error);
            }error');
        } catch (error) {
            console.error('Error clearing group links:', error);
            showToast('Error clearing group links', 'error');
        }
    }
    
    // Helper functions
    async function loadConfig() {st response = await fetch('/api/config', {
        try {    method: 'GET',
            console.log('Fetching configuration...');
            const response = await fetch('/api/config', {        'Content-Type': 'application/json',
                method: 'GET',/json'
                headers: {
                    'Content-Type': 'application/json', cookies
                    'Accept': 'application/json'
                },
                credentials: 'same-origin' // Include cookiesconsole.log('Response status:', response.status);
            });
            
            console.log('Response status:', response.status);    console.log('Authentication required, redirecting to login');
            .href = '/login.html';
            if (response.status === 401) {
                console.log('Authentication required, redirecting to login');
                window.location.href = '/login.html';
                return;
            }
            
            const data = await response.json();
            console.log('Response data:', data); config = data.config;
            
            if (data.success) {// Fill form inputs
                const config = data.config;(config).forEach(([key, value]) => {
                ment.querySelector(`[name="${key}"]`);
                // Fill form inputs
                Object.entries(config).forEach(([key, value]) => {       input.value = value;
                    const input = document.querySelector(`[name="${key}"]`);    }
                    if (input) {
                        input.value = value;
                    }/ Set toggles
                });if (autoReplyToggle) {
                cked = config.ENABLE_AUTO_REPLY === 'true';
                // Set toggles
                if (autoReplyToggle) {
                    autoReplyToggle.checked = config.ENABLE_AUTO_REPLY === 'true';if (socialMediaToggle) {
                } = config.ENABLE_SOCIAL_MEDIA_DOWNLOAD === 'true';
                
                if (socialMediaToggle) {
                    socialMediaToggle.checked = config.ENABLE_SOCIAL_MEDIA_DOWNLOAD === 'true';
                }   statusViewToggle.checked = config.ENABLE_AUTO_STATUS_VIEW === 'true';
                }
                if (statusViewToggle) {
                    statusViewToggle.checked = config.ENABLE_AUTO_STATUS_VIEW === 'true'; toggle
                }etElementById('link-saving-toggle');
                K_SAVING !== undefined) {
                // Set new link saving toggle
                const linkSavingToggle = document.getElementById('link-saving-toggle');
                if (linkSavingToggle && config.ENABLE_LINK_SAVING !== undefined) {
                    linkSavingToggle.checked = config.ENABLE_LINK_SAVING === 'true'; IDs
                }ontainer) {
                roupsContainer.innerHTML = '';
                // Load group IDs   if (config.ALLOWED_DOWNLOAD_GROUPS) {
                if (groupsContainer) {    config.ALLOWED_DOWNLOAD_GROUPS.split(',').forEach(groupId => {
                    groupsContainer.innerHTML = '';
                    if (config.ALLOWED_DOWNLOAD_GROUPS) {
                        config.ALLOWED_DOWNLOAD_GROUPS.split(',').forEach(groupId => {               }
                            if (groupId.trim()) {);
                                addGroupTag(groupId.trim());
                            }
                        });} else {
                    }onfiguration:', data.message);
                }
            } else {
                console.error('Failed to load configuration:', data.message);
                showToast('Failed to load configuration: ' + data.message, 'error');('Error loading configuration:', error);
            }howToast('Error loading configuration: ' + (error.message || 'Unknown error'), 'error');
        } catch (error) {   
            console.error('Error loading configuration:', error);       // Redirect to login if appropriate
            showToast('Error loading configuration: ' + (error.message || 'Unknown error'), 'error');        if (error.message && error.message.includes('Authentication required')) {
            
            // Redirect to login if appropriate       window.location.href = '/login.html';
            if (error.message && error.message.includes('Authentication required')) {
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
            }
        } {
    }
    et current config first
    async function updateConfig(key, value) {ch('/api/config');
        try {
            // Get current config first
            const response = await fetch('/api/config');
            const data = await response.json();
            fig[key] = value;
            if (data.success) {
                const config = data.config;
                config[key] = value;const updateResponse = await fetch('/api/config', {
                
                // Send updated config
                const updateResponse = await fetch('/api/config', {: JSON.stringify({ config })
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ config })t updateData = await updateResponse.json();
                });
                   if (updateData.success) {
                const updateData = await updateResponse.json();oast(`Successfully updated ${key}`, 'success');
                
                if (updateData.success) {           showToast(`Failed to update ${key}: ${updateData.message}`, 'error');
                    showToast(`Successfully updated ${key}`, 'success');           }
                } else {        } else {
                    showToast(`Failed to update ${key}: ${updateData.message}`, 'error');o fetch current configuration', 'error');
                }
            } else {
                showToast('Failed to fetch current configuration', 'error');    showToast(`Error updating ${key}`, 'error');
            }
        } catch (error) {
            showToast(`Error updating ${key}`, 'error');
        }
    }iner');
    
    async function loadChatLogs() {
        const chatLogsContainer = document.getElementById('chat-logs-container');
        if (!chatLogsContainer) return;hatLogsContainer.innerHTML = '<div class="loading-indicator">Loading logs...</div>';
        
        try {sLimitSelect.value : 100;
            chatLogsContainer.innerHTML = '<div class="loading-indicator">Loading logs...</div>';const response = await fetch(`/api/chat-logs?limit=${limit}`);
            
            const limit = logsLimitSelect ? logsLimitSelect.value : 100;ogin.html';
            const response = await fetch(`/api/chat-logs?limit=${limit}`);return;
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;onse.json();
            }
            ata.success && data.logs) {
            const data = await response.json();erChatLogs(data.logs);
            
            if (data.success && data.logs) {   // Apply current filter
                renderChatLogs(data.logs);iveFilter = document.querySelector('.filter-btn.active');
                
                // Apply current filter
                const activeFilter = document.querySelector('.filter-btn.active');       }
                if (activeFilter) {       } else {
                    applyChatLogFilter(activeFilter.getAttribute('data-filter'));            chatLogsContainer.innerHTML = '<div class="error-message">Failed to load chat logs</div>';
                }
            } else {
                chatLogsContainer.innerHTML = '<div class="error-message">Failed to load chat logs</div>';g chat logs:', error);
            }    chatLogsContainer.innerHTML = '<div class="error-message">Error loading chat logs</div>';
        } catch (error) {
            console.error('Error loading chat logs:', error);
            chatLogsContainer.innerHTML = '<div class="error-message">Error loading chat logs</div>';
        }ion renderChatLogs(logs) {
    }const chatLogsContainer = document.getElementById('chat-logs-container');
    ontainer) return;
    function renderChatLogs(logs) {
        const chatLogsContainer = document.getElementById('chat-logs-container');gth === 0) {
        if (!chatLogsContainer) return;"no-logs-message">No chat logs available</div>';
        
        if (!logs || logs.length === 0) {
            chatLogsContainer.innerHTML = '<div class="no-logs-message">No chat logs available</div>';
            return;
        }
        
        let html = '';
        onst timeStr = timestamp.toLocaleTimeString();
        logs.forEach(log => {const dateStr = timestamp.toLocaleDateString();
            const timestamp = new Date(log.timestamp);
            const timeStr = timestamp.toLocaleTimeString();
            const dateStr = timestamp.toLocaleDateString();honeNumber(log.sender);
            
            // Determine sender display nameName} (${formatPhoneNumber(log.sender)})`;
            let senderDisplay = log.fromMe ? 'Bot' : formatPhoneNumber(log.sender);
            if (log.senderName && !log.fromMe) {
                senderDisplay = `${log.senderName} (${formatPhoneNumber(log.sender)})`;ring
            }et classes = ['chat-log-entry'];
            classes.push(log.isGroup ? 'group' : 'private');
            // Create CSS classes for filteringer');
            let classes = ['chat-log-entry'];== 'text') {
            classes.push(log.isGroup ? 'group' : 'private');    classes.push('type-text');
            classes.push(log.fromMe ? 'from-me' : 'from-user');
            if (log.messageType === 'text') {
                classes.push('type-text');
            } else {
                classes.push('type-media');
            }
            
            // Prepare content - render media if availableow media if available
            let contentHtml = '';f (log.media && log.media.data) {
                if (log.media.type === 'image' || log.media.type === 'sticker') {
            // Show media if available += `<div class="chat-media">
            if (log.media && log.media.data) {mimeType};base64,${log.media.data}" 
                if (log.media.type === 'image' || log.media.type === 'sticker') {
                    contentHtml += `<div class="chat-media">
                        <img src="data:${log.media.mimeType};base64,${log.media.data}" 
                             alt="${log.media.type}" class="chat-media-img" />}
                    </div>`;
                }
            }">
            
            // Add text content
            contentHtml += `<div class="chat-text">
                ${log.messageType !== 'text' ? `<span class="media-tag">${log.messageType}</span>` : ''}
                ${escapeHtml(log.content)}
            </div>`;="${classes.join(' ')}">
            s="chat-log-header">
            html += `          <span class="chat-log-sender ${log.fromMe ? 'bot' : ''}">${senderDisplay}</span>
                <div class="${classes.join(' ')}">             <span class="chat-log-time">${timeStr} - ${dateStr}</span>
                    <div class="chat-log-header">            </div>
                        <span class="chat-log-sender ${log.fromMe ? 'bot' : ''}">${senderDisplay}</span>ntent"> 
                        <span class="chat-log-time">${timeStr} - ${dateStr}</span>                   ${contentHtml}
                    </div>                </div>
                    <div class="chat-log-content"> 
                        ${contentHtml}
                    </div>});
                </div>       
            `;ML = html;
        });
        
        chatLogsContainer.innerHTML = html;ilter(filterType) {
    }ment.querySelectorAll('.chat-log-entry');
    
    function applyChatLogFilter(filterType) {g => {
        const allLogs = document.querySelectorAll('.chat-log-entry');e) {
        
        allLogs.forEach(log => {yle.display = 'block';
            switch (filterType) {
                case 'all':
                    log.style.display = 'block';yle.display = log.classList.contains('type-text') ? 'block' : 'none';
                    break;
                case 'text':
                    log.style.display = log.classList.contains('type-text') ? 'block' : 'none';yle.display = log.classList.contains('type-media') ? 'block' : 'none';
                    break;       break;
                case 'media':     case 'group':
                    log.style.display = log.classList.contains('type-media') ? 'block' : 'none';               log.style.display = log.classList.contains('group') ? 'block' : 'none';
                    break;                break;
                case 'group':
                    log.style.display = log.classList.contains('group') ? 'block' : 'none';= log.classList.contains('private') ? 'block' : 'none';
                    break;
                case 'private':
                    log.style.display = log.classList.contains('private') ? 'block' : 'none';   });
                    break;}
            }
        });er(number) {
    }r) return 'Unknown';
    ix if present
    function formatPhoneNumber(number) {];
        if (!number) return 'Unknown';
        // Remove the WhatsApp suffix if present
        return number.split('@')[0];
    }   if (!str) return '';
        return str
    function escapeHtml(str) {
        if (!str) return '';
        return str    .replace(/>/g, '&gt;')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }Container) return;
    
    function addGroupTag(groupId) {// Check if tag already exists
        if (!groupsContainer) return;ainer.querySelectorAll('.tag'))
           .map(tag => tag.getAttribute('data-id'));
        // Check if tag already exists
        const existingTags = Array.from(groupsContainer.querySelectorAll('.tag'))oup ID already added', 'error');
                                 .map(tag => tag.getAttribute('data-id'));
        if (existingTags.includes(groupId)) {
            showToast('Group ID already added', 'error');
            return;
        }
        'data-id', groupId);
        const tag = document.createElement('div');
        tag.className = 'tag';n>
        tag.setAttribute('data-id', groupId); <span class="remove-tag"><i class="fas fa-times"></i></span>
        tag.innerHTML = ``;
            <span>${groupId}</span>or('.remove-tag');
            <span class="remove-tag"><i class="fas fa-times"></i></span>   removeBtn.addEventListener('click', () => {
        `;        tag.remove();
        const removeBtn = tag.querySelector('.remove-tag'); removing
        removeBtn.addEventListener('click', () => {
            tag.remove();
            // Auto-save after removing
            saveGroupsToConfig();
        });
        
        groupsContainer.appendChild(tag);Dashboard() {
    } server
    '/api/dashboard-stats')
    function loadDashboard() {=> {
        // Get dashboard stats from the server{
        fetch('/api/dashboard-stats')
            .then(response => {   return null;
                if (response.status === 401) {}
                    window.location.href = '/login.html';
                    return null;
                }
                return response.json();
            })a');
            .then(data => {  }
                if (!data || !data.success) {
                    throw new Error(data?.message || 'Failed to load dashboard data');
                }nt;
                ats.pluginsCount;
                // Update dashboard stats with real datatats.downloadsCount;
                document.getElementById('groups-count').textContent = data.stats.groupsCount;;
                document.getElementById('plugins-count').textContent = data.stats.pluginsCount;
                document.getElementById('downloads-count').textContent = data.stats.downloadsCount;ch(error => {
                document.getElementById('uptime').textContent = data.stats.uptime;ng dashboard stats:', error);
            })xt for the stats
            .catch(error => { document.getElementById('groups-count').textContent = 'Error';
                console.error('Error loading dashboard stats:', error);           document.getElementById('plugins-count').textContent = 'Error';
                // Show error but don't redirect - just use placeholder text for the stats            document.getElementById('downloads-count').textContent = 'Error';
                document.getElementById('groups-count').textContent = 'Error';).textContent = 'Error';
                document.getElementById('plugins-count').textContent = 'Error';
                document.getElementById('downloads-count').textContent = 'Error';st notification
                document.getElementById('uptime').textContent = 'Error';        showToast('Failed to load dashboard statistics', 'error');
                
                // Show toast notification
                showToast('Failed to load dashboard statistics', 'error');
            }); 'info') {
    }onst toast = document.getElementById('toast');
    if (!toast) return;
    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;ssName = 'toast show';
           if (type) {
        toast.textContent = message;         toast.classList.add(type);
        toast.className = 'toast show';        }










});    }        }, 3000);            toast.classList.remove('show');        setTimeout(() => {                }            toast.classList.add(type);        if (type) {        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
});
