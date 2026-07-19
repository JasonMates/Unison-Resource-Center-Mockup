/**
 * index.html page interactions.
 * Shared navigation behavior lives in site-navigation.js.
 */
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: .12 });
document.querySelectorAll('.reveal').forEach(element => observer.observe(element));

document.getElementById('contact-form').addEventListener('submit', event => {
  event.preventDefault();
  document.getElementById('form-note').textContent = 'This prototype form is not connected, so your information was not sent. Connect a form endpoint to accept submissions.';
});
