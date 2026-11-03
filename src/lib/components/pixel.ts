// Deterministic pixel identity helpers: same input, same art, on server and client.

export function hash(input: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

export function rng(seed: number) {
	let s = seed || 1;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A 5x5 grid mirrored left to right, like a tiny space invader. */
export function identicon(input: string): boolean[][] {
	const rand = rng(hash(input));
	return Array.from({ length: 5 }, () => {
		const left = [rand() > 0.5, rand() > 0.5, rand() > 0.45];
		return [left[0], left[1], left[2], left[1], left[0]];
	});
}

export const SWATCHES = [
	{ bg: 'bg-ph-yellow', fg: 'text-ph-black' },
	{ bg: 'bg-ph-pink', fg: 'text-ph-black' },
	{ bg: 'bg-ph-lime', fg: 'text-ph-black' },
	{ bg: 'bg-ph-teal', fg: 'text-ph-black' },
	{ bg: 'bg-ph-orange', fg: 'text-ph-black' },
	{ bg: 'bg-ph-periwinkle', fg: 'text-ph-black' }
] as const;

export const swatch = (input: string) => SWATCHES[hash(input) % SWATCHES.length];
