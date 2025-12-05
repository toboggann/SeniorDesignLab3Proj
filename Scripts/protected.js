// protected.js — clean final version

const VERIFY_ENDPOINT = "http://localhost:3000/verify";
const MESSAGES_ENDPOINT = "http://localhost:3000/messages";

const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("errorMessage");
const passwordSection = document.getElementById("passwordSection");
const protectedContent = document.getElementById("protectedContent");
const messageList = document.getElementById("messageList");
const noMessages = document.getElementById("noMessages");
const logoutBtn = document.getElementById("logoutBtn");

// LOGIN
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = passwordInput.value.trim();

    const res = await fetch(VERIFY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
    });

    const result = await res.json();

    if (result.success) {
        errorMessage.style.display = "none";
        passwordSection.style.display = "none";
        protectedContent.style.display = "block";
        loadMessages();
    } else {
        errorMessage.style.display = "block";
    }
});

// LOAD MESSAGES
async function loadMessages() {
    const res = await fetch(MESSAGES_ENDPOINT);
    const files = await res.json();

    messageList.innerHTML = "";

    if (files.length === 0) {
        noMessages.style.display = "block";
        return;
    }

    noMessages.style.display = "none";

    files.forEach(file => {
        const li = document.createElement("li");
        li.innerHTML = `<a href="http://localhost:3000/messages/${file}" target="_blank">${file}</a>`;
        messageList.appendChild(li);
    });
}

// LOGOUT
logoutBtn.addEventListener("click", () => {
    protectedContent.style.display = "none";
    passwordSection.style.display = "block";
    passwordInput.value = "";
});
