document.addEventListener("DOMContentLoaded", function () {
  // ===================== NAV HIGHLIGHT =====================
  const currentPage = window.location.pathname.split("/").pop();
  const navLinks = document.querySelectorAll(".nav-menu a");

  navLinks.forEach((link) => {
    const linkHref = link.getAttribute("href");
    if (
      linkHref === currentPage ||
      (currentPage === "" && linkHref === "index.html") ||
      (currentPage === "index.html" && linkHref === "index.html")
    ) {
      link.classList.add("active");
    }
  });

  // ===================== DROPDOWN (MOBILE) =====================
  const dropdowns = document.querySelectorAll(".dropdown");
  dropdowns.forEach((dropdown) => {
    dropdown.addEventListener("click", function (e) {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        const content = this.querySelector(".dropdown-content");
        content.style.display =
          content.style.display === "block" ? "none" : "block";
      }
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", function (e) {
    if (
      !e.target.matches(".dropbtn") &&
      !e.target.matches(".dropdown-content a")
    ) {
      const dropdownContents = document.querySelectorAll(".dropdown-content");
      dropdownContents.forEach((dropdown) => {
        if (window.innerWidth <= 768) {
          dropdown.style.display = "none";
        }
      });
    }
  });

  // ===================== CONTACT FORM =====================
  const form = document.getElementById("contactForm");
  const submitMessage = document.getElementById("formMessage");

  if (!form) return; // safety in case this JS is loaded on a page without the form

  // Decide which backend to talk to:
  // - localhost    -> local Node server
  // - anything else (Heroku) -> ngrok tunnel to your laptop
  const API_BASE =
    window.location.hostname === "localhost"
      ? "http://localhost:3000"
      : "https://unadoptively-coarsest-herschel.ngrok-free.dev"; // your ngrok URL

  form.addEventListener("submit", async function (e) {
    e.preventDefault(); // stop refresh
    console.log("Form submitted!");

    const data = {
      name: document.getElementById("name").value,
      email: document.getElementById("email").value,
      message: document.getElementById("message").value,
      member: "Manny",
    };

    try {
      const response = await fetch(`${API_BASE}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const responseResult = await response.json();

      if (responseResult.success) {
        submitMessage.textContent = "Message sent!";
        submitMessage.className = "success";
        submitMessage.style.display = "block";

        // clear form
        document.getElementById("name").value = "";
        document.getElementById("email").value = "";
        document.getElementById("message").value = "";
      } else {
        submitMessage.textContent = "Message failed to send";
        submitMessage.className = "error";
        submitMessage.style.display = "block";
      }
    } catch (error) {
      console.error("Error sending message:", error);
      submitMessage.textContent = "Server error";
      submitMessage.className = "error";
      submitMessage.style.display = "block";
    }
  });
});
