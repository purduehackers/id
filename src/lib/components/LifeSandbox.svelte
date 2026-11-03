<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import Button from './ph/Button.svelte';

	let { children }: { children?: Snippet } = $props();

	let canvas: HTMLCanvasElement;
	let playing = $state(false);
	let generation = $state(0);
	let population = $state(0);

	// 3x5 digit glyphs.
	const DIGITS: Record<string, string[]> = {
		'4': ['1.1', '1.1', '111', '..1', '..1'],
		'0': ['111', '1.1', '1.1', '1.1', '111']
	};

	let api: { toggle(): void; step(): void; scatter(): void; clear(): void } | undefined;

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		const TICK = 110;
		let size = 16;
		let cols = 0;
		let rows = 0;
		let dpr = 1;
		let grid = new Uint8Array(0);
		let next = new Uint8Array(0);
		let raf = 0;
		let last = 0;
		let painting: 0 | 1 | null = null;

		const ink = getComputedStyle(canvas).color;

		function count() {
			let n = 0;
			for (const v of grid) n += v;
			population = n;
		}

		function spell(text: string) {
			const scale = cols < 60 ? 2 : 3;
			const w = text.length * 3 * scale + (text.length - 1) * scale * 1.5;
			let x0 = Math.floor((cols - w) / 2);
			const y0 = Math.floor(rows * (cols < 60 ? 0.22 : 0.3));
			for (const ch of text) {
				DIGITS[ch].forEach((row, y) =>
					[...row].forEach((c, x) => {
						if (c !== '1') return;
						for (let dy = 0; dy < scale; dy++)
							for (let dx = 0; dx < scale; dx++)
								grid[(y0 + y * scale + dy) * cols + x0 + x * scale + dx] = 1;
					})
				);
				x0 += 3 * scale + Math.floor(scale * 1.5);
			}
		}

		function resize() {
			const { width, height } = canvas.getBoundingClientRect();
			if (!width || !height) return;
			dpr = window.devicePixelRatio || 1;
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			size = width < 640 ? 12 : 16;
			const old = { grid, cols, rows };
			cols = Math.ceil(width / size);
			rows = Math.ceil(height / size);
			grid = new Uint8Array(cols * rows);
			next = new Uint8Array(cols * rows);
			if (old.cols) {
				for (let y = 0; y < Math.min(rows, old.rows); y++)
					for (let x = 0; x < Math.min(cols, old.cols); x++)
						grid[y * cols + x] = old.grid[y * old.cols + x];
			} else {
				spell('404');
			}
			count();
			draw();
		}

		function draw() {
			const px = size * dpr;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
			for (let x = 0; x <= cols; x++)
				ctx.fillRect(Math.round(x * px), 0, Math.max(1, dpr), canvas.height);
			for (let y = 0; y <= rows; y++)
				ctx.fillRect(0, Math.round(y * px), canvas.width, Math.max(1, dpr));
			ctx.fillStyle = ink;
			for (let y = 0; y < rows; y++)
				for (let x = 0; x < cols; x++)
					if (grid[y * cols + x])
						ctx.fillRect(Math.round(x * px), Math.round(y * px), Math.ceil(px), Math.ceil(px));
		}

		function step() {
			for (let y = 0; y < rows; y++) {
				const up = ((y - 1 + rows) % rows) * cols;
				const mid = y * cols;
				const down = ((y + 1) % rows) * cols;
				for (let x = 0; x < cols; x++) {
					const l = (x - 1 + cols) % cols;
					const r = (x + 1) % cols;
					const n =
						grid[up + l] +
						grid[up + x] +
						grid[up + r] +
						grid[mid + l] +
						grid[mid + r] +
						grid[down + l] +
						grid[down + x] +
						grid[down + r];
					next[mid + x] = n === 3 || (n === 2 && grid[mid + x]) ? 1 : 0;
				}
			}
			[grid, next] = [next, grid];
			generation++;
			count();
			draw();
		}

		function frame(t: number) {
			if (t - last >= TICK) {
				step();
				last = t;
			}
			raf = requestAnimationFrame(frame);
		}

		function cellAt(event: PointerEvent) {
			const r = canvas.getBoundingClientRect();
			const x = Math.floor((event.clientX - r.left) / size);
			const y = Math.floor((event.clientY - r.top) / size);
			return x >= 0 && y >= 0 && x < cols && y < rows ? y * cols + x : -1;
		}

		function down(event: PointerEvent) {
			const i = cellAt(event);
			if (i < 0) return;
			canvas.setPointerCapture(event.pointerId);
			painting = grid[i] ? 0 : 1;
			grid[i] = painting;
			count();
			draw();
		}

		function move(event: PointerEvent) {
			if (painting === null) return;
			const i = cellAt(event);
			if (i < 0 || grid[i] === painting) return;
			grid[i] = painting;
			count();
			draw();
		}

		const up = () => (painting = null);

		api = {
			toggle() {
				playing = !playing;
				cancelAnimationFrame(raf);
				if (playing) raf = requestAnimationFrame(frame);
			},
			step() {
				if (playing) api!.toggle();
				step();
			},
			scatter() {
				for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < 0.22 ? 1 : 0;
				generation = 0;
				count();
				draw();
			},
			clear() {
				if (playing) api!.toggle();
				grid.fill(0);
				generation = 0;
				count();
				draw();
			}
		};

		function key(event: KeyboardEvent) {
			const target = event.target as HTMLElement;
			if (event.code !== 'Space' || target.closest('button, a, input, textarea, select')) return;
			event.preventDefault();
			api!.toggle();
		}

		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		canvas.addEventListener('pointerdown', down);
		canvas.addEventListener('pointermove', move);
		canvas.addEventListener('pointerup', up);
		canvas.addEventListener('pointercancel', up);
		window.addEventListener('keydown', key);

		return () => {
			cancelAnimationFrame(raf);
			observer.disconnect();
			window.removeEventListener('keydown', key);
		};
	});
</script>

<div class="fixed inset-0 bg-ph-yellow">
	<canvas
		bind:this={canvas}
		aria-label="Game of Life board. Click or drag to draw cells."
		class="block size-full cursor-crosshair touch-none text-ph-black"
	></canvas>
</div>

<div
	class="fixed inset-x-0 bottom-0 flex enter flex-col gap-5 bg-background p-6 text-foreground sm:inset-x-auto sm:bottom-8 sm:left-8 sm:max-w-md sm:p-8"
>
	{@render children?.()}

	<div class="flex flex-col gap-3">
		<div class="flex flex-wrap items-center gap-1">
			<Button
				size="sm"
				icon={playing ? 'pause-solid' : 'play-solid'}
				onclick={() => api?.toggle()}
				class="mr-1"
			>
				{playing ? 'Pause' : 'Play'}
			</Button>
			<Button variant="ghost" size="sm" onclick={() => api?.step()}>Step</Button>
			<Button variant="ghost" size="sm" icon="sparkles" onclick={() => api?.scatter()}
				>Scatter</Button
			>
			<Button variant="ghost" size="sm" icon="trash" onclick={() => api?.clear()}>Clear</Button>
		</div>
		<p class="font-mono text-[12px] tracking-wide uppercase" aria-live="off">
			Gen {String(generation).padStart(4, '0')} · {population} alive · space to play
		</p>
	</div>
</div>
