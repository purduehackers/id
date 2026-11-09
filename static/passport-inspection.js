// Capture Space before the application hydrates, including across a reload.
(() => {
	const storageKey = 'ph-passport-space-held';
	let held = false;
	try {
		held = sessionStorage.getItem(storageKey) === '1';
		// A reload consumes the hint; a subsequent key repeat can renew it.
		sessionStorage.removeItem(storageKey);
	} catch {}
	window.__phPassportSpaceHeld = held;
	const update = (value) => {
		window.__phPassportSpaceHeld = value;
		try {
			if (value) sessionStorage.setItem(storageKey, '1');
			else sessionStorage.removeItem(storageKey);
		} catch {}
	};
	addEventListener('keydown', (event) => {
		if (event.code === 'Space') update(true);
	}, true);
	addEventListener('keyup', (event) => {
		if (event.code === 'Space') update(false);
	}, true);
	addEventListener('blur', () => update(false));
})();
