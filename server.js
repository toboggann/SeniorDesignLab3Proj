const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load .env file

// Load expected hash from .env
const EXPECTED_HASH = process.env.LAB_PASSWORD_HASH;

// If not found, exit so you see the error
if (!EXPECTED_HASH) {
    console.log("error reashing hash");
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
    // ==================== CORS ====================
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // allow cookies/authentication to be sent with requests
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    // ==================== END CORS ====================

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // ==================== POST /verify ====================
    if (req.method === 'POST' && req.url === '/verify') {
        let body = '';

        req.on('data', chunk => { body += chunk.toString(); });

        req.on('end', () => {
            try {
                // Parse JSON body
                let password = '';
                try {
                    const data = JSON.parse(body);
                    password = data.password || '';
                } catch {
                    const params = new URLSearchParams(body);
                    password = params.get('password') || '';
                }

                if (!password) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'No password provided' }));
                    return;
                }

                const hashed = hashPassword(password);

// DEBUG: print what the server sees
console.log("Verify debug -> password:", JSON.stringify(password),
            "hashed:", hashed,
            "expected:", EXPECTED_HASH);

const success = (hashed === EXPECTED_HASH);

res.writeHead(200, { 'Content-Type': 'application/json' });
res.end(JSON.stringify({ success, timestamp: Date.now() }));


            } catch (err) {
                console.error("verify error:", err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Server error' }));
            }
        });

        return;
    }

    // ==================== POST /contact ====================
    if (req.method === 'POST' && req.url === '/contact') {
        let body = '';

        req.on('data', chunk => { body += chunk.toString(); });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { name, email, message, member } = data;

                if (!name || !email || !message) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing fields' }));
                    return;
                }

                // Create directory if needed
                const dir = path.join(__dirname, "protected_messages");
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir);
                }

                const timestamp = Date.now();
                const safe = name.replace(/[^a-z0-9]/gi, "_");
                const filename = `${timestamp}_${safe}.html`;
                const filepath = path.join(dir, filename);

                const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Message from ${name}</title>
</head>
<body>
<h2>Message Submission</h2>
<p><strong>Team Member:</strong> ${member || "Unknown"}</p>
<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Time:</strong> ${new Date(timestamp).toLocaleString()}</p>
<hr>
<p>${message.replace(/\n/g, "<br>")}</p>
</body>
</html>`;

                fs.writeFileSync(filepath, html);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, file: filename }));

            } catch (err) {
                console.error("contact error:", err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Server error' }));
            }
        });

        return;
    }

    // ==================== GET /messages ====================
    if (req.method === 'GET' && req.url === '/messages') {
        const dir = path.join(__dirname, "protected_messages");

        if (!fs.existsSync(dir)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([]));
            return;
        }

        fs.readdir(dir, (err, files) => {
            if (err) {
                console.error("messages read error:", err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Unable to read messages directory' }));
                return;
            }

            const htmlFiles = files.filter(f => f.toLowerCase().endsWith(".html"));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(htmlFiles));
        });

        return;
    }

    // ==================== GET /messages/<filename> ====================
    if (req.method === 'GET' && req.url.startsWith('/messages/')) {
        const file = decodeURIComponent(req.url.replace('/messages/', ''));

        if (file.includes("..") || file.includes("/") || file.includes("\\")) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end("Invalid file name");
            return;
        }

        const dir = path.join(__dirname, "protected_messages");
        const filepath = path.join(dir, file);

        if (!fs.existsSync(filepath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end("Not found");
            return;
        }

        fs.readFile(filepath, (err, data) => {
            if (err) {
                console.error("file read error:", err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end("Error reading file");
                return;
            }

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });

        return;
    }

    // ==================== DEFAULT 404 ====================
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

// EXPLICITLY BIND TO IPv4 SO CURL WORKS
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Password verification server running on http://localhost:${PORT}`);
    console.log("Hash loaded from .env file");
});
