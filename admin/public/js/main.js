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
    
    // Set up toast notifications
    window.showToast = uiUtils.showToast;
});
