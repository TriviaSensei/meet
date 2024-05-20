import { createElement } from '../utils/createElementFromSelector.js';

export const generateNotes = (event) => {
	const noteArea = document.querySelector('#team-notes');
	if (!noteArea) return;

	event.users
		.sort((a, b) => {
			return a.name.toUpperCase().localeCompare(b.name.toUpperCase());
		})
		.forEach((u) => {
			let noteDiv = noteArea.querySelector(`.note[data-id="${u.id}"]`);
			if (!u.notes) {
				if (noteDiv) noteDiv.remove();
				return;
			}
			if (!noteDiv) {
				noteDiv = createElement('.note');
			}
			noteDiv.innerHTML = '';

			const header = createElement('.name');
			header.innerHTML = u.name;
			noteDiv.appendChild(header);
			const content = createElement('.note-content');
			content.innerHTML = u.notes;

			noteDiv.appendChild(content);
			noteArea.appendChild(noteDiv);
			noteDiv.setAttribute('data-id', u.id);
		});
};
