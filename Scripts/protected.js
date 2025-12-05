console.log("Protected.js loaded!");

// Backend endpoints
const VERIFY_ENDPOINT = "http://localhost:3000/verify";
const MESSAGES_ENDPOINT = "http://localhost:3000/messages";

// HTML elements
const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("errorMessage");
const passwordSection = document.getElementById("passwordSection");
const protectedContent = document.getElementById("protectedContent");
const messageList = document.getElementById("messageList");
const noMessages = document.getElementById("noMessages");
const logoutBtn = document.getElementById("logoutBtn");

// ---------------- LOGIN HANDLING ----------------

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = passwordInput.value.trim();
    if (!password) return;

    try {
        const response = await fetch(VERIFY_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password })
        });

        const result = await response.json();
        console.log("Verify response:", result);

        if (result.success) {
    console.log("SUCCESS BLOCK TRIGGERED");  // <----- ADD THIS
    
    errorMessage.style.display = "none";
    passwordSection.style.display = "none";
    protectedContent.style.display = "block";
    loadMessages();
} else {
    console.log("FAILED BLOCK TRIGGERED");  // (optional)
    errorMessage.style.display = "block";
}


    } catch (err) {
        console.error("Error verifying password:", err);
        errorMessage.style.display = "block";
    }
});

// ---------------- MESSAGE LOADING ----------------

async function loadMessages() {
    try {
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

    } catch (err) {
        console.error("Error loading messages:", err);
    }
}

// ---------------- LOGOUT ----------------

logoutBtn.addEventListener("click", () => {
    protectedContent.style.display = "none";
    passwordSection.style.display = "block";
    passwordInput.value = "";
});
