const chatLogsManager = {
    refreshLogsBtn: null,
    logsLimitSelect: null,
    filterBtns: null,
    chatLogsContainer: null,
    
    init: function() {
        this.refreshLogsBtn = document.getElementById('refresh-logs');
        this.logsLimitSelect = document.getElementById('logs-limit');
        this.filterBtns = document.querySelectorAll('.filter-btn');
        this.chatLogsContainer = document.getElementById('chat-logs-container');
        
        this.setupEventListeners();
        this.loadChatLogs();
    },
    
    setupEventListeners: function() {
        if (this.refreshLogsBtn) {
            this.refreshLogsBtn.addEventListener('click', () => {
                this.loadChatLogs();
            });
        }
        
        if (this.logsLimitSelect) {
            this.logsLimitSelect.addEventListener('change', () => {
                this.loadChatLogs();
            });
        }
        
        if (this.filterBtns) {
            this.filterBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    // Update active state
                    this.filterBtns.forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    
                    // Apply filter
                    const filterType = e.currentTarget.getAttribute('data-filter');
                    this.applyChatLogFilter(filterType);
                });
            });
        }
    },
    
    loadChatLogs: async function() {
        if (!this.chatLogsContainer) return;
        
        try {
            this.chatLogsContainer.innerHTML = '<div class="loading-indicator">Loading logs...</div>';
            
            const limit = this.logsLimitSelect ? this.logsLimitSelect.value : 100;
            const response = await fetch(`/api/chat-logs?limit=${limit}`);
            
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            
            const data = await response.json();
            
            if (data.success && data.logs) {
                this.renderChatLogs(data.logs);
                
                // Apply current filter
                const activeFilter = document.querySelector('.filter-btn.active');
                if (activeFilter) {
                    this.applyChatLogFilter(activeFilter.getAttribute('data-filter'));
                }
            } else {
                this.chatLogsContainer.innerHTML = '<div class="error-message">Failed to load chat logs</div>';
            }
        } catch (error) {
            console.error('Error loading chat logs:', error);
            this.chatLogsContainer.innerHTML = '<div class="error-message">Error loading chat logs</div>';
        }
    },
    
    renderChatLogs: function(logs) {
        if (!this.chatLogsContainer) return;
        
        if (!logs || logs.length === 0) {
            this.chatLogsContainer.innerHTML = '<div class="no-logs-message">No chat logs available</div>';
            return;
        }
        
        let html = '';
        
        logs.forEach(log => {
            const timestamp = new Date(log.timestamp);
            const timeStr = timestamp.toLocaleTimeString();
            const dateStr = timestamp.toLocaleDateString();
            
            // Determine sender display name
            let senderDisplay = log.fromMe ? 'Bot' : this.formatPhoneNumber(log.sender);
            if (log.senderName && !log.fromMe) {
                senderDisplay = `${log.senderName} (${this.formatPhoneNumber(log.sender)})`;
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
                ${this.escapeHtml(log.content)}
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
        
        this.chatLogsContainer.innerHTML = html;
    },
    
    applyChatLogFilter: function(filterType) {
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
    },
    
    formatPhoneNumber: function(number) {
        if (!number) return 'Unknown';
        // Remove the WhatsApp suffix if present
        return number.split('@')[0];
    },
    
    escapeHtml: function(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};

window.chatLogsManager = chatLogsManager;
