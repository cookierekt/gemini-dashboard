// Initialization script to ensure proper startup order
console.log('🚀 Initializing Gemini Global Dashboard...');

// Ensure global variables are available
if (typeof window.currentUser === 'undefined') {
    window.currentUser = null;
}
if (typeof window.currentOrganization === 'undefined') {
    window.currentOrganization = null;
}

// Wait for DOM to be ready, then initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM ready - Dashboard initialization complete');
    
    // Show a loading message briefly
    const body = document.body;
    if (body && !body.classList.contains('loaded')) {
        body.style.opacity = '0';
        body.style.transition = 'opacity 0.5s ease';
        
        setTimeout(() => {
            body.style.opacity = '1';
            body.classList.add('loaded');
        }, 100);
    }
});