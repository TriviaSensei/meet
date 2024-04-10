import { showMessage } from './utils/messages.js';
import { StateHandler } from './utils/stateHandler.js';
import { handleRequest } from './utils/requestHandler.js';
import { createElement } from './utils/createElementFromSelector.js';
import { getElementArray } from './utils/getElementArray.js';

let userData;

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

const touchStart = (e) => {
	const tt = e.type === 'touchstart' ? e.targetTouches[0] : e;
	touchState.setState({
		touchActive: true,
		cell1: e.target.closest('.calendar-box'),
		cell2: e.target.closest('.calendar-box'),
		x: tt.pageX,
		y: tt.pageY,
	});
	console.log(touchState.getState());
};

let scrollInterval = null;
const touchMove = (e) => {
	const state = touchState.getState();

	if (e.type === 'mousemove' && !state.touchActive) return;

	//number of pixels on the sides of the box where autoscroll will be activated
	const bufferZone = 50;
	//amount to scroll
	const delta = 100;
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
	getElementArray(document, '.calendar-box').some((c) => {
		const rect = c.getBoundingClientRect();
		if (
			x >= rect.left &&
			x <= rect.right &&
			y >= rect.top &&
			y <= rect.bottom
		) {
			touchState.setState((prev) => {
				return {
					...prev,
					cell2: c,
					x,
					y,
				};
			});
			return true;
		}
	});

	//are we close to the edge of the box, and should we scroll?
	const calendar = e.target.closest('.tab-pane#my-calendar-pane');
	if (!calendar) return;
	const calRect = calendar.getBoundingClientRect();
	//moving left and in the left buffer zone
	//moving left
	if (xDir <= 0 && x <= calRect.left + bufferZone) {
		if (scrollInterval) clearInterval(scrollInterval);
		scrollInterval = setInterval(() => {
			$(`#${calendar.getAttribute('id')}`)
				.stop()
				.animate(
					{
						scrollLeft:
							$(`#${calendar.getAttribute('id')}`).scrollLeft() - delta,
					},
					interval
				);
		}, interval);
	}
	//moving right
	else if (xDir >= 0 && x >= calRect.right - bufferZone) {
		if (scrollInterval) clearInterval(scrollInterval);
		scrollInterval = setInterval(() => {
			$(`#${calendar.getAttribute('id')}`)
				.stop()
				.animate(
					{
						scrollLeft:
							$(`#${calendar.getAttribute('id')}`).scrollLeft() + delta,
					},
					interval
				);
		}, interval);
	}
	//moving down
	else if (yDir >= 0 && y >= calRect.bottom - bufferZone) {
		if (scrollInterval) clearInterval(scrollInterval);
		scrollInterval = setInterval(() => {
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
	else if (yDir >= 0 && y <= calRect.top + bufferZone) {
		if (scrollInterval) clearInterval(scrollInterval);
		scrollInterval = setInterval(() => {
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
	if (scrollInterval) clearInterval(scrollInterval);
	touchState.setState((prev) => {
		return {
			...prev,
			touchActive: false,
			x: null,
			y: null,
		};
	});
};

const generateCalendar = (area, event) => {
	// return console.log(event);
	area.innerHTML = '';
	const userTZ = tzSelect.value;
	const localOffset = new Date().getTimezoneOffset();
	if (event.eventType === 'date-time') {
		//sort the event dates
		const ed = event.dates.sort((a, b) => {
			return Date.parse(a) - Date.parse(b);
		});

		//create the date columns for each date...
		const timeWindows = [];
		ed.forEach((d, i) => {
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
		console.log(timeWindows);

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

				if (!startTime) startTime = startHr * 60 + startMin;
				else if (startHr * 60 + startMin < startTime)
					startTime = startHr * 60 + startMin;

				if (!endTime) endTime = endHr * 60 + endMin;
				else if (endHr * 60 + endMin > endTime)
					endTime = endHr * 60 + endMin > endTime;
			}
		});
		console.log(startTime, endTime);

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
						Date.parse(new Date(dateStr)) +
							localOffset * 60 * 1000 +
							(j === 1 && event.times[1] === 1440 ? -1 : 0)
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
					//do we need a spacer?
					if (i !== 0) {
						//date string for day before this one
						const lastDate = new Date(
							Date.parse(dateStr) + localOffset * 60000 - 1000 * 60 * 60 * 24
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
			newRow.setAttribute('data-time', i);
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
					}
					// } else if (j === 0 && k % 60 === 45 && endTime - k <= 15) {
					// 	const lbl = createElement('.time-label-last');
					// 	lbl.innerHTML = `${(hr + 1) % 12 === 0 ? 12 : (hr + 1) % 12} ${
					// 		hr % 12 === 11 ? (ampm === 'AM' ? 'PM' : 'AM') : ampm
					// 	}`;
					// 	// newBox.appendChild(lbl);
					// }
				} else {
					const newBox = createElement('td.disabled');
					newBox.setAttribute('data-time', i);
					newBox.setAttribute('data-date', col.getAttribute('data-date'));

					const dt = `${col.getAttribute('data-date')}T${
						hr < 10 ? '0' : ''
					}${hr}:${min}:00.000`;
					newBox.setAttribute('data-dt', dt);
					newBox.setAttribute('data-col', j);
					newBox.setAttribute('data-row', (i - startTime) / 15);
					newRow.appendChild(newBox);

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

		//for each column, create the date boxes
	}
};

const adjustTabSize = () => {
	const totalHeight = document
		.querySelector('.app-container')
		.getBoundingClientRect().height;
	const loginContainerHeight = document
		.querySelector('#login-container')
		.getBoundingClientRect().height;
	const tabHeight = document
		.querySelector('#tab-list')
		.getBoundingClientRect().height;
	const mh = totalHeight - loginContainerHeight - tabHeight;
	console.log(totalHeight, loginContainerHeight, tabHeight, mh);
	const tc = document.querySelector('.tab-content');
	tc.setAttribute('style', `max-height:calc(${mh}px - 3rem);`);
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
	const userDataStr = document
		.querySelector('#data-area')
		?.getAttribute('data-user');
	if (!userDataStr) userData = undefined;
	else userData = JSON.parse(userDataStr);

	const eventData = JSON.parse(
		document.querySelector('#data-area')?.getAttribute('data-event')
	);

	const userTZ =
		userData && userData.timeZone ? userData.timeZone : moment.tz.guess();
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
		console.log(eventData);
		generateCalendar(myCalendarArea, eventData);
	}

	tzSelect.addEventListener('change', () => {
		generateCalendar(myCalendarArea, eventData);
	});

	myCalendarArea.addEventListener('touchstart', touchStart);
	myCalendarArea.addEventListener('mousedown', touchStart);
	myCalendarArea.addEventListener('touchmove', touchMove);
	myCalendarArea.addEventListener('mousemove', touchMove);
	myCalendarArea.addEventListener('touchend', touchEnd);
	document.addEventListener('mouseup', (e) => {
		if (touchState.getState().isMobile) return;
		touchState.setState((prev) => {
			return { ...prev, touchActive: false };
		});
	});
});
