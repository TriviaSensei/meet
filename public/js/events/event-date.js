import { showMessage } from '../utils/messages.js';
import { StateHandler } from '../utils/stateHandler.js';
import { handleRequest } from '../utils/requestHandler.js';
import { createElement } from '../utils/createElementFromSelector.js';
import { getElementArray } from '../utils/getElementArray.js';
import { dows, dowNames, months, colors } from './params.js';
import {
	createHandleLoginArea,
	createHandleSaveNotes,
} from './handleLoginArea.js';

const login = document.querySelector('#login-button');
const userName = document.querySelector('#user-name');
const password = document.querySelector('#password');
const myCalendarArea = document.querySelector('#calendar-container');
const teamCalendarArea = document.querySelector('#team-calendar');
const legendBar = document.querySelector('#legend-bar');
const copyButton = document.querySelector('#copy-url');
const userFilterList = document.querySelector('#user-filter-list');
const personCount = document.querySelector('#person-count');
const personButton = document.querySelector('#person-button');
const calendarHeading = document.querySelector('#calendar-heading');
const selectClear = document.querySelector('#select-clear-container');
const selectAllAvail = document.querySelector('#select-all');
const clearAvail = document.querySelector('#clear-availability');
const tct = document.querySelector('#team-calendar-tab');
const saveNotes = document.querySelector('#save-notes');

const errorMessage = 'Something went wrong. Try again in a few seconds.';

const tooltipTriggerList = document.querySelectorAll(
	'[data-bs-toggle="tooltip"]'
);
const tooltipList = [...tooltipTriggerList].map(
	(tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
);

let eventState, userState, url;

const updateAvailability = (e) => {
	//add API connection here
	const es = eventState.getState();
	const us = userState.getState();

	const checked = getElementArray(
		myCalendarArea,
		'input[type="checkbox"]:checked'
	).map((cb) => cb.value);

	const str = `/api/v1/events/updateAvailability/${es.url}`;
	const handler = (res) => {
		if (res.status !== 'success') {
			showMessage('error', errorMessage);
			userState.setState((prev) => {
				return {
					...prev,
					availability: checked,
				};
			});
		} else {
			eventState.setState(res.data);
			generateCalendar(teamCalendarArea, res.data);
		}
	};
	handleRequest(
		str,
		'PATCH',
		{
			availability: checked,
		},
		handler
	);
};

const createOption = (str, dataset) => {
	const toReturn = createElement('.time-option');
	const cb = createElement('input');
	cb.setAttribute('type', 'checkbox');
	const props = Object.getOwnPropertyNames(dataset);
	props.forEach((p) => {
		if (typeof dataset[p] === 'boolean') {
			if (!dataset[p]) return;
			else cb[p] = true;
		} else cb.setAttribute(p, dataset[p]);
	});
	cb.addEventListener('change', updateAvailability);
	toReturn.appendChild(cb);
	const lbl = createElement('label');
	lbl.setAttribute('for', dataset.id);
	lbl.innerHTML = str;
	toReturn.appendChild(lbl);
	return toReturn;
};

const generateCalendar = (area, event) => {
	area.innerHTML = '';
	const user = userState.getState();
	if (!user.name) return;
	const localOffset = new Date().getTimezoneOffset();

	const candidates = event.dates
		.map((d) => {
			return moment.tz(d, event.timeZone).format();
		})
		.sort((a, b) => {
			return new Date(a) - new Date(b);
		});
	candidates.forEach((c) => {
		const dt = moment.tz(c, event.timeZone).tz('GMT').format();
		const arr = dt.split('T');
		const date = arr[0];
		let dateSlot = area.querySelector(`.date-slot[data-date="${date}"]`);
		if (!dateSlot) {
			dateSlot = createElement('.date-slot');
			dateSlot.setAttribute('data-date', date);
			dateSlot.setAttribute('data-dt', dt);
			const dowIndex = new Date(
				Date.parse(new Date(dt)) + localOffset * 60000
			).getDay();
			const dow =
				event.eventType === 'date' ? dows[dowIndex] : dowNames[dowIndex];
			const dateArr = date.split('-');
			const mon = months[Number(dateArr[1]) - 1];
			dateSlot.setAttribute(
				'data-str',
				event.eventType === 'date'
					? `${dow} ${dateArr[2]} ${mon} ${dateArr[0]}`
					: dow
			);
			area.appendChild(dateSlot);
		}
	});
	if (area === myCalendarArea) {
		getElementArray(area, '.date-slot').forEach((ds) => {
			const dt = ds.getAttribute('data-dt');
			const opt = createOption(ds.getAttribute('data-str'), {
				value: dt,
				id: `date-${ds.getAttribute('data-date')}`,
				checked: user.availability.includes(dt),
			});
			ds.appendChild(opt);
		});
	} else {
		const dateSlots = getElementArray(area, '.date-slot');
		dateSlots.forEach((ds) => {
			ds.removeAttribute('data-count');
		});
		event.users.forEach((u) => {
			u.availability.forEach((a) => {
				const ds = area.querySelector(`.date-slot[data-dt="${a}"]`);
				if (!ds) return;
				if (!ds.getAttribute('data-count')) ds.setAttribute('data-count', 1);
				else
					ds.setAttribute(
						'data-count',
						Number(ds.getAttribute('data-count')) + 1
					);
				if (!ds.getAttribute('data-users'))
					ds.setAttribute('data-users', u.name);
				else
					ds.setAttribute(
						'data-users',
						`${ds.getAttribute('data-users')},${u.name}`
					);
			});
		});
		const innerWidth = 40;
		let diff;
		dateSlots.forEach((ds, i) => {
			const barContainer = createElement('.bar-container');
			barContainer.setAttribute('data-value', ds.getAttribute('data-dt'));
			const lbl = createElement('.bar-label');
			lbl.innerHTML = ds.getAttribute('data-str');
			barContainer.appendChild(lbl);
			const bar = createElement('.bar');
			const barInner = createElement('.bar-inner');
			barInner.setAttribute('data-date', ds.getAttribute('data-date'));
			barInner.setAttribute('data-count', ds.getAttribute('data-count') || 0);
			barInner.setAttribute('data-bs-toggle', 'tooltip');
			barInner.setAttribute('data-bs-html', 'true');
			if (
				ds.getAttribute('data-count') &&
				ds.getAttribute('data-count') !== '0'
			) {
				barInner.setAttribute(
					'data-bs-title',
					`${ds.getAttribute('data-str')}<br><u>${ds.getAttribute(
						'data-count'
					)} available</u><br>${ds
						.getAttribute('data-users')
						.split(',')
						.join('<br>')}`
				);
				new bootstrap.Tooltip(barInner);
			}
			barInner.innerHTML = barInner.getAttribute('data-count');
			bar.appendChild(barInner);
			barContainer.appendChild(bar);
			ds.appendChild(barContainer);
			if (!diff) diff = bar.getBoundingClientRect().width - innerWidth;
			const ct = Number(barInner.getAttribute('data-count'));
			const pct = ct / event.users.length;
			const color = colorMap[ct].color;
			const pl = parseFloat(getComputedStyle(barInner).paddingLeft);
			if (ct > 0)
				barInner.setAttribute(
					'style',
					`background-color:#${color};width:${innerWidth + pct * diff - pl}px;`
				);
		});
		applyFilters();
	}
};

const adjustTabSize = () => {
	const totalHeight = document
		.querySelector('.app-container')
		.getBoundingClientRect().height; //742.4
	const headerHeight = document
		.querySelector('.header-section')
		.getBoundingClientRect().height; //25.9
	const mh = totalHeight - headerHeight;
	const tc = document.querySelector('.body-section');
	tc.setAttribute('style', `max-height:calc(${mh}px - 0.5rem);`);
	setCalendarSize();
};

const handleLogin = (e) => {
	if (!login || e.target !== login) return;

	const user = userName?.value;
	const pw = password?.value;
	const eventId = location.href.split('/').pop();

	if ((userName && !user) || (password && !pw))
		return showMessage('error', 'Please provide a username and password.');

	if (!eventId) return showMessage('error', errorMessage);

	const handler = (res) => {
		if (res.status === 'success') {
			const user = res.event.users.find((u) => {
				return u.id === res.user;
			});
			if (!user) return showMessage('error', 'User not found');
			showMessage('info', `Logged in as ${user.name}`);
			userState.setState(user);
			eventState.setState(res.event);
			//add the new user to the checkbox filters
			const checkRow = userFilterList.querySelector(`#person-${user.id}`);
			if (!checkRow) {
				const newRow = createElement('.d-flex.flex-row');
				const chk = createElement('input.me-2');
				chk.setAttribute('id', `person-${user.id}`);
				chk.setAttribute('type', 'checkbox');
				chk.setAttribute('value', user.name);
				chk.setAttribute('name', 'user-filter');
				newRow.appendChild(chk);
				const lbl = createElement('label');
				lbl.setAttribute('for', `person-${user.id}`);
				lbl.innerHTML = user.name;
				newRow.appendChild(lbl);
				userFilterList.appendChild(newRow);
				chk.addEventListener('change', applyFilters);
				eventState.setState(res.event);
			}
			//set the maxvalue of the personCount filter
			personCount.setAttribute('max', res.event.users.length);

			generateCalendar(myCalendarArea, res.event);
			generateCalendar(teamCalendarArea, res.event);
		} else {
			showMessage('error', res.message);
		}
	};

	handleRequest(
		`/api/v1/events/login/${eventId}`,
		'POST',
		{
			name: user,
			password: pw,
		},
		handler
	);
};

const allAvailability = (e) => {
	getElementArray(myCalendarArea, 'input[type="checkbox"]').forEach((cb) => {
		cb.checked = true;
	});

	updateAvailability();
};

const clearAvailability = (e) => {
	const state = eventState.getState();
	const us = userState.getState();
	handleRequest(
		`/api/v1/events/updateAvailability/${state.url}`,
		'PATCH',
		{ availability: [] },
		(res) => {
			if (res.status === 'success') {
				userState.setState((prev) => {
					return {
						...prev,
						availability: [],
					};
				});

				getElementArray(
					myCalendarArea,
					'input[type="checkbox"]:checked'
				).forEach((cb) => {
					cb.checked = false;
				});
				showMessage('info', 'Availability cleared');
				eventState.setState(res.data);
				generateCalendar(teamCalendarArea, res.data);
			} else {
				showMessage('error', res.message);
				userState.setState(us);
			}
		}
	);
};

let colorMap = [];
const drawLegend = (e) => {
	colorMap = [];
	const labels = getElementArray(document, '.legend-label');
	const userCount = e.detail.users.length;
	const boxCount = Math.min(colors.length, userCount + 1);

	labels[0].innerHTML = `0/${userCount}`;
	labels[1].innerHTML = `${userCount}/${userCount} available`;

	e.target.innerHTML = '';
	const interval = Math.max(1, (colors.length - 1) / (boxCount - 1));

	for (var i = 0; i < boxCount; i++) {
		const newBox = createElement('.f-1');
		const x = Math.round(i * interval);
		newBox.setAttribute('style', `background-color:#${colors[x]}`);

		e.target.appendChild(newBox);

		colorMap.push({
			count: (i / (boxCount - 1)) * userCount,
			color: colors[x],
		});
	}
};

const setCalendarSize = (e) => {
	const container = document.querySelector('#team-calendar-pane');
	if (!container) return;

	const wrapper = container.querySelector('.tab-wrapper');
	if (!wrapper) return;

	const mh = container.getBoundingClientRect().height;

	let usedHeight = 0;

	Array.from(wrapper.children, (x) => x).forEach((c) => {
		if (c === teamCalendarArea) return;
		const rect = c.getBoundingClientRect();
		if (rect) usedHeight = usedHeight + rect.height;
	});
	teamCalendarArea.setAttribute(
		'style',
		`max-height:calc(${mh - usedHeight}px - 0.5rem);`
	);

	teamCalendarArea.setAttribute(
		'style',
		`max-height:calc(${mh - usedHeight}px - 0.5rem);`
	);

	if (eventState && (!e || e.target === tct))
		generateCalendar(teamCalendarArea, eventState.getState());
};

const addTooltip = (cell) => {
	if (!cell) return;
	cell.setAttribute('data-bs-toggle', 'tooltip');
	cell.setAttribute('data-bs-html', 'true');
	const timeStr = cell.getAttribute('data-time');
	const hr = Number(timeStr.split(':')[0]);
	const min = timeStr.split(':')[1];
	const ampm = hr < 12 ? 'AM' : 'PM';

	cell.setAttribute(
		'data-bs-title',
		`${cell.getAttribute('data-date')}<br>${
			hr % 12 === 0 ? 12 : hr % 12
		}:${min} ${ampm}<br><u>${cell.getAttribute(
			'data-count'
		)} available</u><br>${cell
			.getAttribute('data-users')
			.split(',')
			.join('<br>')}`
	);
	cell.setAttribute('tabindex', 0);
	new bootstrap.Tooltip(cell);
};

const removeTooltip = (el) => {
	if (!el) return;
	el.removeAttribute('data-bs-toggle');
	el.removeAttribute('data-bs-html');
	el.removeAttribute('data-bs-title');
	el.removeAttribute('tabindex');
};

const applyFilters = () => {
	const state = eventState.getState();

	const pcf = document.querySelector('#person-count-filter-text');
	const pf = document.querySelector('#person-filter-text');

	const minVal = Number(personCount.value);
	const checkedUsers = getElementArray(
		document,
		'input[type="checkbox"][name="user-filter"]:checked'
	).map((c) => {
		return c.getAttribute('value');
	});
	personButton.innerHTML = `${checkedUsers.length} selected`;
	let anyAll = document
		.querySelector('input[type="radio"][name="user-filter-radio"]:checked')
		?.getAttribute('value');
	if (!anyAll) {
		anyAll = 'all';
		const allRadio = document.querySelector('#user-filter-all');
		if (allRadio) allRadio.checked = true;
	}

	//filter text
	if (checkedUsers.length === 0 && minVal === 1) {
		pcf.innerHTML = 'Filters';
		pf.innerHTML = '';
	} else if (anyAll === 'all') {
		if (minVal <= checkedUsers.length) {
			pcf.innerHTML = '';
			pf.innerHTML = `${
				checkedUsers.length > 4 ? checkedUsers.length : checkedUsers.join(', ')
			} available`;
		} else {
			pcf.innerHTML = `${minVal}+ available${
				checkedUsers.length > 0 ? ';' : ''
			}`;
			if (checkedUsers.length === 0) pf.innerHTML = '';
			else
				pf.innerHTML = `${
					checkedUsers.length > 3
						? checkedUsers.length
						: checkedUsers.join(', ')
				} required`;
		}
	} else {
		if (minVal === 1) pcf.innerHTML = '';
		else
			pcf.innerHTML = `${minVal}+ available${
				checkedUsers.length > 0 ? ',' : ''
			}`;

		if (checkedUsers.length > 1)
			pf.innerHTML = `${minVal === 1 ? 'Any' : 'including any'} of ${
				checkedUsers.length > 4 ? checkedUsers.length : checkedUsers.join(', ')
			}`;
		else if (checkedUsers.length === 1)
			pf.innerHTML = `${
				minVal === 1
					? checkedUsers[0] + ' available'
					: 'including ' + checkedUsers[0]
			}`;
		else pf.innerHTML = '';
	}

	//remove the bars with too few available users
	getElementArray(teamCalendarArea, '.date-slot').forEach((ds) => {
		const ct = ds.getAttribute('data-count');
		if (!ct || Number(ct) < minVal) {
			ds.classList.add('d-none');
			return;
		} else ds.classList.remove('d-none');

		//of the bars that have enough people, remove the ones without the right users
		const barUsers = ds.getAttribute('data-users')?.split(',');
		if (!barUsers) {
			ds.classList.add('d-none');
			return;
		} else if (checkedUsers.length === 0) return;

		if (anyAll === 'any') {
			if (
				!barUsers.some((u) => {
					return checkedUsers.includes(u);
				})
			)
				ds.classList.add('d-none');
		} else if (anyAll === 'all') {
			if (
				checkedUsers.some((u) => {
					return !barUsers.includes(u);
				})
			)
				ds.classList.add('d-none');
		}
	});
};

document.addEventListener('DOMContentLoaded', () => {
	adjustTabSize();
	window.addEventListener('resize', adjustTabSize);
	const dataArea = document.querySelector('#data-area');
	const userDataStr = dataArea?.getAttribute('data-user');
	const eventData = JSON.parse(dataArea?.getAttribute('data-event'));
	if (eventData) {
		eventState = new StateHandler(eventData);
		if (eventData.url) url = eventData.url;
	}
	if (!userDataStr)
		userState = new StateHandler({
			id: null,
			name: '',
			availability: [],
		});
	else userState = new StateHandler(JSON.parse(userDataStr));
	userState.addWatcher(null, createHandleLoginArea(userState, eventState));
	userState.addWatcher(calendarHeading, (e) => {
		if (!e.detail.name)
			e.target.innerHTML = 'You must log in to see your calendar.';
		else e.target.innerHTML = 'Select your available dates:';
	});
	userState.addWatcher(selectClear, (e) => {
		if (e.detail.name) e.target.classList.remove('d-none');
		else e.target.classList.add('d-none');
	});

	dataArea.remove();

	eventState.addWatcher(legendBar, drawLegend);

	if (eventData) {
		generateCalendar(myCalendarArea, eventData);
		generateCalendar(teamCalendarArea, eventData);
	}

	document.addEventListener('shown.bs.collapse', setCalendarSize);
	document.addEventListener('hidden.bs.collapse', setCalendarSize);
	document.addEventListener('shown.bs.tab', setCalendarSize);

	copyButton.addEventListener('click', () => {
		navigator.clipboard.writeText(`https://www.meetyouat.net/${url}`);
		showMessage('info', 'Copied URL to clipboard');
	});

	getElementArray(userFilterList, 'input[type="checkbox"]').forEach((c) => {
		c.addEventListener('change', applyFilters);
	});
	getElementArray(document, '[name="user-filter-radio"]').forEach((r) => {
		r.addEventListener('change', applyFilters);
	});
	personCount.addEventListener('change', applyFilters);

	if (login) login.addEventListener('click', handleLogin);
	selectAllAvail.addEventListener('click', allAvailability);
	clearAvail.addEventListener('click', clearAvailability);
	if (saveNotes)
		saveNotes.addEventListener(
			'click',
			createHandleSaveNotes(userState, eventState)
		);
});
