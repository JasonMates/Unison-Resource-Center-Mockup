/**
 * Contact.html page interactions.
 * Shared navigation behavior lives in site-navigation.js.
 */
document.getElementById('contact-form').addEventListener('submit', event => {
  event.preventDefault();
  const note = document.getElementById('form-note');
  if (!event.currentTarget.checkValidity()) { event.currentTarget.reportValidity(); note.textContent = 'Please complete the required fields.'; return; }
  note.textContent = 'This prototype form is not connected, so your information was not sent.';
});

