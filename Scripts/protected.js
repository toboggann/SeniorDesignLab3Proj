// protected.js — session-based (30 min) Heroku + localhost ready

const VERIFY_ENDPOINT = "/verify";
const SESSION_ENDPOINT = "/session";
const MESSAGES_ENDPOINT = "/messages";
const LOGOUT_ENDPOINT = "/logout";

const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("errorMessage");
const passwordSection = document.getElementById("passwordSection");
const protectedContent = document.getElementById("protectedContent");
const messageList = document.getElementById("messageList");
const noMessages = document.getElementById("noMessages");
const logoutBtn = document.getElementById("logoutBtn");

function showProtected() {
  errorMessage.style.display = "none";
  passwordSection.style.display = "none";
  protectedContent.style.display = "block";
}

function showLogin(showError = false) {
  protectedContent.style.display = "none";
  passwordSection.style.display = "block";
  errorMessage.style.display = showError ? "block" : "none";
}

// On page load: restore session (valid for 30 min, refreshed by /session)
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch(SESSION_ENDPOINT, { method: "GET" });
    const data = await res.json();

    if (data.authenticated) {
      showProtected();
      loadMessages();
    } else {
      showLogin(false);
    }
  } catch {
    // If server is unreachable or bad response, fall back to login UI
    showLogin(false);
  }
});

// LOGIN
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const password = passwordInput.value.trim();

  try {
    const res = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    const result = await res.json();

    if (result.success) {
      showProtected();
      passwordInput.value = "";
      loadMessages();
    } else {
      showLogin(true);
    }
  } catch {
    showLogin(true);
  }
});

// LOAD MESSAGES
async function loadMessages() {
  try {
    const res = await fetch(MESSAGES_ENDPOINT, { method: "GET" });

    // If session expired, server will return 401
    if (res.status === 401) {
      showLogin(false);
      return;
    }

    const files = await res.json();
    messageList.innerHTML = "";

    if (!Array.isArray(files) || files.length === 0) {
      noMessages.style.display = "block";
      return;
    }

    noMessages.style.display = "none";

    files.forEach((file) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `/messages/${encodeURIComponent(file)}`;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = file;
      li.appendChild(a);
      messageList.appendChild(li);
    });
  } catch {
    // If something went wrong, just show "no messages"
    noMessages.style.display = "block";
  }
}

// LOGOUT (clears server session cookie)
logoutBtn.addEventListener("click", async () => {
  try {
    await fetch(LOGOUT_ENDPOINT, { method: "POST" });
  } catch {
    // ignore ts
  }
  showLogin(false);
  passwordInput.value = "";
  messageList.innerHTML = "";
});
