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
    
    // Set up toast notifications
    window.showToast = uiUtils.showToast;
});
