import { showMessage } from './utils/messages.js';
import { StateHandler } from './utils/stateHandler.js';
import { handleRequest } from './utils/requestHandler.js';
import { createElement } from './utils/createElementFromSelector.js';
import { getElementArray } from './utils/getElementArray.js';

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
const timeRange = document.querySelector('#time-range');
let sh;

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
			`${lastMonth === 11 ? state.year - 1 : state.year}-${lastMonth}-${
				lastMonthDays + i - wd1 + 1
			}`,
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

const showHideTime = (e) => {
	if (e.detail.times) e.target.classList.remove('d-none');
	else e.target.classList.add('d-none');
};

document.addEventListener('DOMContentLoaded', () => {
	//populate the calendar
	const date = new Date();
	const month = months[date.getMonth()];
	const year = date.getFullYear();
	const day = date.getDate();

	const startingState = {
		dates: 'specific',
		times: true,
		day,
		month,
		year,
		dateList: [],
		times: [],
		timeZone: tzSelect.value,
	};

	sh = new StateHandler(startingState);
	sh.addWatcher(em, setMonthLabel);
	sh.addWatcher(null, renderCalendar);
	sh.addWatcher(timeRange, showHideTime);
	sh.addWatcher(monthControl, (e) => {
		if (e.detail.dates === 'specific') e.target.classList.remove('d-none');
		else e.target.classList.add('d-none');
	});
	sh.addWatcher(null, (state) => {
		const rows = getElementArray(document, '.calendar-row[data-row]');
		console.log(state.dates);
		if (state.dates === 'specific') {
			rows.forEach((r) => {
				r.classList.remove('d-none');
			});
			renderCalendar(state);
		} else {
			rows.forEach((r) => {
				if (r.getAttribute('data-row') === '0') {
					getElementArray(r, '.calendar-day').forEach((d) => {
						d.innerHTML = '';
					});
				} else r.classList.add('d-none');
			});
		}
	});

	[yearBack, yearForward, monthBack, monthForward].forEach((b) => {
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
					times: e.target.value === 'time',
				};
			});
		});
	});

	//guess the user's time zone
	const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const ops = getElementArray(tzSelect, 'option');
	ops.some((op) => {
		if (op.value.toUpperCase() === userTZ.toUpperCase()) {
			op.selected = true;
			return true;
		}
	});
});
