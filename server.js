// server.js — Heroku-ready: serves static site + API endpoints + 30-min sessions

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

// Load hashed password
const EXPECTED_HASH = process.env.LAB_PASSWORD_HASH;

// If hash missing → fail early
if (!EXPECTED_HASH) {
  console.error("ERROR: LAB_PASSWORD_HASH missing (set it in Heroku Config Vars)");
  process.exit(1);
}

// ===================== 30-MIN SESSION STORE (in memory) =====================
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const sessions = new Map(); // token -> expiresAt (ms)

// cleanup expired sessions occasionally
setInterval(() => {
  const now = Date.now();
  for (const [token, exp] of sessions.entries()) {
    if (exp <= now) sessions.delete(token);
  }
}, 60 * 1000).unref();

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(v.join("=") || "");
  });
  return out;
}

function setSessionCookie(res, token, maxAgeSeconds) {
  // Secure cookies only over HTTPS. Heroku is HTTPS, localhost usually isn't.
  const isHeroku = !!process.env.DYNO;
  const secure = isHeroku ? "; Secure" : "";

  res.setHeader(
    "Set-Cookie",
    `sd_session=${encodeURIComponent(token)}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Lax${secure}`
  );
}

function clearSessionCookie(res) {
  const isHeroku = !!process.env.DYNO;
  const secure = isHeroku ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `sd_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`
  );
}

function getValidSession(req) {
  const cookies = parseCookies(req);
  const token = cookies.sd_session;
  if (!token) return null;

  const exp = sessions.get(token);
  if (!exp) return null;

  if (exp <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return token;
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
  let urlPath = req.url === "/" ? "/index.html" : req.url;
  urlPath = urlPath.split("?")[0];

  if (!isAllowedStaticPath(urlPath)) return false;

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

// Parse request body as JSON OR x-www-form-urlencoded
function parseBody(req, raw) {
  const ct = (req.headers["content-type"] || "").toLowerCase();

  if (ct.includes("application/json")) {
    return JSON.parse(raw || "{}");
  }

  if (ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(raw);
    return Object.fromEntries(params.entries());
  }

  // fallback
  return JSON.parse(raw || "{}");
}

const server = http.createServer((req, res) => {
  // CORS (fine for same-origin use; if you ever use fetch with credentials, don't use "*")
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // ===================== API: VERIFY PASSWORD (SETS 30-MIN SESSION) ======================
  if (req.method === "POST" && (req.url === "/verify" || req.url === "/verify/")) {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => {
      try {
        const data = parseBody(req, body);
        const password = data.password || "";
        const hashed = hashPassword(password);
        const success = hashed === EXPECTED_HASH;

        if (success) {
          const token = crypto.randomBytes(32).toString("hex");
          sessions.set(token, Date.now() + SESSION_TTL_MS);
          setSessionCookie(res, token, 30 * 60); // 30 minutes
        }

        sendJson(res, 200, { success });
      } catch {
        sendJson(res, 400, { success: false });
      }
    });
    return;
  }

  // ===================== API: SESSION CHECK (REFRESHES TTL) ======================
  if (req.method === "GET" && (req.url === "/session" || req.url === "/session/")) {
    const token = getValidSession(req);

    if (!token) {
      clearSessionCookie(res);
      sendJson(res, 200, { authenticated: false });
      return;
    }

    // Refresh session to 30 minutes from now (so clicking away/back stays logged in)
    sessions.set(token, Date.now() + SESSION_TTL_MS);
    setSessionCookie(res, token, 30 * 60);

    sendJson(res, 200, { authenticated: true });
    return;
  }

  // ===================== API: LOGOUT ======================
  if (req.method === "POST" && (req.url === "/logout" || req.url === "/logout/")) {
    const cookies = parseCookies(req);
    const token = cookies.sd_session;
    if (token) sessions.delete(token);
    clearSessionCookie(res);
    sendJson(res, 200, { success: true });
    return;
  }

  // ====================== API: CONTACT FORM SAVE ======================
  // ====================== API: CONTACT FORM SAVE ======================
if (req.method === "POST" && (req.url === "/contact" || req.url === "/contact/")) {
  let body = "";
  req.on("data", (chunk) => (body += chunk.toString()));

  req.on("end", () => {
    try {
      const data = parseBody(req, body);
      const { name, email, message, member } = data;

      console.log("CONTACT REQUEST DATA:", data);  // 👈 ADD THIS

      if (!name || !email || !message) {
        console.log("CONTACT: missing fields");    // 👈 AND THIS
        sendJson(res, 400, { success: false, error: "Missing fields" });
        return;
      }

      const dir = path.join(__dirname, "protected_messages");
      fs.mkdirSync(dir, { recursive: true });

      const timestamp = Date.now();
      const safeName = String(name).replace(/[^a-z0-9]/gi, "_");
      const filename = `${timestamp}_${safeName}.html`;
      const filePath = path.join(dir, filename);

      console.log("WRITING FILE TO:", filePath);  // 👈 AND THIS

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
      console.log("CONTACT: saved successfully ✅"); // 👈 AND THIS

      sendJson(res, 200, { success: true });
    } catch (e) {
      console.error("CONTACT SAVE ERROR:", e);      // 👈 THIS ALREADY EXISTS
      sendJson(res, 500, { success: false });
    }
  });

  return;
}


  // ====================== PROTECTED: GET MESSAGE LIST ======================
  if (req.method === "GET" && req.url === "/messages") {
    if (!getValidSession(req)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    const dir = path.join(__dirname, "protected_messages");
    if (!fs.existsSync(dir)) {
      sendJson(res, 200, []);
      return;
    }

    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".html"));
    sendJson(res, 200, files);
    return;
  }

  // ====================== PROTECTED: SERVE INDIVIDUAL MESSAGE ======================
  if (req.method === "GET" && req.url.startsWith("/messages/")) {
    if (!getValidSession(req)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

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
