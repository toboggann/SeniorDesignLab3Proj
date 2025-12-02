const http = require('http');
require('dotenv').config(); // Load .env file

// Get expected hash from .env file
const EXPECTED_HASH = process.env.LAB_PASSWORD_HASH;

// Make sure hash is set
if (!EXPECTED_HASH) {
    console.error('ERROR: LAB_PASSWORD_HASH not found in .env file');
    console.error('Create a .env file with: LAB_PASSWORD_HASH=-51636e7e');
    process.exit(1);
}

//(`Server loaded. Expected hash: ${EXPECTED_HASH.substring(0, 3)}...`);

// Same hash function as your original JavaScript
function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Handle POST request to /verify
    if (req.method === 'POST' && req.url === '/verify') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                // Parse JSON body
                let password = '';
                try {
                    const data = JSON.parse(body);
                    password = data.password || '';
                } catch (jsonError) {
                    // Try URL encoded as fallback
                    const params = new URLSearchParams(body);
                    password = params.get('password') || '';
                }
                
                if (!password) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: false, 
                        error: 'No password provided' 
                    }));
                    return;
                }
                
                // SERVER computes the hash from plain text password
                const hashedInput = hashPassword(password);
                const success = (hashedInput === EXPECTED_HASH);
                
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: success,
                    timestamp: Date.now()
                }));
                
            } catch (error) {
                console.error('Error processing request:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: false, 
                    error: 'Internal server error' 
                }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Password verification server running on http://localhost:${PORT}`);
    console.log(`Hash loaded from .env file`);
});