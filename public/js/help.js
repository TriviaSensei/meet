const contactForm = document.querySelector('#contact-form');
import { handleRequest } from './utils/requestHandler.js';
import { showMessage } from './utils/messages.js';

document.addEventListener('DOMContentLoaded', () => {
	contactForm.addEventListener('submit', (e) => {
		e.preventDefault();
		const [name, email, subject, message] = [
			'name',
			'email',
			'subject',
			'your-message',
		].map((a) => {
			return document.querySelector(`#${a}`)?.value;
		});

		const body = {
			name,
			email,
			subject,
			message,
		};

		const str = '/api/v1/contact';
		const handler = (res) => {
			if (res.status === 'success') {
				contactForm.innerHTML =
					'Your message has been sent. I will respond to you as soon as possible.';
				showMessage('info', 'Message sent.');
			} else {
				showMessage('error', 'Something went wrong. Please try again later.');
			}
		};

		handleRequest(str, 'POST', body, handler);
	});
});
