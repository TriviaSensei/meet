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
const tzSelect = document.querySelector('#timezone');
const myCalendarArea = document.querySelector('#my-calendar');
const teamCalendarArea = document.querySelector('#team-calendar');
const legendBar = document.querySelector('#legend-bar');
const copyButton = document.querySelector('#copy-url');
const userFilterList = document.querySelector('#user-filter-list');
const personCount = document.querySelector('#person-count');
const personButton = document.querySelector('#person-button');
const filterButton = document.querySelector('#filter-button');
const calendarHeading = document.querySelector('#calendar-heading');
const selectClear = document.querySelector('#select-clear-container');
const selectAllAvail = document.querySelector('#select-all');
const clearAvail = document.querySelector('#clear-availability');
const tct = document.querySelector('#team-calendar-tab');
const saveNotes = document.querySelector('#save-notes');

const errorMessage = 'Something went wrong. Try again in a few seconds.';
let url;

const tooltipTriggerList = document.querySelectorAll(
	'[data-bs-toggle="tooltip"]'
);
const tooltipList = [...tooltipTriggerList].map(
	(tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
);

let eventState, userState;

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
			us.setState((prev) => {
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
	console.log(event);
	// area.innerHTML = '';
	let container = area.querySelector('.cal-inner');
	if (!container) {
		container = createElement('.cal-inner.d-flex.flex-column.w-100.h-100');
		area.appendChild(container);
	}
	container.innerHTML = '';
	const userTZ = tzSelect.value;
	const user = userState.getState();
	const localOffset = new Date().getTimezoneOffset();

	const candidates = event.dates
		.map((d) => {
			return moment.tz(d, event.timeZone).tz(userTZ).format();
		})
		.sort((a, b) => {
			return new Date(a) - new Date(b);
		});

	//set the header text if needed
	if (area === myCalendarArea) {
		if (!user.name) {
			container.innerHTML = '';
			return;
		}
	}

	//2025-01-05 was a Sunday - figure out how many days passed
	const baseDate = new Date('2025-01-05');
	//set the date slots
	candidates.forEach((c) => {
		console.log(c);
		const arr = c.split('T');
		const date = arr[0];
		const dtTest = new Date(date);
		//number of days passed since 2025-01-05 mod 7 to determine dow
		let dowIndex = Math.round((dtTest - baseDate) / 86400000) % 7;
		if (dowIndex < 0) dowIndex += 7;
		console.log(dowIndex);
		let dateSlot = area.querySelector(`.date-slot[data-date="${date}"]`);
		if (!dateSlot) {
			dateSlot = createElement('.date-slot');
			dateSlot.setAttribute('data-date', date);
			if (area === teamCalendarArea) dateSlot.setAttribute('data-count', 0);
			container.appendChild(dateSlot);
			const dateHeader = createElement('.date-header');
			const dow =
				event.eventType === 'date-list' ? dows[dowIndex] : dowNames[dowIndex];
			const m = months[Number(date.split('-')[1] - 1)];
			const dateArr = date.split('-');
			dateHeader.innerHTML =
				event.eventType === 'date-list'
					? `${dow} ${m} ${dateArr[2]}, ${dateArr[0]}`
					: dow;
			dateSlot.appendChild(dateHeader);
		}
	});

	//set the time slots
	if (area === myCalendarArea) {
		candidates.forEach((c) => {
			const arr = c.split('T');
			const date = arr[0];
			const timeArr = arr[1]
				.split('-')[0]
				.split(':')
				.map((n) => Number(n));
			let dateSlot = container.querySelector(`.date-slot[data-date="${date}"]`);
			const timeStr = `${
				timeArr[0] % 12 === 0
					? 12
					: timeArr[0] % 12 < 10
					? `0${timeArr[0] % 12}`
					: timeArr[0] % 12
			}:${timeArr[1] === 0 ? '00' : timeArr[1]} ${
				timeArr[0] >= 12 ? 'PM' : 'AM'
			}`;
			const timeSlot = container.querySelector(`.time-option[value="${c}"]`);
			if (!timeSlot) {
				const newTime = createOption(timeStr, {
					'data-date': date,
					'data-time': timeStr,
					value: c,
					id: `cb-${Date.parse(new Date(c))}`,
					checked: user.availability.includes(c),
				});
				dateSlot.appendChild(newTime);
			}
		});
	} else {
		candidates.forEach((c) => {
			const arr = c.split('T');
			const date = arr[0];
			const dateSlot = container.querySelector(
				`.date-slot[data-date="${date}"]`
			);
			const timeArr = arr[1]
				.split('-')[0]
				.split(':')
				.map((n) => Number(n));
			const timeStr = `${
				timeArr[0] % 12 === 0
					? 12
					: timeArr[0] % 12 < 10
					? `0${timeArr[0] % 12}`
					: timeArr[0] % 12
			}:${timeArr[1] === 0 ? '00' : timeArr[1]} ${
				timeArr[0] >= 12 ? 'PM' : 'AM'
			}`;
			let barContainer = container.querySelector(
				`.bar-container[data-value="${c}"]`
			);
			if (!barContainer) {
				barContainer = createElement('.bar-container');
				barContainer.setAttribute('data-value', c);
				const lbl = createElement('.bar-label');
				lbl.innerHTML = timeStr;
				barContainer.appendChild(lbl);
				const bar = createElement('.bar');
				const barInner = createElement('.bar-inner');
				barInner.setAttribute('data-date', date);
				barInner.setAttribute('data-time', timeStr);
				barInner.setAttribute(
					'data-count',
					barContainer.getAttribute('data-count')
				);
				barInner.setAttribute('data-bs-toggle', 'tooltip');
				barInner.setAttribute('data-bs-html', 'true');
				bar.appendChild(barInner);
				barContainer.appendChild(bar);
				dateSlot.appendChild(barContainer);
			}
			barContainer.setAttribute('data-count', 0);
		});
		event.users.forEach((u) => {
			u.availability.forEach((a) => {
				const v = moment
					.tz(a, u.timeZone)
					.tz(user.timeZone || tzSelect.value)
					.format();
				const bc = area.querySelector(`.bar-container[data-value="${v}"]`);
				if (!bc) return;
				bc.setAttribute(
					'data-count',
					Number(bc.getAttribute('data-count')) + 1 || 1
				);
				const list = bc.getAttribute('data-users');
				if (!list) bc.setAttribute('data-users', u.name);
				else if (list.indexOf(u.name) < 0)
					bc.setAttribute('data-users', `${list},${u.name}`);
			});
		});
		getElementArray(container, '.date-slot').forEach((ds) => {
			let count = 0;
			getElementArray(ds, '.bar-container').forEach((bc) => {
				count = count + (Number(bc.getAttribute('data-count')) || 0);
			});
			ds.setAttribute('data-count', count);
		});
		getElementArray(container, '.bar-container').forEach((b) => {
			const inner = b.querySelector('.bar-inner');
			if (b.getAttribute('data-count') !== '0') {
				inner.setAttribute(
					'data-bs-title',
					`${inner.getAttribute('data-date')}<br>${inner.getAttribute(
						'data-time'
					)}<br><u>${b.getAttribute('data-count')} available</u><br>${b
						.getAttribute('data-users')
						.split(',')
						.join('<br>')}`
				);
				new bootstrap.Tooltip(inner);
				inner.setAttribute('data-count', b.getAttribute('data-count'));
			}
			inner.removeAttribute('style');
			inner.innerHTML = b.getAttribute('data-count');
			const bar = b.querySelector('.bar');
			const innerWidth = 40;
			const diff = bar.getBoundingClientRect().width - innerWidth;
			const ct = Number(b.getAttribute('data-count'));
			const pct = ct / event.users.length;
			const pl = parseFloat(getComputedStyle(inner).paddingLeft);

			const color = colorMap[ct].color;
			if (ct > 0)
				inner.setAttribute(
					'style',
					`background-color:#${color};width:${innerWidth + pct * diff - pl}px;`
				);
		});
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
	setCalendarSize(null);
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
		}
	};

	handleRequest(
		`/api/v1/events/login/${eventId}`,
		'POST',
		{
			name: user,
			password: pw,
			timeZone: tzSelect.value,
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
				showMessage('info', 'Availability cleared');
				getElementArray(myCalendarArea, 'input[type="checkbox"]').forEach(
					(cb) => {
						cb.checked = false;
					}
				);
				generateCalendar(teamCalendarArea, res.data);
			} else {
				showMessage('error', errorMessage);
				userState.setState(us);
			}
		}
	);
};

const changeTimeZone = (e) => {
	const user = userState.getState();
	const event = eventState.getState();
	if (!user.name) {
		generateCalendar(myCalendarArea, event);
		generateCalendar(teamCalendarArea, event);
		populateTeamCalendar(event);
		return applyFilters();
	}
	const handler = (res) => {
		if (res.status === 'success') {
			userState.setState(res.user);
			generateCalendar(myCalendarArea, res.event);
			generateCalendar(teamCalendarArea, res.event);
			populateTeamCalendar(event);
			applyFilters();
		} else {
			showMessage('error', errorMessage);
			const opts = getElementArray(e.target, 'option');
			opts.some((o, i) => {
				if (o.value === user.timeZone) e.target.selectedIndex = i;
				return true;
			});
		}
	};
	handleRequest(
		`/api/v1/events/updateTimeZone/${event.url}`,
		'PATCH',
		{ timeZone: e.target.value },
		handler
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

	legendBar.innerHTML = '';
	const interval = Math.max(1, (colors.length - 1) / (boxCount - 1));

	for (var i = 0; i < boxCount; i++) {
		const newBox = createElement('.f-1');
		const x = Math.round(i * interval);
		newBox.setAttribute('style', `background-color:#${colors[x]}`);

		legendBar.appendChild(newBox);

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

	//remove bars with not enough users
	getElementArray(teamCalendarArea, '.bar-container').forEach((bc) => {
		const n = Number(bc.getAttribute('data-count'));

		if (n < minVal) bc.classList.add('hide');
		else bc.classList.remove('hide');
	});

	//remove bars with not the right users, if necessary
	if (checkedUsers.length > 0) {
		if (anyAll === 'all') {
			getElementArray(
				teamCalendarArea,
				'.bar-container[data-users]:not(.hide)'
			).forEach((bc) => {
				const availableUsers = bc.getAttribute('data-users').split(',');
				if (
					checkedUsers.some((u) => {
						return !availableUsers.includes(u);
					})
				)
					bc.classList.add('hide');
			});
		} else {
			getElementArray(
				teamCalendarArea,
				'.bar-container[data-users]:not(.hide)'
			).forEach((bc) => {
				const availableUsers = bc.getAttribute('data-users').split(',');
				if (
					checkedUsers.every((u) => {
						return !availableUsers.includes(u);
					})
				) {
					bc.classList.add('hide');
				}
			});
		}
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
};

const populateTeamCalendar = (ev) => {};

document.addEventListener('DOMContentLoaded', () => {
	adjustTabSize();
	window.addEventListener('resize', adjustTabSize);
	const dataArea = document.querySelector('#data-area');
	const eventData = JSON.parse(dataArea?.getAttribute('data-event'));
	if (eventData) eventState = new StateHandler(eventData);
	if (eventData.url) url = eventData.url;
	const userDataStr = dataArea?.getAttribute('data-user');
	if (!userDataStr)
		userState = new StateHandler({
			id: null,
			name: '',
			availability: [],
			timeZone: '',
		});
	else userState = new StateHandler(JSON.parse(userDataStr));
	userState.addWatcher(null, createHandleLoginArea(userState, eventState));
	const us = userState.getState();

	dataArea.remove();
	const userTZ = us && us.timeZone ? us.timeZone : moment.tz.guess();
	const allTimeZones = moment.tz.names();
	allTimeZones.forEach((tz) => {
		const op = createElement('option');
		op.setAttribute('value', tz);
		op.innerHTML = tz;

		tzSelect.appendChild(op);
		if (tz === userTZ) op.setAttribute('selected', true);
	});

	userState.addWatcher(calendarHeading, (e) => {
		if (!e.detail.name)
			e.target.innerHTML = 'You must log in to see your calendar.';
		else e.target.innerHTML = 'Select your available times:';
	});
	userState.addWatcher(selectClear, (e) => {
		if (e.detail.name) e.target.classList.remove('d-none');
		else e.target.classList.add('d-none');
	});

	eventState.addWatcher(legendBar, drawLegend);
	eventState.addWatcher(null, (state) => {
		if (state) populateTeamCalendar(state);
	});

	if (eventData) {
		generateCalendar(myCalendarArea, eventData);
		generateCalendar(teamCalendarArea, eventData);
	}

	if (eventData) populateTeamCalendar(eventData);

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
	tzSelect.addEventListener('change', changeTimeZone);
	selectAllAvail.addEventListener('click', allAvailability);
	clearAvail.addEventListener('click', clearAvailability);
	if (saveNotes)
		saveNotes.addEventListener(
			'click',
			createHandleSaveNotes(userState, eventState)
		);
});
