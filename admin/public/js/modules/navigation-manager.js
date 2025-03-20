const navigationManager = {
    sidebar: null,
    sidebarToggle: null,
    sectionLinks: null,
    sections: null,
    sectionTitle: null,
    logoutBtn: null,
    
    init: function() {
        this.sidebar = document.querySelector('.sidebar');
        this.sidebarToggle = document.getElementById('sidebar-toggle');
        this.sectionLinks = document.querySelectorAll('.sidebar-nav li');
        this.sections = document.querySelectorAll('.content-section');
        this.sectionTitle = document.getElementById('section-title');
        this.logoutBtn = document.getElementById('logout-btn');
        
        this.setupEventListeners();
    },
    
    setupEventListeners: function() {
        // Toggle sidebar (for mobile)
        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener('click', () => {
                this.sidebar.classList.toggle('show');
            });
        }
        
        // Tab navigation - updated to load section-specific data
        this.sectionLinks.forEach(link => {
            link.addEventListener('click', this.handleSectionChange.bind(this));
        });
        
        // Logout functionality
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }
    },
    
    handleSectionChange: function(e) {
        // Update active tab
        this.sectionLinks.forEach(el => el.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        // Show active section
        const sectionId = e.currentTarget.getAttribute('data-section');
        this.sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === sectionId) {
                section.classList.add('active');
                this.sectionTitle.textContent = e.currentTarget.textContent.trim();
                // Load section-specific data
                this.loadSectionData(sectionId);
            }
        });
        
        // Hide sidebar on mobile after selection
        if (window.innerWidth <= 768) {
            this.sidebar.classList.remove('show');
        }
    },
    
    loadSectionData: function(sectionId) {
        switch(sectionId) {
            case 'dashboard':
                dashboardManager.loadDashboard();
                break;
            case 'chat-logs':
                chatLogsManager.loadChatLogs();
                break;
            case 'statuses':
                statusesManager.loadStatuses();
                break;
            case 'saved-links':
                savedLinksManager.loadSavedLinks();
                break;
            // Add other section data loading as needed
        }
    },
    
    handleLogout: async function() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login.html';
        } catch (error) {
            showToast('Error logging out. Please try again.', 'error');
        }
    }
};

window.navigationManager = navigationManager;
