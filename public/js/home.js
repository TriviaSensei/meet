import { showMessage } from './utils/messages.js';
import { StateHandler } from './utils/stateHandler.js';
import { handleRequest } from './utils/requestHandler.js';
import { createElement } from './utils/createElementFromSelector.js';
import { getElementArray } from './utils/getElementArray.js';

const tooltipTriggerList = document.querySelectorAll(
	'[data-bs-toggle="tooltip"]'
);
const tooltipList = [...tooltipTriggerList].map(
	(tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
);

const months = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
].map((m, i) => {
	return {
		name: m,
		number: i,
		days: i === 1 ? 28 : [1, 3, 5, 7, 8, 10, 12].includes(i + 1) ? 31 : 30,
	};
});
const eventName = document.querySelector('#event-name');
const calendarArea = document.querySelector('.calendar');
const monthControl = document.querySelector('#month-control');
const em = document.querySelector('#event-month');
const calendarDays = getElementArray(calendarArea, '.calendar-day');
const tzSelect = document.querySelector('#timezone');
const yearBack = document.querySelector('#prev-year');
const monthBack = document.querySelector('#prev-month');
const yearForward = document.querySelector('#next-year');
const monthForward = document.querySelector('#next-month');
const eventTypeDate = getElementArray(document, 'input[name="event-type"]');
const eventTypeTime = getElementArray(document, 'input[name="event-time"]');
const timeArea = document.querySelector('#time-area');
const timeRange = document.querySelector('#time-range');
const timeList = document.querySelector('#time-list');
const candidateTimes = document.querySelector('#candidate-times');
const addTime = document.querySelector('#add-time');
const h1 = timeRange.querySelector('#event-hour-early');
const m1 = timeRange.querySelector('#event-minute-early');
const a1 = timeRange.querySelector('#event-am-pm-early');
const h2 = timeRange.querySelector('#event-hour-late');
const m2 = timeRange.querySelector('#event-minute-late');
const a2 = timeRange.querySelector('#event-am-pm-late');

const name = document.querySelector('#user-name');
const pw = document.querySelector('#password');
const submitButton = document.querySelector('#create-event');
const resetForm = document.querySelector('#reset-form');
let isMobile;

let sh;

let touchState = new StateHandler({
	touchActive: false,
	cell1: null,
	cell2: null,
});

//month label (March 2024)
const setMonthLabel = (e) => {
	//month label
	e.target.innerHTML = `${e.detail.month.name} ${e.detail.year}`;
};

//calendar boxes
const renderCalendar = (state) => {
	calendarDays.forEach((c) => {
		c.innerHTML = '';
	});

	//find the day of the week that starts this month
	const mo =
		state.month.number + 1 >= 10
			? state.month.number + 1
			: `0${state.month.number + 1}`;
	const str = `${state.year}-${mo}-01T00:00:00.000`;
	const first = new Date(str);
	const wd1 = first.getDay();

	const days =
		state.month.number !== 1
			? state.month.days
			: state.year % 4 === 0 &&
			  (state.year % 100 !== 0 || state.year % 400 === 0)
			? 29
			: 28;

	const fillCalendarDay = (box, date, today, gray) => {
		if (state.selectedDates.includes(date)) box.classList.add('selected');
		else box.classList.remove('selected');

		const cOuter = createElement('.d-flex');
		const c = createElement(`.m-auto${gray ? '.gray-out' : ''}`);
		const n = date.split('-')[2];
		c.innerHTML = Number(n);
		cOuter.appendChild(c);
		box.appendChild(cOuter);
		box.setAttribute('data-date', date);
		if (today) box.classList.add('today');
		else box.classList.remove('today');
	};

	//fill in this month
	for (var i = 0; i < days; i++) {
		fillCalendarDay(
			calendarDays[i + wd1],
			`${state.year}-${mo}-${i < 9 ? '0' : ''}${i + 1}`,
			new Date().getMonth() === state.month.number &&
				i === state.day - 1 &&
				new Date().getFullYear() === state.year,
			false
		);
	}

	//fill in the last month's days, grayed out if needed
	const lastMonth = state.month.number === 0 ? 11 : state.month.number - 1;
	const lastMonthDays =
		lastMonth !== 1
			? months[lastMonth].days
			: state.year % 4 === 0 &&
			  (state.year % 100 !== 0 || state.year % 400 === 0)
			? 29
			: 28;

	for (var i = wd1 - 1; i >= 0; i--) {
		fillCalendarDay(
			calendarDays[i],
			`${lastMonth === 11 ? state.year - 1 : state.year}-${
				lastMonth + 1 < 10 ? `0${lastMonth + 1}` : lastMonth + 1
			}-${lastMonthDays + i - wd1 + 1}`,
			false,
			true
		);
	}

	//fill in next month's days, if needed
	let nextMonthYear, nextMonth;
	if (state.month.number === 11) {
		nextMonthYear = state.year + 1;
		nextMonth = '01';
	} else {
		nextMonthYear = state.year;
		nextMonth =
			state.month.number < 8
				? `0${state.month.number + 2}`
				: state.month.number + 2;
	}
	for (var i = wd1 + days; i < calendarDays.length; i++) {
		const dt = i - wd1 - days + 1;
		fillCalendarDay(
			calendarDays[i],
			`${nextMonthYear}-${nextMonth}-${dt < 10 ? '0' + dt : dt}`,
			false,
			true
		);
	}

	//first cell in row 5 and 6 - check if that day is in this month
	for (var i = 4; i <= 5; i++) {
		const r = document.querySelector(`.calendar-row[data-row="${i}"]`);
		const c = r?.querySelector(`.calendar-day`);
		if (c && c.getAttribute('data-date').startsWith(`${state.year}-${mo}`))
			r.classList.remove('d-none');
		else r.classList.add('d-none');
	}
};

const setNewMonth = (e) => {
	const state = sh.getState();
	switch (e.target) {
		case yearBack:
			state.year = state.year - 1;
			break;
		case yearForward:
			state.year = state.year + 1;
			break;
		case monthBack:
			state.month = months[(state.month.number + 11) % 12];
			break;
		case monthForward:
			state.month = months[(state.month.number + 1) % 12];
			break;
		default:
			return;
	}
	sh.setState(state);
};

const handleTime = (e) => {
	if (e.detail.time !== 'none') e.target.classList.remove('d-none');
	else e.target.classList.add('d-none');

	if (e.detail.time === 'continuous') {
		timeList.classList.add('d-none');
		timeRange.classList.remove('d-none');
	} else if (e.detail.time === 'list') {
		timeList.classList.remove('d-none');
		timeRange.classList.add('d-none');
	}

	const h1 = Math.floor(e.detail.times[0] / 60);
	const m1 = (e.detail.times[0] % 60) / 15;

	const h2 = Math.floor(e.detail.times[1] / 60);
	const m2 = (e.detail.times[1] % 60) / 15;

	e.target.querySelector('#event-hour-early').selectedIndex = h1 % 12;
	e.target.querySelector('#event-minute-early').selectedIndex = m1;
	e.target.querySelector('#event-am-pm-early').selectedIndex = h1 > 12 ? 1 : 0;

	e.target.querySelector('#event-hour-late').selectedIndex = h2 % 12;
	e.target.querySelector('#event-minute-late').selectedIndex = m2;
	e.target.querySelector('#event-am-pm-late').selectedIndex = h2 > 12 ? 1 : 0;
};

const handleAddTime = (e) => {
	const hr = timeList.querySelector('#event-hour').value;
	const min = timeList.querySelector('#event-minute').value;
	const ampm = timeList.querySelector('#event-am-pm').value;

	const state = sh.getState();

	const t = Number(hr) * 60 + Number(min) + (ampm === 'pm' ? 720 : 0);

	if (state.timeList.includes(t))
		return showMessage(
			'error',
			`${hr}:${min === '0' ? '00' : min} ${ampm} has already been added`
		);
	else {
		state.timeList.push(t);
		sh.setState(state);
	}
};

document.addEventListener('DOMContentLoaded', () => {
	document.body.addEventListener(
		'touchstart',
		() => {
			isMobile = true;
		},
		{ once: true }
	);

	//guess the user's time zone
	const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const ops = getElementArray(tzSelect, 'option');
	ops.some((op) => {
		if (op.value.toUpperCase() === userTZ.toUpperCase()) {
			op.selected = true;
			return true;
		}
	});

	//populate the calendar
	const date = new Date();
	const month = months[date.getMonth()];
	const year = date.getFullYear();
	const day = date.getDate();

	const startingState = {
		dates: 'date',
		time: 'continuous',
		day,
		month,
		year,
		selectedDates: [],
		selectedWeekdays: [],
		times: [540, 1020],
		timeList: [],
		timeZone: tzSelect.value,
	};

	sh = new StateHandler({ ...startingState });
	sh.addWatcher(em, setMonthLabel);
	sh.addWatcher(null, renderCalendar);
	sh.addWatcher(timeArea, handleTime);
	sh.addWatcher(monthControl, (e) => {
		if (e.detail.dates === 'date') e.target.classList.remove('d-none');
		else e.target.classList.add('d-none');
	});
	sh.addWatcher(null, (state) => {
		const rows = getElementArray(document, '.calendar-row[data-row]');
		if (state.dates === 'date') {
			rows.forEach((r) => {
				r.classList.remove('d-none');
			});
			renderCalendar(state);
		} else {
			rows.forEach((r) => {
				if (r.getAttribute('data-row') === '0') {
					getElementArray(r, '.calendar-day').forEach((d, i) => {
						d.innerHTML = '';
						if (state.selectedWeekdays.includes(i)) d.classList.add('selected');
						else d.classList.remove('selected');
					});
				} else r.classList.add('d-none');
			});
		}
	});
	const removeCandidateTime = (e) => {
		const removedTime = e.target.closest('.time-tile');
		if (!removedTime) return;
		const t = Number(removedTime.getAttribute('data-time'));
		if (isNaN(t)) return;

		sh.setState((prev) => {
			return {
				...prev,
				timeList: prev.timeList.filter((ct) => {
					return ct !== t;
				}),
			};
		});
	};
	sh.addWatcher(timeList, (e) => {
		const tl = e.detail.timeList;

		if (tl.length === 0) {
			candidateTimes.innerHTML = '(None)';
			return;
		}
		candidateTimes.innerHTML = '';

		tl.sort((a, b) => {
			return a - b;
		}).forEach((t) => {
			const newTile = createElement('.time-tile');
			newTile.setAttribute('data-time', t);
			const sp = createElement('span');
			sp.innerHTML = `${((Math.floor(t / 60) + 23) % 12) + 1}:${
				t % 60 < 10 ? `0${t % 60}` : t % 60
			} ${t >= 720 ? 'PM' : 'AM'}`;
			newTile.appendChild(sp);
			const b = createElement('button.btn-close');
			b.setAttribute('type', 'button');
			newTile.appendChild(b);
			b.addEventListener('click', removeCandidateTime);
			candidateTimes.appendChild(newTile);
		});
	});

	[(yearBack, yearForward, monthBack, monthForward)].forEach((b) => {
		b.addEventListener('click', setNewMonth);
	});

	//hide month controls and simplify calendar if days of week selected
	eventTypeDate.forEach((cb) => {
		cb.addEventListener('change', (e) => {
			sh.setState((prev) => {
				return {
					...prev,
					dates: e.target.value,
				};
			});
		});
	});

	//hide the time settings if dates only selected
	eventTypeTime.forEach((cb) => {
		cb.addEventListener('change', (e) => {
			sh.setState((prev) => {
				return {
					...prev,
					time: e.target.value,
				};
			});
		});
	});

	//add candidate time
	addTime.addEventListener('click', handleAddTime);

	//touch actions for calendar days
	touchState.addWatcher(null, (state) => {
		//check if any date has been selected - if not, there's nothing left to do.
		const date1 = state.cell1?.getAttribute('data-date');
		if (!date1) return;
		const s = sh.getState();
		//if the starting cell was already selected, we are toggling off, otherwise we are toggling on.

		const toggleOn =
			s.dates === 'date'
				? !s.selectedDates.includes(date1)
				: !s.selectedWeekdays.includes(
						Number(state.cell1?.getAttribute('data-cell-no'))
				  );

		const ind1 = Number(state.cell1.getAttribute('data-cell-no'));
		const ind2 = Number(state.cell2.getAttribute('data-cell-no'));

		const startIndex = Math.min(ind1, ind2);
		const endIndex = Math.max(ind1, ind2);

		//if there is a touch active...
		if (state.touchActive) {
			calendarDays.forEach((c, i) => {
				if (toggleOn) {
					//if we're toggling on, highlight the cells that we are toggling
					if (i < startIndex || i > endIndex) c.classList.remove('dragged-on');
					else c.classList.add('dragged-on');
				} else {
					if (i < startIndex || i > endIndex) c.classList.remove('dragged-off');
					else c.classList.add('dragged-off');
				}
			});
		}
		// if no touch active, we just let go. Set the main state appropriately
		else {
			//if we were toggling on...
			if (toggleOn) {
				if (s.dates === 'date') {
					//...push any new dates into the array
					for (var i = startIndex; i <= endIndex; i++) {
						const d = calendarDays[i].getAttribute('data-date');
						calendarDays[i].classList.remove('dragged-on');
						if (!s.selectedDates.includes(d)) s.selectedDates.push(d);
					}
				} else {
					for (var i = startIndex; i <= endIndex; i++) {
						calendarDays[i].classList.remove('dragged-on');
						if (!s.selectedWeekdays.includes(i)) s.selectedWeekdays.push(i);
					}
				}
				sh.setState(s);
			} else {
				//otherwise, take the dragged dates and remove them all from the selected dates array
				const deselectedDates = calendarDays
					.slice(startIndex, endIndex + 1)
					.map((c) => {
						c.classList.remove('dragged-off');
						return s.dates === 'date'
							? c.getAttribute('data-date')
							: Number(c.getAttribute('data-cell-no'));
					});
				if (s.dates === 'date') {
					s.selectedDates = s.selectedDates.filter((d) => {
						return !deselectedDates.includes(d);
					});
				} else {
					s.selectedWeekdays = s.selectedWeekdays.filter((d) => {
						return !deselectedDates.includes(d);
					});
				}
				sh.setState(s);
			}
			touchState.setState({
				touchActive: false,
				cell1: null,
				cell2: null,
			});
		}
	});
	calendarDays.forEach((c) => {
		c.addEventListener('touchstart', (e) => {
			touchState.setState({
				touchActive: true,
				cell1: e.target.closest('.calendar-day'),
				cell2: e.target.closest('.calendar-day'),
			});
		});
		c.addEventListener('touchmove', (e) => {
			const [x, y] = [e.changedTouches[0].pageX, e.changedTouches[0].pageY];

			calendarDays.some((c) => {
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
						};
					});
					return true;
				}
			});
		});
		c.addEventListener('touchend', (e) => {
			touchState.setState((prev) => {
				return { ...prev, touchActive: false };
			});
		});

		c.addEventListener('mousedown', (e) => {
			if (isMobile) return;
			touchState.setState({
				touchActive: true,
				cell1: e.target.closest('.calendar-day'),
				cell2: e.target.closest('.calendar-day'),
			});
		});
		c.addEventListener('mousemove', (e) => {
			if (isMobile) return;
			const s = touchState.getState();
			if (!s.touchActive) return;
			const [x, y] = [e.pageX, e.pageY];
			calendarDays.some((c) => {
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
						};
					});
					return true;
				}
			});
		});
		c.addEventListener('mouseup', (e) => {
			if (isMobile) return;
			touchState.setState((prev) => {
				return { ...prev, touchActive: false };
			});
		});
	});

	//reset dates
	resetForm.addEventListener('click', (e) => {
		const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
		const ops = getElementArray(tzSelect, 'option');
		ops.some((op) => {
			if (op.value.toUpperCase() === userTZ.toUpperCase()) {
				op.selected = true;
				return true;
			}
		});

		//populate the calendar
		const date = new Date();
		const month = months[date.getMonth()];
		const year = date.getFullYear();
		const day = date.getDate();

		const state = sh.getState();

		sh.setState({
			...state,
			selectedDates: [],
			selectedWeekdays: [],
			timeZone: tzSelect.value,
		});
	});

	//submit form
	const createRequestBody = () => {
		const name = eventName.value;
		const eventType = document.querySelector(
			'input[name="event-type"]:checked'
		)?.value;
	};
	submitButton.addEventListener('click', (e) => {});
});
