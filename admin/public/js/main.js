document.addEventListener('DOMContentLoaded', function() {
    // Initialize all modules
    configManager.init();
    navigationManager.init();
    dashboardManager.init();  // Make sure this is called
    chatLogsManager.init();
    statusesManager.init();
    savedLinksManager.init();
    groupsManager.init();
    messagingManager.init();
    contactsManager.init();
    privacyManager.init();
    statusUpdater.init(); // Initialize the new status updater module
    
    // Enhanced mobile sidebar functionality
    initMobileSidebar();
    
    // Check authentication status
    checkAuthStatus();
    
    // Setup logout button
    document.getElementById('logout-btn').addEventListener('click', function() {
        fetch('/api/logout', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.href = '/login.html';
            }
        });
    });
    
    // Initialize enhanced notifications
    if (typeof showEnhancedToast !== 'undefined') {
        window.showToast = showEnhancedToast;
    }
    
    // Set up toast notifications
    window.showToast = window.showToast || uiUtils.showToast;
});

function initMobileSidebar() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (sidebarToggle && sidebar && sidebarOverlay) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
        });
        
        sidebarOverlay.addEventListener('click', function() {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        });
        
        // Close sidebar when clicking on nav items (mobile)
        const navItems = document.querySelectorAll('.sidebar-nav ul li');
        navItems.forEach(item => {
            item.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('active');
                    sidebarOverlay.classList.remove('active');
                }
            });
        });
    }
}
