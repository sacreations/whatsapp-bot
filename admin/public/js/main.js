document.addEventListener('DOMContentLoaded', function() {
    // Initialize all modules
    configManager.init();
    navigationManager.init();
    dashboardManager.init();
    chatLogsManager.init();
    statusesManager.init();
    savedLinksManager.init();
    groupsManager.init();
    messagingManager.init();
    contactsManager.init();
    privacyManager.init(); // Initialize the new privacy manager
    
    // Set up toast notifications
    window.showToast = uiUtils.showToast;
});
