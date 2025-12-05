
const http = require("http");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const EXPECTED_HASH = process.env.LAB_PASSWORD_HASH;

if (!EXPECTED_HASH) {
  console.error("ERROR: LAB_PASSWORD_HASH missing (set it in Heroku Config Vars)");
  process.exit(1);
}

function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & 0xFFFFFFFF;
  }

  if (hash & 0x80000000) {
    hash = -((~hash + 1) & 0xFFFFFFFF);
  }

  return hash.toString(16);
}

const server = http.createServer((req, res) => {
  // Basic CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/verify") {
    let body = "";

    req.on("data", (chunk) => (body += chunk.toString()));
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

  if (req.method === "POST" && req.url === "/contact") {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));

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

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Message</title></head>
<body>
<h2>Message Submission</h2>
<p><b>Team Member:</b> ${member || "Unknown"}</p>
<p><b>Name:</b> ${name}</p>
<p><b>Email:</b> ${email}</p>
<p><b>Time:</b> ${new Date(timestamp).toLocaleString()}</p>
<hr>
<p>${message.replace(/\n/g, "<br>")}</p>
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

  if (req.method === "GET" && req.url === "/messages") {
    const dir = path.join(__dirname, "protected_messages");

    if (!fs.existsSync(dir)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([]));
      return;
    }

    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".html"));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(files));
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/messages/")) {
    const filename = decodeURIComponent(req.url.replace("/messages/", ""));

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

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Secure password-protected server running on port ${PORT}.`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000);
});
