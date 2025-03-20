// Check authentication status when loading admin pages
(function() {
    // Skip check for login page itself
    if (window.location.pathname.includes('login.html')) {
        return;
    }
    
    // Check auth status
    fetch('/api/auth-status')
        .then(response => response.json())
        .then(data => {
            if (!data.authenticated) {
                console.log('Not authenticated, redirecting to login page');
                window.location.href = '/login.html';
            }
        })
        .catch(error => {
            console.error('Error checking authentication status:', error);
            // Redirect to login page on error as well
            window.location.href = '/login.html';
        });
})();
