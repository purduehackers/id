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

/** 0 is empty, 1 is ink, 2 is accent. */
export type Cell = 0 | 1 | 2;

/** 5x5 grid, mirrored. Shape and accent use separate random streams. */
export function identicon(input: string): Cell[][] {
	const seed = hash(input);
	const shape = rng(seed);
	const tint = rng(seed ^ 0x5bd1e995);
	return Array.from({ length: 5 }, () => {
		const left = [shape() > 0.5, shape() > 0.5, shape() > 0.45];
		const cells = left.map((on) => (on ? (tint() < 0.2 ? 2 : 1) : 0)) as Cell[];
		return [cells[0], cells[1], cells[2], cells[1], cells[0]];
	});
}

export const SWATCHES = [
	{ bg: 'bg-ph-yellow', fg: 'text-ph-black', bgColor: '#fcd202', accent: '#7d3bff' },
	{ bg: 'bg-ph-pink', fg: 'text-ph-black', bgColor: '#efb9ff', accent: '#7d3bff' },
	{ bg: 'bg-ph-lime', fg: 'text-ph-black', bgColor: '#a5e209', accent: '#0084ff' },
	{ bg: 'bg-ph-teal', fg: 'text-ph-black', bgColor: '#01beb2', accent: '#fbf7ec' },
	{ bg: 'bg-ph-orange', fg: 'text-ph-black', bgColor: '#ff9300', accent: '#fbf7ec' },
	{ bg: 'bg-ph-periwinkle', fg: 'text-ph-black', bgColor: '#7688ff', accent: '#fcd202' }
] as const;

export type Swatch = (typeof SWATCHES)[number];

export const swatch = (input: string): Swatch => SWATCHES[hash(input) % SWATCHES.length];

/** SVG avatar for the `picture` URL and favicons. */
export function identiconSvg(input: string, size = 240): string {
	const { bgColor, accent } = swatch(input);
	const rects = identicon(input)
		.flatMap((row, y) =>
			row.map((cell, x) =>
				cell
					? `<rect x="${x + 1}" y="${y + 1}" width="1" height="1" fill="${cell === 2 ? accent : '#000'}"/>`
					: ''
			)
		)
		.join('');
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 7" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="7" height="7" fill="${bgColor}"/>${rects}</svg>`;
}
