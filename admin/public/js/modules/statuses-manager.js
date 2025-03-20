const statusesManager = {
    refreshStatusesBtn: null,
    statusFilter: null,
    contactSearch: null,
    statusSort: null,
    statusGrid: null,
    allStatuses: [],
    
    init: function() {
        this.refreshStatusesBtn = document.getElementById('refresh-statuses');
        this.statusFilter = document.getElementById('status-filter');
        this.contactSearch = document.getElementById('contact-search');
        this.statusSort = document.getElementById('status-sort');
        this.statusGrid = document.getElementById('status-grid');
        
        this.setupEventListeners();
    },
    
    setupEventListeners: function() {
        if (this.refreshStatusesBtn) {
            this.refreshStatusesBtn.addEventListener('click', () => {
                this.loadStatuses();
            });
        }
        
        if (this.statusFilter) {
            this.statusFilter.addEventListener('change', () => {
                this.filterAndSortStatuses();
            });
        }
        
        if (this.contactSearch) {
            this.contactSearch.addEventListener('input', () => {
                this.filterAndSortStatuses();
            });
        }
        
        if (this.statusSort) {
            this.statusSort.addEventListener('change', () => {
                this.filterAndSortStatuses();
            });
        }
    },
    
    loadStatuses: async function() {
        if (!this.statusGrid) return;
        
        try {
            this.statusGrid.innerHTML = '<div class="loading-indicator">Loading statuses...</div>';
            
            const response = await fetch('/api/statuses');
            
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            
            const data = await response.json();
            
            if (data.success && data.statuses) {
                this.allStatuses = data.statuses;
                
                if (this.allStatuses.length === 0) {
                    document.getElementById('no-statuses').style.display = 'block';
                    this.statusGrid.innerHTML = '';
                } else {
                    document.getElementById('no-statuses').style.display = 'none';
                    this.renderStatuses(this.allStatuses);
                }
            } else {
                this.statusGrid.innerHTML = '<div class="error-message">Failed to load statuses</div>';
            }
        } catch (error) {
            console.error('Error loading statuses:', error);
            this.statusGrid.innerHTML = '<div class="error-message">Error loading statuses</div>';
        }
    },
    
    renderStatuses: function(statuses) {
        if (!this.statusGrid) return;
        
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
        this.statusGrid.innerHTML = html;
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-status').forEach(button => {
            button.addEventListener('click', async (e) => {
                const statusId = e.currentTarget.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this status?')) {
                    await this.deleteStatus(statusId);
                }
            });
        });
    },
    
    filterAndSortStatuses: function() {
        if (!this.allStatuses || this.allStatuses.length === 0) return;
        
        // Apply filters
        let filtered = [...this.allStatuses];
        
        // Filter by type (image/video)
        const typeFilter = this.statusFilter.value;
        if (typeFilter !== 'all') {
            filtered = filtered.filter(status => status.type === typeFilter);
        }
        
        // Filter by contact search
        const search = this.contactSearch.value.toLowerCase();
        if (search) {
            filtered = filtered.filter(status => 
                (status.contactName && status.contactName.toLowerCase().includes(search)) || 
                status.contactId.toLowerCase().includes(search)
            );
        }
        
        // Apply sorting
        const sortMethod = this.statusSort.value;
        if (sortMethod === 'oldest') {
            filtered.sort((a, b) => a.timestamp - b.timestamp);
        } else {
            filtered.sort((a, b) => b.timestamp - a.timestamp);
        }
        
        // Update view
        if (filtered.length === 0) {
            this.statusGrid.innerHTML = '<div class="no-results">No matching statuses found</div>';
        } else {
            this.renderStatuses(filtered);
        }
    },
    
    deleteStatus: async function(statusId) {
        try {
            const response = await fetch(`/api/statuses/${encodeURIComponent(statusId)}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('Status deleted successfully', 'success');
                // Remove from the allStatuses array
                this.allStatuses = this.allStatuses.filter(status => status.id !== statusId);
                this.filterAndSortStatuses(); // Re-render the list
            } else {
                showToast('Failed to delete status: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error deleting status:', error);
            showToast('Error deleting status', 'error');
        }
    }
};

window.statusesManager = statusesManager;
