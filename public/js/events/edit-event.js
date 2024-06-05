import { handleRequest } from '../utils/requestHandler.js';
import { showMessage } from '../utils/messages.js';
const m = new bootstrap.Modal(document.querySelector('#edit-info-modal'));

const updateInfo = () => {
	const nameLabel = document.querySelector('#event-name-label');
	const descLabel = document.querySelector('#event-description-label');
	const eventName = document.querySelector('#event-name');
	const eventDesc = document.querySelector('#event-description');
	const id = location.href.split('/').pop();

	const str = `/api/v1/events/${id}`;
	const handler = (res) => {
		if (res.status === 'success') {
			nameLabel.innerHTML = res.data.name;
			descLabel.innerHTML = res.data.description;
			showMessage('info', 'Event updated.');
			m.hide();
		} else {
			showMessage('error', 'Something went wrong.');
		}
	};
	handleRequest(
		str,
		'PATCH',
		{
			name: eventName.value,
			description: eventDesc.value,
		},
		handler
	);
};

document.addEventListener('DOMContentLoaded', () => {
	const btn = document.querySelector('#confirm-edit-info');
	btn.addEventListener('click', updateInfo);
});
