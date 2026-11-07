<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/ph/Icon.svelte';

	const PIXEL = 3;
	const SHADES_PER_HUE = 6;
	const SLOW_STEP = 90;
	const FAST_STEP = 35;
	const HUES = ['orange', 'pink', 'purple', 'periwinkle', 'blue', 'teal', 'lime'];
	const WHITE = [255, 255, 255];
	const BLACK = [0, 0, 0];

	let link = $state<HTMLAnchorElement>();
	let canvas = $state<HTMLCanvasElement>();

	const mix = (from: number[], to: number[], amount: number) =>
		from.map((value, i) => value + (to[i] - value) * amount);

	function buildPalette(styles: CSSStyleDeclaration, shadow: number): string[] {
		const hues = HUES.map((name) => {
			const hex = styles.getPropertyValue(`--ph-${name}`).trim();
			return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
		});
		return Array.from({ length: hues.length * SHADES_PER_HUE }, (_, band) => {
			const position = band / SHADES_PER_HUE;
			const hue = Math.floor(position);
			const blend = position - hue;
			const color = mix(hues[hue], hues[(hue + 1) % hues.length], blend);
			const shade = Math.sin(blend * Math.PI * 2) * 0.28;
			const shaded = mix(mix(color, shade > 0 ? WHITE : BLACK, Math.abs(shade)), BLACK, shadow);
			return `rgb(${shaded.map(Math.round).join(' ')})`;
		});
	}

	function ringCells(cols: number, rows: number, inset: number): [number, number][] {
		const right = cols - inset - 1;
		const bottom = rows - inset - 1;
		const cells: [number, number][] = [];
		for (let x = inset; x < right; x++) cells.push([x, inset]);
		for (let y = inset; y < bottom; y++) cells.push([right, y]);
		for (let x = right; x > inset; x--) cells.push([x, bottom]);
		for (let y = bottom; y > inset; y--) cells.push([inset, y]);
		return cells;
	}

	onMount(() => {
		const button = link;
		const target = canvas;
		const context = target?.getContext('2d');
		if (!button || !target || !context) return;

		const styles = getComputedStyle(target);
		const palettes = [buildPalette(styles, 0), buildPalette(styles, 0.35)];
		const bands = palettes[0].length;
		let rings: [number, number][][] = [];
		let step = 0;

		const draw = () => {
			const cols = Math.round(button.offsetWidth / PIXEL);
			const rows = Math.round(button.offsetHeight / PIXEL);
			if (target.width !== cols || target.height !== rows) {
				target.width = cols;
				target.height = rows;
				rings = [ringCells(cols, rows, 0), ringCells(cols, rows, 1)];
			}
			rings.forEach((cells, ring) => {
				cells.forEach(([x, y], index) => {
					const dither = (x + y) % 2 ? 0.5 : 0;
					const band = Math.floor((index / cells.length) * bands + dither);
					context.fillStyle = palettes[ring][(band - (step % bands) + bands) % bands];
					context.fillRect(x, y, 1, 1);
				});
			});
		};

		draw();
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		let last = 0;
		let frame = 0;
		const tick = (now: number) => {
			const wait = button.matches(':hover, :focus-visible') ? FAST_STEP : SLOW_STEP;
			if (now - last >= wait) {
				last = now;
				step++;
				draw();
			}
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});
</script>

<a
	bind:this={link}
	href="https://directory.purduehackers.com"
	target="_blank"
	rel="noopener noreferrer"
	class="visit relative inline-flex h-10 w-fit shrink-0 items-center justify-center gap-2 bg-ph-yellow px-4 font-mono text-[15px] font-semibold tracking-wide whitespace-nowrap text-ph-black uppercase no-underline transition-transform duration-150 ease-quint active:scale-[0.97]"
>
	<canvas bind:this={canvas} aria-hidden="true" class="absolute inset-0 size-full"></canvas>
	<span class="relative inline-flex items-center gap-2">
		Visit directory
		<Icon name="external-link" />
	</span>
</a>

<style>
	canvas {
		image-rendering: pixelated;
		pointer-events: none;
	}

	@media (prefers-reduced-motion: no-preference) {
		.visit:focus-visible :global(polygon:last-child) {
			animation: visit-directory-arrow 500ms steps(4);
		}
	}

	@media (hover: hover) and (prefers-reduced-motion: no-preference) {
		.visit:hover :global(polygon:last-child) {
			animation: visit-directory-arrow 500ms steps(4);
		}
	}

	@keyframes visit-directory-arrow {
		50% {
			transform: translate(14px, -14px);
		}
		50.01% {
			transform: translate(-14px, 14px);
		}
	}
</style>
