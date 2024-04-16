import { showMessage } from './utils/messages.js';
import { StateHandler } from './utils/stateHandler.js';
import { handleRequest } from './utils/requestHandler.js';
import { createElement } from './utils/createElementFromSelector.js';
import { getElementArray } from './utils/getElementArray.js';

const loginContainer = document.querySelector('#login-container');
const login = document.querySelector('#login-button');
const userName = document.querySelector('#user-name');
const password = document.querySelector('#password');
const tzSelect = document.querySelector('#timezone');
const myCalendarArea = document.querySelector('#my-calendar');
const teamCalendarArea = document.querySelector('#team-calendar');

const tooltipTriggerList = document.querySelectorAll(
	'[data-bs-toggle="tooltip"]'
);
const tooltipList = [...tooltipTriggerList].map(
	(tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
);

const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
];

const testTimeZones = [
	'Europe/Lisbon',
	'America/New_York',
	'America/Los_Angeles',
	'America/Halifax',
];

let touchState = new StateHandler({
	isMobile: false,
	touchActive: false,
	cell1: null,
	cell2: null,
	x: null,
	y: null,
});

let eventState, userState;

const toGMT = (dt, zone) => {
	return moment.tz(dt, zone).tz('GMT').format();
};
const toUserTZ = (dt, zone) => {
	return moment.tz(dt, 'GMT').tz(zone).format();
};

const touchStart = (e) => {
	const state = touchState.getState();
	if (state.isMobile && e.type === 'mousedown') return;
	const user = userState.getState();
	if (!user.name) return;
	const tt = e.type === 'touchstart' ? e.targetTouches[0] : e;
	touchState.setState((prev) => {
		return {
			...prev,
			touchActive: true,
			cell1: e.target.closest('td'),
			cell2: e.target.closest('td'),
			x: tt.pageX,
			y: tt.pageY,
		};
	});
};

let xScrollInterval = null;
let yScrollInterval = null;
const checkForCell = (x, y) => {
	let toReturn = getElementArray(document, '.time-cell').find((c) => {
		const rect = c.getBoundingClientRect();
		if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
			return true;
	});
	return toReturn;
};
const touchMove = (e) => {
	const state = touchState.getState();

	if (!state.touchActive) return;
	const user = userState.getState();
	if (!user.name) return;

	//number of pixels on the sides of the box where autoscroll will be activated
	const bufferZone = document
		.querySelector('.time-cell')
		.getBoundingClientRect().width;
	//amount to scroll
	const delta = bufferZone;
	//scroll interval in ms
	const interval = 125;

	//don't scroll the page on touch move
	e.preventDefault();
	//x and y coordinates of current position

	const [x, y] = [
		e.type === 'touchmove' ? e.changedTouches[0].pageX : e.pageX,
		e.type === 'touchmove' ? e.changedTouches[0].pageY : e.pageY,
	];

	//xDirection - 1 for right, -1 for left, 0 for no x movement
	const xDir = state.x > x ? -1 : state.x === x ? 0 : 1;
	//yDirection - 1 for down, -1 for up, 0 for no y movement
	const yDir = state.y > y ? -1 : state.y === y ? 0 : 1;

	// are we over a second cell?
	const cell2 = checkForCell(x, y);
	if (cell2)
		touchState.setState((prev) => {
			return {
				...prev,
				cell2: cell2,
				x,
				y,
			};
		});

	//are we close to the edge of the box, and should we scroll?
	const calendar = e.target.closest('.tab-wrapper');
	if (!calendar) return;
	const calRect = calendar.getBoundingClientRect();
	//moving left and in the left buffer zone
	if (xScrollInterval) clearInterval(xScrollInterval);
	if (xDir <= 0 && x <= calRect.left + bufferZone) {
		xScrollInterval = setInterval(() => {
			$(`#${calendar.getAttribute('id')}`)
				.stop()
				.animate(
					{
						scrollLeft:
							$(`#${calendar.getAttribute('id')}`).scrollLeft() - delta,
					},
					interval
				);
			const c = checkForCell(x, y);
			if (c)
				touchState.setState((prev) => {
					return {
						...prev,
						cell2: c,
						x,
						y,
					};
				});
		}, interval);
	}
	//moving right
	else if (xDir >= 0 && x >= calRect.right - bufferZone) {
		xScrollInterval = setInterval(() => {
			$(`#${calendar.getAttribute('id')}`)
				.stop()
				.animate(
					{
						scrollLeft:
							$(`#${calendar.getAttribute('id')}`).scrollLeft() + delta,
					},
					interval
				);
			const c = checkForCell(x, y);
			if (c)
				touchState.setState((prev) => {
					return {
						...prev,
						cell2: c,
						x,
						y,
					};
				});
		}, interval);
	}

	//moving down
	if (yScrollInterval) clearInterval(yScrollInterval);
	if (yDir >= 0 && y >= calRect.bottom - bufferZone) {
		yScrollInterval = setInterval(() => {
			$(`#${calendar.getAttribute('id')}`)
				.stop()
				.animate(
					{
						scrollTop: $(`#${calendar.getAttribute('id')}`).scrollTop() + delta,
					},
					interval
				);
		}, interval);
	}
	//moving up
	else if (yDir <= 0 && y <= calRect.top + bufferZone) {
		yScrollInterval = setInterval(() => {
			$(`#${calendar.getAttribute('id')}`)
				.stop()
				.animate(
					{
						scrollTop: $(`#${calendar.getAttribute('id')}`).scrollTop() - delta,
					},
					interval
				);
		}, interval);
	}
};

const touchEnd = (e) => {
	const state = touchState.getState();
	if (!state.touchActive) return;
	touchState.setState((prev) => {
		return {
			...prev,
			touchActive: false,
		};
	});
	if (xScrollInterval) clearInterval(xScrollInterval);
	if (yScrollInterval) clearInterval(yScrollInterval);
	const user = userState.getState();
	const oldUser = userState.getState();
	if (!user.name) return;

	let rowStart = Number(state.cell1.getAttribute('data-row'));
	let rowEnd = Number(state.cell2.getAttribute('data-row'));
	if (rowStart > rowEnd) [rowStart, rowEnd] = [rowEnd, rowStart];
	let colStart = Number(state.cell1.getAttribute('data-col'));
	let colEnd = Number(state.cell2.getAttribute('data-col'));
	if (colStart > colEnd) [colStart, colEnd] = [colEnd, colStart];

	const selectedDates = [];
	for (var i = rowStart; i <= rowEnd; i++) {
		for (var j = colStart; j <= colEnd; j++) {
			const dt = myCalendarArea
				.querySelector(`.time-cell[data-row="${i}"][data-col="${j}"]`)
				?.getAttribute('data-dt');
			if (dt) selectedDates.push(dt);
		}
	}
	//we are toggling off
	if (user.availability.includes(state.cell1.getAttribute('data-dt'))) {
		user.availability = user.availability.filter((a) => {
			return !selectedDates.includes(a);
		});
	}
	//we are toggling on
	else {
		selectedDates.forEach((sd) => {
			if (!user.availability.includes(sd)) user.availability.push(sd);
		});
	}
	userState.setState(user);

	touchState.setState((prev) => {
		return {
			...prev,
			touchActive: false,
			x: null,
			y: null,
		};
	});

	//add API connection here
	const es = eventState.getState();
	const str = `/api/v1/events/updateAvailability/${es.url}`;
	const handler = (res) => {
		if (res.status !== 'success') {
			showMessage('error', res.message);
			userState.setState(oldUser);
		}
	};
	handleRequest(
		str,
		'PATCH',
		{
			availability: user.availability,
		},
		handler
	);
};

const handleDrag = (e) => {
	const cells = getElementArray(e.target, `.toggle-on, .toggle-off`);
	cells.forEach((c) => {
		if (!e.detail.touchActive && c.classList.contains('toggle-on'))
			c.classList.add('selected');
		c.classList.remove('toggle-on');
		c.classList.remove('toggle-off');
	});
	//if no touch active, remove the class from this cell
	if (!e.detail.touchActive) return;

	const c1 = e.detail.cell1;
	const c2 = e.detail.cell2;
	let rowStart = Number(c1.getAttribute('data-row'));
	let rowEnd = Number(c2.getAttribute('data-row'));
	if (rowStart > rowEnd) [rowStart, rowEnd] = [rowEnd, rowStart];
	let colStart = Number(c1.getAttribute('data-col'));
	let colEnd = Number(c2.getAttribute('data-col'));
	if (colStart > colEnd) [colStart, colEnd] = [colEnd, colStart];

	const user = userState.getState();

	if (
		user.availability.includes(
			moment.tz(c1.getAttribute('data-dt'), user.timeZone).format()
		)
	) {
		for (var i = rowStart; i <= rowEnd; i++) {
			for (var j = colStart; j <= colEnd; j++) {
				const cell = e.target.querySelector(
					`.time-cell[data-row="${i}"][data-col="${j}"]`
				);
				if (cell) cell.classList.add('toggle-off');
			}
		}
	} else {
		for (var i = rowStart; i <= rowEnd; i++) {
			for (var j = colStart; j <= colEnd; j++) {
				const cell = e.target.querySelector(
					`.time-cell[data-row="${i}"][data-col="${j}"]`
				);
				if (cell) cell.classList.add('toggle-on');
			}
		}
	}
};

const handleHighlight = (e) => {
	if (!e.detail.availability) return;

	const boxes = getElementArray(e.target, 'td.selected');
	boxes.forEach((b) => {
		if (!e.detail.availability.includes(b.getAttribute('data-dt')))
			b.classList.remove('selected');
	});
	e.detail.availability.forEach((d) => {
		const box = e.target.querySelector(`td[data-dt="${d}"]`);
		if (box) box.classList.add('selected');
	});
};

const generateCalendar = (area, event) => {
	const startTime = new Date();
	area.innerHTML = '';
	const userTZ = tzSelect.value;
	const user = userState.getState();
	const localOffset = new Date().getTimezoneOffset();
	if (event.eventType === 'date-time') {
		//sort the event dates
		const ed = event.dates.sort((a, b) => {
			return Date.parse(a) - Date.parse(b);
		});

		//create the date columns for each date...
		const timeWindows = [];
		ed.forEach((d) => {
			//calculate the time window
			const timeWindow = event.times.map((t, j) => {
				const m = moment
					.tz(
						Date.parse(d) +
							t * 60 * 1000 +
							(j === 1 && event.times[0] >= event.times[1] ? 1440 : 0) *
								60 *
								1000 -
							(j === 1 && event.times[1] === 0 ? 1000 : 0),
						'GMT'
					)
					.tz(event.timeZone, true);
				return m.tz(userTZ).format();
			});
			timeWindows.push(timeWindow);
		});

		//determine the start and end times of each column
		let startTime, endTime;
		//figure out the earliest start and latest end for any time window
		//if any window stretches between days, the entire day must be displayed
		timeWindows.forEach((tw) => {
			const [a, b] = tw.map((t) => {
				return t.split('T')[0];
			});
			if (a !== b) {
				startTime = 0;
				endTime = 1440;
			} else {
				const [ta, tb] = tw.map((t) => {
					return t.split('T')[1];
				});
				const startHr = Number(ta.split(':')[0]);
				const startMin = Number(ta.split(':')[1]);
				const endHr = Number(tb.split(':')[0]);
				const endMin = Number(tb.split(':')[1]);

				//find the earliest  start time and latest end time
				//it will usually be the same for the entire window, but
				//DST can mess with this, so we need this logic.
				if (!startTime) startTime = startHr * 60 + startMin;
				else startTime = Math.min(startHr * 60 + startMin, startTime);

				if (!endTime) endTime = endHr * 60 + endMin;
				else endTime = Math.max(endTime, endHr * 60 + endMin > endTime);
			}
		});

		const tbl = createElement('table');
		area.appendChild(tbl);
		const headerRow = createElement('tr');
		tbl.appendChild(headerRow);
		const ulc = createElement('td.spacer');
		headerRow.appendChild(ulc);

		//create the table headers
		timeWindows.forEach((tw, i) => {
			//see if one already exists
			tw.forEach((t, j) => {
				const dateStr = t.split('T')[0];
				//if not, create it
				const existingHeader = area.querySelector(
					`table tr:first-child td[data-date="${dateStr}"]`
				);
				if (!existingHeader) {
					const th = createElement('td');
					const d = new Date(
						Date.parse(new Date(`${dateStr}T00:00:00.000+00:00`)) +
							localOffset * 60000
					);
					const dow = dows[d.getDay()];
					const mon = months[d.getMonth()];
					const date = dateStr.split('-')[2];

					const wd = createElement('.weekday');
					const dateDiv = createElement('.date');

					th.appendChild(dateDiv);
					th.appendChild(wd);

					wd.innerHTML = dow;
					dateDiv.innerHTML = `${mon} ${date}`;
					th.setAttribute('data-date', dateStr);
					th.setAttribute('data-column', j);
					//do we need a spacer?
					if (i !== 0) {
						//date string for day before this one
						const lastDate = new Date(
							Date.parse(new Date(`${dateStr}T00:00:00.000+00:00`)) -
								86400000 +
								localOffset * 60000
						);
						const lastDateStr = `${lastDate.getFullYear()}-${
							lastDate.getMonth() + 1 < 10
								? `0${lastDate.getMonth() + 1}`
								: lastDate.getMonth() + 1
						}-${
							lastDate.getDate() < 10
								? `0${lastDate.getDate()}`
								: lastDate.getDate()
						}`;
						//if that date doesn't exist, we need a spacer column
						if (!area.querySelector(`td[data-date="${lastDateStr}"]`)) {
							const sp = createElement('td.spacer');
							headerRow.appendChild(sp);
						}
					}

					headerRow.appendChild(th);
				}
			});
		});

		//create the time rows
		const cols = getElementArray(area, 'table tr:first-child td');
		for (var i = startTime; i < endTime; i += 15) {
			const hr = Math.floor(i / 60);
			const min = i % 60 === 0 ? '00' : i % 60;
			const ampm = i >= 720 ? 'PM' : 'AM';

			const newRow = createElement('tr');
			newRow.setAttribute('data-time', `${hr}:${min}`);
			newRow.setAttribute('data-row', (i - startTime) / 15);
			tbl.appendChild(newRow);
			//look at the column headers
			cols.forEach((col, j) => {
				//if it's spacer, we need a spacer here too.
				if (!col.getAttribute('data-date')) {
					const sp = createElement('td.spacer');
					newRow.appendChild(sp);

					//if it's the first column, put the hour marker every 4th space
					if (j === 0 && i % 60 === 0) {
						const lbl = createElement('.time-label');
						lbl.innerHTML = `${hr % 12 === 0 ? 12 : hr % 12} ${ampm}`;
						sp.appendChild(lbl);
					} else if (j === 0 && i % 60 === 45 && endTime - i <= 15) {
						const lbl = createElement('.time-label.last');
						lbl.innerHTML = `${(hr + 1) % 12 === 0 ? 12 : (hr + 1) % 12} ${
							hr % 12 === 11 ? (ampm === 'AM' ? 'PM' : 'AM') : ampm
						}`;
						sp.appendChild(lbl);
					}

					// 	// newBox.appendChild(lbl);
					// }
				} else {
					const newBox = createElement('td.time-cell.disabled');
					newBox.setAttribute('data-time', `${hr}:${min}`);
					newBox.setAttribute('data-date', col.getAttribute('data-date'));
					const dtStr = `${col.getAttribute('data-date')} ${
						hr < 10 ? '0' : ''
					}${hr}:${min}`;
					newBox.setAttribute(
						'data-dt',
						moment.tz(dtStr, user.timeZone || event.timeZone).format()
					);
					newBox.setAttribute('data-col', j);
					newBox.setAttribute('data-row', (i - startTime) / 15);
					newRow.appendChild(newBox);
					if (area === myCalendarArea) {
						newBox.addEventListener('touchstart', touchStart);
						newBox.addEventListener('mousedown', touchStart);
						newBox.addEventListener('touchmove', touchMove);
						newBox.addEventListener('mousemove', touchMove);
					}
					//this box's date time
					const boxDT = moment
						.tz(
							`${col.getAttribute('data-date')} ${
								hr < 10 ? '0' : ''
							}${hr}:${min}`,
							userTZ
						)
						.format();
					//should this box be enabled?
					if (
						event.dates.some((d) => {
							const windowStart = moment
								.tz(Date.parse(d) + event.times[0] * 60000, 'GMT')
								.format();
							let windowEnd;

							if (event.times[0] < event.times[1]) {
								windowEnd = moment
									.tz(Date.parse(d) + event.times[1] * 60000, 'GMT')
									.format();
							} else {
								windowEnd = moment
									.tz(Date.parse(d) + (event.times[1] + 1440) * 60000, 'GMT')
									.format();
							}
							const bdt = Date.parse(boxDT);
							if (
								Date.parse(windowStart) + localOffset * 60000 <= bdt &&
								Date.parse(windowEnd) + localOffset * 60000 > bdt
							)
								return true;
						})
					) {
						newBox.classList.remove('disabled');
					}
				}
			});
		}
	}
	const b = new Date();
	console.log(`Calendar generated in ${b - startTime} ms`);

	if (area === myCalendarArea)
		handleHighlight({
			detail: user,
			target: area,
		});
	// console.trace();

	// const availability = user.availability.map((d) => {
	// 	return toUserTZ(d, user.timeZone);
	// });
	// availability.forEach((d) => {
	// 	const arr = d.split('-');
	// 	arr.pop();
	// 	const str = arr.join('-') + '.000Z';
	// 	const box = area.querySelector(`td[data-dt="${str}"]`);
	// 	if (box) box.classList.add('selected');
	// 	// if (availability.includes(`${toUserTZ(dt, user.timeZone)}`)) {
	// 	// 	newBox.classList.add('selected');
	// 	// }
	// });
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
};

const handleLogin = (e) => {
	if (!login || e.target !== login) return;

	const user = userName?.value;
	const pw = password?.value;

	if ((userName && !user) || (password && !pw))
		return showMessage('error', 'Please provide a username and password.');

	const eventId = eventState.getState().url;
	if (!eventId) return showMessage('error', 'Something went wrong');

	const handler = (res) => {
		if (res.status === 'success') {
			const user = res.event.users.find((u) => {
				return u.id === res.user;
			});
			if (!user) return showMessage('error', 'User not found');
			showMessage('info', `Logged in as ${user.name}`);
			userState.setState(user);
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
			} else {
				showMessage('error', res.message);
				userState.setState(us);
			}
		}
	);
};

const changeTimeZone = (e) => {
	const user = userState.getState();
	const event = eventState.getState();
	const handler = (res) => {
		if (res.status === 'success') {
			userState.setState(res.user);
			generateCalendar(myCalendarArea, res.event);
			generateCalendar(teamCalendarArea, res.event);
		} else {
			showMessage('error', res.message);
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

document.addEventListener('DOMContentLoaded', () => {
	document.body.addEventListener(
		'touchstart',
		() => {
			touchState.setState((prev) => {
				return {
					...prev,
					isMobile: true,
				};
			});
		},
		{ once: true }
	);

	adjustTabSize();
	window.addEventListener('resize', adjustTabSize);
	const dataArea = document.querySelector('#data-area');
	const userDataStr = dataArea?.getAttribute('data-user');
	if (!userDataStr)
		userState = new StateHandler({
			id: null,
			name: '',
			availability: [],
			timeZone: '',
		});
	else userState = new StateHandler(JSON.parse(userDataStr));
	userState.addWatcher(null, (state) => {
		if (!state.name) return;
		loginContainer.innerHTML = '';
		const cont = createElement('.d-flex.flex-row.w-100.my-2');
		const sp1 = createElement('span.bold.me-2');
		const sp2 = createElement('span');
		const btn = createElement('button.btn.btn-primary.btn-sm.mx-2');
		sp1.innerHTML = 'Logged in as:';
		sp2.innerHTML = state.name;
		btn.innerHTML = 'Clear Availability';
		btn.addEventListener('click', clearAvailability);
		loginContainer.appendChild(cont);
		cont.appendChild(sp1);
		cont.appendChild(sp2);
		cont.appendChild(btn);

		getElementArray(tzSelect, 'option').some((o, i) => {
			if (o.value === state.timeZone) {
				tzSelect.selectedIndex = i;
				return true;
			}
		});
	});
	const us = userState.getState();

	const eventData = JSON.parse(dataArea?.getAttribute('data-event'));
	dataArea.remove();
	const userTZ = us && us.timeZone ? us.timeZone : moment.tz.guess();
	const allTimeZones = moment.tz.names();
	allTimeZones.forEach((tz) => {
		const op = createElement('option');
		op.setAttribute('value', tz);
		op.innerHTML = tz;
		if (
			!testTimeZones ||
			testTimeZones.length === 0 ||
			testTimeZones.includes(tz)
		)
			tzSelect.appendChild(op);
		if (tz === userTZ) op.setAttribute('selected', true);
	});

	if (eventData) {
		eventState = new StateHandler(eventData);
		generateCalendar(myCalendarArea, eventData);
		generateCalendar(teamCalendarArea, eventData);
	}

	tzSelect.addEventListener('change', changeTimeZone);
	touchState.addWatcher(myCalendarArea, handleDrag);
	userState.addWatcher(myCalendarArea, handleHighlight);

	document.addEventListener('touchend', touchEnd);
	document.addEventListener('mouseup', (e) => {
		if (touchState.getState().isMobile) return;
		touchEnd(e);
	});

	if (login) login.addEventListener('click', handleLogin);
});