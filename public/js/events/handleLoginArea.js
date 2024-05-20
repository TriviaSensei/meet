import { createElement } from '../utils/createElementFromSelector.js';
import { getElementArray } from '../utils/getElementArray.js';
import { handleRequest } from '../utils/requestHandler.js';
import { showMessage } from '../utils/messages.js';

export const createHandleSaveNotes = (userState, eventState) => {
	return (e) => {
		const note = document.querySelector('#notes');
		if (!note) return;
		const user = userState.getState();
		const event = eventState.getState();

		if (!event.url || !user.name) return;

		if (user.notes.trim() === note.value.trim()) return;

		const str = `/api/v1/events/updateNotes/${event.url}`;
		const body = {
			notes: note.value,
		};
		const handler = (res) => {
			if (res.status !== 'success') {
				showMessage('error', 'Something went wrong. Please try again later.');
				note.value = user.notes;
			} else {
				userState.setState({
					...user,
					notes: note.value,
				});
				showMessage('info', 'Note saved');

				const newState = userState.getState();
				if (user.id !== 0) return;
				const noteArea = document.querySelector('#team-notes');
				if (!noteArea) return;
				res.event.users.forEach((u) => {
					let noteDiv = noteArea.querySelector(`.note[data-id="${u.id}"]`);
					if (!noteDiv) {
						if (!u.notes) return;
						noteDiv = createElement('.note');
						const header = createElement('.name');
						header.innerHTML = u.name;
						noteDiv.appendChild(header);
						const content = createElement('.note-content');
						content.innerHTML = u.notes;

						noteDiv.appendChild(content);
						noteArea.appendChild(noteDiv);
						noteDiv.setAttribute('data-id', u.id);
					} else {
						if (!u.notes) {
							noteDiv.remove();
							return;
						}
						const content = noteDiv.querySelector('.note-content');
						content.innerHTML = u.notes;
						const header = noteDiv.querySelector('.name');
						header.innerHTML = u.name;
					}
				});
			}
		};
		handleRequest(str, 'PATCH', body, handler);
	};
};

export const createHandleLoginArea = (userState, eventState) => {
	return (state) => {
		if (!state.name) return;
		const loginContainer = document.querySelector('#login-container');

		loginContainer.innerHTML = '';
		const cont = createElement('.d-flex.flex-row.w-100.my-1');
		const sp1 = createElement('.bold.me-2.my-auto');
		const sp2 = createElement('.my-auto');
		const sp3 = createElement('.f-1.ms-5.d-flex');
		const sp4 = createElement('.bold.me-2.my-auto');
		const notes = createElement('input#notes.f-1');
		const btn = createElement('button.ms-2.btn.btn-sm.btn-primary');
		btn.innerHTML = 'Save';
		notes.setAttribute('type', 'text');
		notes.setAttribute(
			'placeholder',
			`Notes (only viewable by you${state.id === 0 ? '' : ' and host'})`
		);
		notes.setAttribute('value', state.notes);
		notes.setAttribute('data-value', state.notes);
		const saveFunction = createHandleSaveNotes(userState, eventState);
		notes.addEventListener('blur', saveFunction);
		btn.addEventListener('click', saveFunction);
		sp1.innerHTML = 'Logged in as:';
		sp2.innerHTML = state.name;
		sp4.innerHTML = 'Notes:';
		sp3.appendChild(sp4);
		sp3.appendChild(notes);
		loginContainer.appendChild(cont);
		cont.appendChild(sp1);
		cont.appendChild(sp2);
		cont.appendChild(sp3);
		cont.appendChild(btn);

		const tzSelect = document.querySelector('#timezone');
		if (tzSelect) {
			getElementArray(tzSelect, 'option').some((o, i) => {
				if (o.value === state.timeZone) {
					tzSelect.selectedIndex = i;
					return true;
				}
			});
		}
	};
};
