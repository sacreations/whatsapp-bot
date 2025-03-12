// Script to check if user is logged in and redirect appropriately
document.addEventListener('DOMContentLoaded', async function() {
    // Don't check on login page
    if (window.location.pathname === '/login.html') {
        return;
    }

    try {
        const response = await fetch('/api/auth-status');
        const data = await response.json();

        if (!data.authenticated) {
            console.log('User not authenticated, redirecting to login...');
            window.location.href = '/login.html';
        } else {
            console.log('User is authenticated');
        }
    } catch (error) {
        console.error('Error checking authentication status:', error);
        // Redirect to login on error to be safe
        window.location.href = '/login.html';
    }
});
