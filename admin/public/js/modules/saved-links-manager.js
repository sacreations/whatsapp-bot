const savedLinksManager = {
    refreshLinksBtn: null,
    linksSearch: null,
    platformFilter: null,
    savedLinksContainer: null,
    allSavedLinks: [],
    
    init: function() {
        this.refreshLinksBtn = document.getElementById('refresh-links');
        this.linksSearch = document.getElementById('links-search');
        this.platformFilter = document.getElementById('links-platform-filter');
        this.savedLinksContainer = document.getElementById('saved-links-container');
        
        this.setupEventListeners();
    },
    
    setupEventListeners: function() {
        if (this.refreshLinksBtn) {
            this.refreshLinksBtn.addEventListener('click', () => {
                this.loadSavedLinks();
            });
        }
        
        if (this.linksSearch) {
            this.linksSearch.addEventListener('input', () => {
                this.filterSavedLinks();
            });
        }
        
        if (this.platformFilter) {
            this.platformFilter.addEventListener('change', () => {
                this.filterSavedLinks();
            });
        }
    },
    
    loadSavedLinks: async function() {
        if (!this.savedLinksContainer) return;
        
        try {
            console.log('Starting to load saved links...');
            this.savedLinksContainer.innerHTML = '<div class="loading-indicator">Loading saved links...</div>';
            
            const response = await fetch('/api/saved-links');
            
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            
            const data = await response.json();
            console.log('Saved links data received:', data);
            
            if (data.success && data.groups) {
                this.allSavedLinks = data.groups;
                
                if (data.groups.length === 0) {
                    console.log('No saved links found');
                    document.getElementById('no-links').style.display = 'block';
                    this.savedLinksContainer.innerHTML = '';
                } else {
                    console.log(`Rendering ${data.groups.length} groups with saved links`);
                    document.getElementById('no-links').style.display = 'none';
                    this.renderSavedLinks(data.groups);
                }
            } else {
                console.error('Error in links data:', data);
                this.savedLinksContainer.innerHTML = '<div class="error-message">Error loading saved links: ' + 
                    (data.message || 'Unknown error') + '</div>';
            }
        } catch (error) {
            console.error('Error loading saved links:', error);
            this.savedLinksContainer.innerHTML = '<div class="error-message">Error loading saved links: ' + 
                (error.message || 'Unknown error') + '</div>';
        }
    },
    
    renderSavedLinks: function(groups) {
        if (!this.savedLinksContainer) return;
        
        try {
            console.log(`Rendering ${groups.length} groups with saved links`);
            
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
            this.savedLinksContainer.innerHTML = html;
            
            console.log('Links rendering complete, attaching event handlers');
            
            // Add event listeners to delete buttons
            document.querySelectorAll('.delete-link-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const url = e.currentTarget.getAttribute('data-url');
                    await this.deleteLink(url);
                });
            });
            
            // Add event listeners to download buttons
            document.querySelectorAll('.download-link-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const url = e.currentTarget.getAttribute('data-url');
                    const button = e.currentTarget;
                    const originalText = button.innerHTML;
                    
                    // Update button to show processing state
                    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
                    button.disabled = true;
                    
                    try {
                        // Call the API to download and send the link
                        const response = await fetch(`/api/saved-links/download/${url}`, {
                            method: 'POST'
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            showToast('Media download started. It will be sent to the chat when ready.', 'success');
                            // Refresh the links to update the view
                            setTimeout(() => this.loadSavedLinks(), 1000);
                        } else {
                            showToast('Failed to download and send media: ' + data.message, 'error');
                            // Restore the button
                            button.innerHTML = originalText;
                            button.disabled = false;
                        }
                    } catch (error) {
                        console.error('Error sending download request:', error);
                        showToast('Error processing download request', 'error');
                        // Restore the button
                        button.innerHTML = originalText;
                        button.disabled = false;
                    }
                });
            });
            
            // Add event listeners to clear group buttons
            document.querySelectorAll('.clear-group-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const groupId = e.currentTarget.getAttribute('data-group-id');
                    if (confirm('Are you sure you want to delete all saved links for this group?')) {
                        await this.clearGroupLinks(groupId);
                    }
                });
            });
        } catch (error) {
            console.error('Error rendering saved links:', error);
            this.savedLinksContainer.innerHTML = '<div class="error-message">Error rendering saved links: ' + 
                (error.message || 'Unknown error') + '</div>';
        }
    },
    
    filterSavedLinks: function() {
        if (!this.allSavedLinks || this.allSavedLinks.length === 0) return;
        
        const search = this.linksSearch.value.toLowerCase();
        const platform = this.platformFilter.value;
        
        const filteredGroups = this.allSavedLinks.map(group => {
            // Filter links within the group
            const filteredLinks = group.links.filter(link => {
                // Filter by platform
                if (platform !== 'all' && link.platform !== platform) {
                    return false;
                }
                
                // Filter by search term
                if (search) {
                    return (
                        link.url.toLowerCase().includes(search) ||
                        (link.senderName && link.senderName.toLowerCase().includes(search)) ||
                        group.groupName.toLowerCase().includes(search)
                    );
                }
                    
                return true;
            });
            
            // Return a new group object with filtered links
            return {
                ...group,
                links: filteredLinks
            };
        }).filter(group => group.links.length > 0); // Only keep groups with matching links
        
        if (filteredGroups.length === 0) {
            document.getElementById('no-links').style.display = 'block';
            this.savedLinksContainer.innerHTML = '';
        } else {
            document.getElementById('no-links').style.display = 'none';
            this.renderSavedLinks(filteredGroups);
        }
    },
    
    deleteLink: async function(encodedUrl) {
        if (!confirm('Are you sure you want to delete this link?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/saved-links/${encodedUrl}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('Link deleted successfully', 'success');
                this.loadSavedLinks(); // Reload the links
            } else {
                showToast('Failed to delete link', 'error');
            }
        } catch (error) {
            console.error('Error deleting link:', error);
            showToast('Error deleting link', 'error');
        }
    },
    
    clearGroupLinks: async function(groupId) {
        try {
            const response = await fetch(`/api/saved-links/group/${groupId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('All links in the group have been deleted', 'success');
                this.loadSavedLinks(); // Reload the links
            } else {
                showToast('Failed to clear group links', 'error');
            }
        } catch (error) {
            console.error('Error clearing group links:', error);
            showToast('Error clearing group links', 'error');
        }
    }
};

window.savedLinksManager = savedLinksManager;
