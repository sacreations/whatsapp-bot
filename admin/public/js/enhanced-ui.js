// Enhanced UI interactions for the themed admin panel

// Enhanced animations and interactions
document.addEventListener('DOMContentLoaded', function() {
    initEnhancedUI();
});

function initEnhancedUI() {
    // Add loading states to buttons
    enhanceButtons();
    
    // Add smooth scrolling to navigation
    enhanceSidebarNavigation();
    
    // Add interactive stat cards
    enhanceStatCards();
    
    // Add form validation enhancements
    enhanceFormInputs();
    
    // Add responsive sidebar toggle
    enhanceSidebarToggle();
    
    // Add enhanced tooltips
    enhanceTooltips();
    
    // Add progress indicators
    addProgressIndicators();
    
    // Add notification enhancements
    enhanceNotifications();
}

function enhanceButtons() {
    const buttons = document.querySelectorAll('.btn');
    
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            // Add ripple effect
            createRipple(e, this);
            
            // Add loading state for async operations
            if (this.classList.contains('async-btn')) {
                addLoadingState(this);
            }
        });
    });
}

function createRipple(event, element) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
        z-index: 1000;
    `;
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

function addLoadingState(button) {
    const originalContent = button.innerHTML;
    const spinner = '<i class="fas fa-spinner fa-spin"></i>';
    
    button.innerHTML = spinner + ' Loading...';
    button.disabled = true;
    
    // Simulate async operation completion
    setTimeout(() => {
        button.innerHTML = originalContent;
        button.disabled = false;
    }, 2000);
}

function enhanceSidebarNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav ul li');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
            
            // Add slide animation
            this.style.transform = 'translateX(8px)';
            setTimeout(() => {
                this.style.transform = '';
            }, 200);
        });
        
        // Add hover sound effect (optional)
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateX(4px)';
        });
        
        item.addEventListener('mouseleave', function() {
            if (!this.classList.contains('active')) {
                this.style.transform = '';
            }
        });
    });
}

function enhanceStatCards() {
    const statCards = document.querySelectorAll('.stat-card');
    
    statCards.forEach(card => {
        // Add click animation
        card.addEventListener('click', function() {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
        
        // Add parallax effect on hover
        card.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;
            
            this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
    });
}

function enhanceFormInputs() {
    const inputs = document.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
        // Add floating label effect
        const label = input.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
            input.addEventListener('focus', function() {
                label.style.transform = 'translateY(-20px) scale(0.8)';
                label.style.color = 'var(--primary-color)';
            });
            
            input.addEventListener('blur', function() {
                if (!this.value) {
                    label.style.transform = '';
                    label.style.color = '';
                }
            });
        }
        
        // Add validation styling
        input.addEventListener('invalid', function() {
            this.style.borderColor = 'var(--error-color)';
            this.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
        });
        
        input.addEventListener('input', function() {
            if (this.validity.valid) {
                this.style.borderColor = 'var(--success-color)';
                this.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.1)';
            }
        });
    });
}

function enhanceSidebarToggle() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
            
            // Add rotation animation to hamburger icon
            const icon = this.querySelector('i');
            icon.style.transform = icon.style.transform === 'rotate(90deg)' ? '' : 'rotate(90deg)';
        });
    }
}

function enhanceTooltips() {
    const elementsWithTooltips = document.querySelectorAll('[title], [data-tooltip]');
    
    elementsWithTooltips.forEach(element => {
        const tooltipText = element.getAttribute('title') || element.getAttribute('data-tooltip');
        if (!tooltipText) return;
        
        // Remove default title to prevent browser tooltip
        element.removeAttribute('title');
        
        element.addEventListener('mouseenter', function(e) {
            const tooltip = createTooltip(tooltipText);
            document.body.appendChild(tooltip);
            
            const rect = this.getBoundingClientRect();
            tooltip.style.left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + 'px';
            tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
            
            setTimeout(() => tooltip.classList.add('visible'), 10);
        });
        
        element.addEventListener('mouseleave', function() {
            const tooltip = document.querySelector('.enhanced-tooltip');
            if (tooltip) {
                tooltip.classList.remove('visible');
                setTimeout(() => tooltip.remove(), 200);
            }
        });
    });
}

function createTooltip(text) {
    const tooltip = document.createElement('div');
    tooltip.className = 'enhanced-tooltip';
    tooltip.textContent = text;
    tooltip.style.cssText = `
        position: fixed;
        background: var(--glass-bg);
        backdrop-filter: blur(20px);
        border: 1px solid var(--glass-border);
        color: var(--text-primary);
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        font-size: 0.75rem;
        font-weight: 500;
        z-index: 10000;
        opacity: 0;
        transform: translateY(5px);
        transition: all 0.2s ease;
        pointer-events: none;
        box-shadow: var(--shadow-medium);
    `;
    
    return tooltip;
}

function addProgressIndicators() {
    // Add to forms during submission
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        form.addEventListener('submit', function() {
            showProgressBar();
        });
    });
}

function showProgressBar() {
    const progressBar = document.createElement('div');
    progressBar.className = 'enhanced-progress-bar';
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 0%;
        height: 3px;
        background: var(--primary-gradient);
        z-index: 10001;
        transition: width 0.3s ease;
    `;
    
    document.body.appendChild(progressBar);
    
    // Animate progress
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        progressBar.style.width = progress + '%';
    }, 200);
    
    // Complete after operation
    setTimeout(() => {
        clearInterval(interval);
        progressBar.style.width = '100%';
        setTimeout(() => progressBar.remove(), 500);
    }, 2000);
}

function enhanceNotifications() {
    // Override the existing showToast function if it exists
    window.showEnhancedToast = function(message, type = 'info', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `enhanced-toast toast-${type}`;
        
        const icon = getToastIcon(type);
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">${message}</div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--glass-bg);
            backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border);
            border-radius: 12px;
            padding: 1rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            z-index: 10002;
            transform: translateX(400px);
            transition: all 0.3s ease;
            max-width: 350px;
            box-shadow: var(--shadow-medium);
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 10);
        
        setTimeout(() => {
            toast.style.transform = 'translateX(400px)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    };
}

function getToastIcon(type) {
    const icons = {
        success: '<i class="fas fa-check-circle" style="color: var(--success-color);"></i>',
        error: '<i class="fas fa-exclamation-circle" style="color: var(--error-color);"></i>',
        warning: '<i class="fas fa-exclamation-triangle" style="color: var(--warning-color);"></i>',
        info: '<i class="fas fa-info-circle" style="color: var(--info-color);"></i>'
    };
    return icons[type] || icons.info;
}

// Add CSS animations for tooltips
const style = document.createElement('style');
style.textContent = `
    .enhanced-tooltip.visible {
        opacity: 1 !important;
        transform: translateY(0) !important;
    }
    
    @keyframes ripple {
        to {
            transform: scale(2);
            opacity: 0;
        }
    }
    
    .sidebar.collapsed {
        transform: translateX(-250px);
    }
    
    .main-content.expanded {
        margin-left: 0;
    }
    
    .toast-close {
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 0;
        margin-left: auto;
    }
    
    .toast-close:hover {
        color: var(--text-primary);
    }
`;
document.head.appendChild(style);
