// server.js — clean, secure, final version

const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Load hashed password
const EXPECTED_HASH = process.env.LAB_PASSWORD_HASH;

// If .env missing or hash missing → fail early
if (!EXPECTED_HASH) {
    console.error("ERROR: LAB_PASSWORD_HASH missing from .env");
    process.exit(1);
}

// Hash function (MUST match browser exactly)
function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & 0xFFFFFFFF;
    }

    // convert to signed 32-bit JS integer format
    if (hash & 0x80000000) {
        hash = -((~hash + 1) & 0xFFFFFFFF);
    }

    return hash.toString(16);
}

const server = http.createServer((req, res) => {

    // Basic CORS for local pages ONLY
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }

    // ===================== VERIFY PASSWORD ======================
    if (req.method === "POST" && req.url === "/verify") {
        let body = "";

        req.on("data", chunk => body += chunk.toString());

        req.on("end", () => {
            try {
                const data = JSON.parse(body);
                const password = data.password || "";

                const hashed = hashPassword(password);
                const success = (hashed === EXPECTED_HASH);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success }));

            } catch {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }

    // ====================== CONTACT FORM SAVE ======================
    if (req.method === "POST" && req.url === "/contact") {
        let body = "";
        req.on("data", chunk => body += chunk.toString());

        req.on("end", () => {
            try {
                const data = JSON.parse(body);
                const { name, email, message, member } = data;

                if (!name || !email || !message) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false }));
                    return;
                }

                const dir = path.join(__dirname, "protected_messages");
                if (!fs.existsSync(dir)) fs.mkdirSync(dir);

                // Create filename
                const timestamp = Date.now();
                const safeName = name.replace(/[^a-z0-9]/gi, "_");
                const filename = `${timestamp}_${safeName}.html`;
                const filePath = path.join(dir, filename);

                const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Message</title></head>
<body>
<h2>Message Submission</h2>
<p><b>Team Member:</b> ${member || "Unknown"}</p>
<p><b>Name:</b> ${name}</p>
<p><b>Email:</b> ${email}</p>
<p><b>Time:</b> ${new Date(timestamp).toLocaleString()}</p>
<hr>
<p>${message.replace(/\n/g,"<br>")}</p>
</body>
</html>`;

                fs.writeFileSync(filePath, html);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true }));

            } catch {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false }));
            }
        });

        return;
    }

    // ====================== GET MESSAGE LIST ======================
    if (req.method === "GET" && req.url === "/messages") {
        const dir = path.join(__dirname, "protected_messages");

        if (!fs.existsSync(dir)) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify([]));
            return;
        }

        const files = fs.readdirSync(dir)
            .filter(f => f.toLowerCase().endsWith(".html"));

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(files));
        return;
    }

    // ====================== SERVE INDIVIDUAL MESSAGE ======================
    if (req.method === "GET" && req.url.startsWith("/messages/")) {
        const filename = decodeURIComponent(req.url.replace("/messages/",""));

        if (filename.includes("..")) {
            res.writeHead(400);
            res.end("Invalid filename");
            return;
        }

        const filePath = path.join(__dirname, "protected_messages", filename);

        if (!fs.existsSync(filePath)) {
            res.writeHead(404);
            res.end("Not found");
            return;
        }

        const file = fs.readFileSync(filePath);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(file);
        return;
    }

    // ====================== FALLBACK 404 ======================
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(3000, "0.0.0.0", () => {
    console.log("Secure password-protected server running on port 3000.");
});
