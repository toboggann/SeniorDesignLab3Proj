document.addEventListener('DOMContentLoaded', function() {
    // Highlight current page in navigation
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    navLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        if (linkHref === currentPage || 
            (currentPage === '' && linkHref === 'index.html') ||
            (currentPage === 'index.html' && linkHref === 'index.html')) {
            link.classList.add('active');
        }
    });
    
    // Handle dropdown functionality for mobile
    const dropdowns = document.querySelectorAll('.dropdown');
    
    dropdowns.forEach(dropdown => {
        dropdown.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                const content = this.querySelector('.dropdown-content');
                content.style.display = content.style.display === 'block' ? 'none' : 'block';
            }
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.matches('.dropbtn') && !e.target.matches('.dropdown-content a')) {
            const dropdowns = document.querySelectorAll('.dropdown-content');
            dropdowns.forEach(dropdown => {
                if (window.innerWidth <= 768) {
                    dropdown.style.display = 'none';
                }
            });
        }
    });
    //contact form
    const form = document.getElementById("contactForm");
    const submitMessage = document.getElementById("formMessage");

    form.addEventListener("submit",async function(e){
        e.preventDefault(); //stop refresh
        console.log("Form submitted!");
        

        const data = {
    name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    message: document.getElementById("message").value,
    member: "Thomas"
};

        //send
        try{
            const response = await fetch("http://localhost:3000/contact",{
                method:"POST",
                headers:{"Content-Type": "application/json"},
                body:JSON.stringify(data)
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
} 
else {
    submitMessage.textContent = "Message failed to send";
    submitMessage.className = "error";
    submitMessage.style.display = "block";
}

        }
        catch(error){
            console.error("Error sending message:", error);
            submitMessage.textContent="Server error";
        }
    });
});