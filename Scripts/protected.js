document.addEventListener('DOMContentLoaded', function() {
    const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
    const AUTH_TOKEN = 'lab3_auth_token';
    
    const passwordSection = document.getElementById('passwordSection');
    const protectedContent = document.getElementById('protectedContent');
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const logoutBtn = document.getElementById('logoutBtn');
    const messageList = document.getElementById('messageList');
    const noMessages = document.getElementById('noMessages');
    
    // check if already authenticated
    if (isAuthenticated()) {
        showProtectedContent();
    } else {
        showPasswordForm();
    }
    
    // handle login form submission
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const password = document.getElementById('password').value;
        const hashedPassword = hashPassword(password);
        console.log(password);
        console.log(hashedPassword);
        
        // Compare with hashed version of correct password
        if (hashedPassword === '-51636e7e') {
            createAuthSession();
            showProtectedContent();
        } else {
            errorMessage.style.display = 'block';
            document.getElementById('password').value = '';
        }
    });
    
    // handle logout
    logoutBtn.addEventListener('click', function() {
        sessionStorage.removeItem(AUTH_TOKEN);
        showPasswordForm();
    });
    
    function hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
    
    function createAuthSession() {
        const authData = {
            authenticated: true,
            timestamp: Date.now(),
            token: generateToken()
        };
        sessionStorage.setItem(AUTH_TOKEN, JSON.stringify(authData));
    }
    
    function generateToken() {
        return 'token_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
    }
    
    function isAuthenticated() {
        const authData = sessionStorage.getItem(AUTH_TOKEN);
        if (!authData) return false;
        
        try {
            const { authenticated, timestamp } = JSON.parse(authData);
            const currentTime = Date.now();
            
            return authenticated && (currentTime - timestamp) < SESSION_DURATION;
        } catch (e) {
            return false;
        }
    }
    
    function showPasswordForm() {
        passwordSection.style.display = 'block';
        protectedContent.style.display = 'none';
        errorMessage.style.display = 'none';
        document.getElementById('password').value = '';
    }
    
    function showProtectedContent() {
        passwordSection.style.display = 'none';
        protectedContent.style.display = 'block';
        loadMessages();
    }
    
    function loadMessages() {
        const messages = JSON.parse(localStorage.getItem('lab3_messages')) || [];
        
        if (messages.length === 0) {
            noMessages.style.display = 'block';
            messageList.style.display = 'none';
        } else {
            noMessages.style.display = 'none';
            messageList.style.display = 'block';
            
            messageList.innerHTML = '';
            
            messages.reverse().forEach(message => {
                const messageItem = document.createElement('li');
                messageItem.className = 'message-item';
                
                messageItem.innerHTML = `
                    <div class="message-header">
                        <span>From: ${escapeHtml(message.name)}</span>
                        <span class="message-timestamp">${formatTimestamp(message.timestamp)}</span>
                    </div>
                    <div><strong>Email:</strong> ${escapeHtml(message.email)}</div>
                    <div style="margin-top: 0.5rem;"><strong>Message:</strong></div>
                    <div class="message-content">
                        ${escapeHtml(message.message)}
                    </div>
                `;
                
                messageList.appendChild(messageItem);
            });
        }
    }
    
    function formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleString();
    }
    
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});