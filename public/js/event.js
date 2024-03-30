import { showMessage } from './utils/messages.js';
import { StateHandler } from './utils/stateHandler.js';
import { handleRequest } from './utils/requestHandler.js';
import { createElement } from './utils/createElementFromSelector.js';
import { getElementArray } from './utils/getElementArray.js';

let userData;

const tzSelect = document.querySelector('#timezone');

const tooltipTriggerList = document.querySelectorAll(
	'[data-bs-toggle="tooltip"]'
);
const tooltipList = [...tooltipTriggerList].map(
	(tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
);

document.addEventListener('DOMContentLoaded', () => {
	userData = JSON.parse(
		document.querySelector('#data-area')?.getAttribute('data-user')
	);

	const eventData = JSON.parse(
		document.querySelector('#data-area')?.getAttribute('data-event')
	);
	console.log(eventData);

	const userTZ =
		userData && userData.timeZone ? userData.timeZone : moment.tz.guess();
	const allTimeZones = moment.tz.names();
	allTimeZones.forEach((tz) => {
		const op = createElement('option');
		op.setAttribute('value', tz);
		op.innerHTML = tz;
		tzSelect.appendChild(op);
		if (tz === userTZ) op.setAttribute('selected', true);
	});
});
