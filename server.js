// server.js — Heroku-ready: serves your static site + API endpoints

const http = require("http");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Load hashed password
const EXPECTED_HASH = process.env.LAB_PASSWORD_HASH;

// If hash missing → fail early
if (!EXPECTED_HASH) {
  console.error("ERROR: LAB_PASSWORD_HASH missing (set it in Heroku Config Vars)");
  process.exit(1);
}

// Hash function (MUST match browser exactly)
function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & 0xffffffff;
  }
  if (hash & 0x80000000) {
    hash = -((~hash + 1) & 0xffffffff);
  }
  return hash.toString(16);
}

function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html": return "text/html; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".js": return "application/javascript; charset=utf-8";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".svg": return "image/svg+xml";
    case ".ico": return "image/x-icon";
    default: return "application/octet-stream";
  }
}

// Only serve static files from these safe paths:
function isAllowedStaticPath(urlPath) {
  return (
    urlPath === "/" ||
    urlPath.endsWith(".html") ||
    urlPath.startsWith("/pics/") ||
    urlPath.startsWith("/CSS/") ||
    urlPath.startsWith("/Scripts/")
  );
}

function serveStatic(req, res) {
  // Map "/" to "/index.html"
  let urlPath = req.url === "/" ? "/index.html" : req.url;

  // Strip query string
  urlPath = urlPath.split("?")[0];

  if (!isAllowedStaticPath(urlPath)) return false;

  // Normalize + prevent path traversal
  const decoded = decodeURIComponent(urlPath);
  const normalized = path.normalize(decoded);

  if (normalized.includes("..")) {
    res.writeHead(400);
    res.end("Bad request");
    return true;
  }

  const filePath = path.join(__dirname, normalized);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(400);
    res.end("Bad request");
    return true;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }

  const file = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
  res.end(file);
  return true;
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // ===================== API: VERIFY PASSWORD ======================
  if (req.method === "POST" && req.url === "/verify") {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const password = data.password || "";
        const hashed = hashPassword(password);
        const success = hashed === EXPECTED_HASH;
        sendJson(res, 200, { success });
      } catch {
        sendJson(res, 400, { success: false });
      }
    });
    return;
  }

  // ====================== API: CONTACT FORM SAVE ======================
  if (req.method === "POST" && req.url === "/contact") {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));

    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const { name, email, message, member } = data;

        if (!name || !email || !message) {
          sendJson(res, 400, { success: false });
          return;
        }

        const dir = path.join(__dirname, "protected_messages");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);

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
<p>${String(message).replace(/\n/g, "<br>")}</p>
</body>
</html>`;

        fs.writeFileSync(filePath, html);
        sendJson(res, 200, { success: true });
      } catch {
        sendJson(res, 500, { success: false });
      }
    });

    return;
  }

  // ====================== API: GET MESSAGE LIST ======================
  if (req.method === "GET" && req.url === "/messages") {
    const dir = path.join(__dirname, "protected_messages");

    if (!fs.existsSync(dir)) {
      sendJson(res, 200, []);
      return;
    }

    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".html"));
    sendJson(res, 200, files);
    return;
  }

  // ====================== API: SERVE INDIVIDUAL MESSAGE ======================
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
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(file);
    return;
  }

  // ====================== STATIC SITE ======================
  if (req.method === "GET") {
    const served = serveStatic(req, res);
    if (served) return;
  }

  // ====================== FALLBACK 404 ======================
  sendJson(res, 404, { error: "Not found" });
});

// Heroku requires PORT from env
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}.`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000);
});
