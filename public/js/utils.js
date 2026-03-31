const utils = {
    // API Client
    api: async (url, options = {}) => {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Something went wrong');
            }
            
            return data;
        } catch (err) {
            console.error('API Error:', err.message);
            utils.showToast(err.message, 'error');
            throw err;
        }
    },

    // Toast Notifications
    showToast: (message, type = 'info') => {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" style="background:none; border:none; color:white; font-size:1.2rem; cursor:pointer">&times;</button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    // Authentication Helpers
    auth: {
        getUser: () => {
            const user = localStorage.getItem('user');
            return user ? JSON.parse(user) : null;
        },
        setUser: (user) => {
            localStorage.setItem('user', JSON.stringify(user));
        },
        logout: async () => {
            try {
                await utils.api('/api/auth/logout', { method: 'POST' });
                localStorage.removeItem('user');
                window.location.href = '/index.html';
            } catch (err) {
                console.error('Logout error');
            }
        },
        checkAdmin: () => {
            const user = utils.auth.getUser();
            if (!user || user.role !== 'admin') {
                window.location.href = '/admin/login.html';
            }
        },
        checkCandidate: () => {
            const user = utils.auth.getUser();
            if (!user || user.role !== 'candidate') {
                window.location.href = '/index.html';
            }
        }
    }
};

// Initialize Toast Container
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('toast-container')) {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
});
