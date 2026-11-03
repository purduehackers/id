<!--
	Conway's Game of Life, seeded with the glider from the logo. Every glider shares one
	phase and heading, so the flock drifts forever without colliding. New gliders join
	the flock in step: on click, and whenever a `ph:glider` event fires on window
	(the auth forms fire one per keystroke). Static under reduced motion.
-->
<script lang="ts">
	import { onMount } from 'svelte';

	let { class: className, cell = 18 }: { class?: string; cell?: number } = $props();

	let canvas: HTMLCanvasElement;

	const GLIDER: [number, number][] = [
		[1, 0],
		[1, 1],
		[2, 1],
		[2, 2],
		[0, 2]
	];
	// Lattice pitch. Seeds jitter up to 3 cells inside it and still keep a 3-cell gap.
	const SPACING = 9;
	const TICK = 140;

	/** The glider's four phases and its drift per period, found by simulating it once. */
	function phases() {
		const n = 12;
		let g = new Uint8Array(n * n);
		const ox = 4;
		const oy = 4;
		for (const [x, y] of GLIDER) g[(oy + y) * n + ox + x] = 1;
		const out: [number, number][][] = [];
		for (let k = 0; k <= 4; k++) {
			const cells: [number, number][] = [];
			for (let i = 0; i < g.length; i++)
				if (g[i]) cells.push([(i % n) - ox, Math.floor(i / n) - oy]);
			out.push(cells);
			const next = new Uint8Array(n * n);
			for (let y = 1; y < n - 1; y++)
				for (let x = 1; x < n - 1; x++) {
					let c = 0;
					for (let dy = -1; dy <= 1; dy++)
						for (let dx = -1; dx <= 1; dx++) if (dx || dy) c += g[(y + dy) * n + x + dx];
					next[y * n + x] = c === 3 || (c === 2 && g[y * n + x]) ? 1 : 0;
				}
			g = next;
		}
		const min = (cells: [number, number][]) => [
			Math.min(...cells.map((c) => c[0])),
			Math.min(...cells.map((c) => c[1]))
		];
		const [ax, ay] = min(out[0]);
		const [bx, by] = min(out[4]);
		return { shapes: out.slice(0, 4), drift: [bx - ax, by - ay] as const };
	}

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const { shapes, drift } = phases();
		let cols = 0;
		let rows = 0;
		let grid = new Uint8Array(0);
		let next = new Uint8Array(0);
		let gen = 0;
		let raf = 0;
		let last = 0;
		let dpr = 1;
		let color = '#000';
		// Smaller cells on narrow screens keep enough lattice slots for a lively field.
		let size = cell;
		let visibleCols = 0;
		let visibleRows = 0;

		const wrap = (v: number, m: number) => ((v % m) + m) % m;
		const at = (x: number, y: number) => wrap(y, rows) * cols + wrap(x, cols);

		/** Where a glider seeded at (x, y) on generation 0 sits now. */
		const now = (x: number, y: number) => {
			const p = Math.floor(gen / 4);
			return { x: x + p * drift[0], y: y + p * drift[1], shape: shapes[gen % 4] };
		};

		function place(x: number, y: number) {
			const pos = now(x, y);
			for (const [dx, dy] of pos.shape) grid[at(pos.x + dx, pos.y + dy)] = 1;
		}

		function empty(x: number, y: number) {
			const pos = now(x, y);
			for (let dy = -2; dy <= 6; dy++)
				for (let dx = -2; dx <= 6; dx++) if (grid[at(pos.x + dx, pos.y + dy)]) return false;
			return true;
		}

		/** Join the flock: pick a free lattice slot so nothing ever collides. */
		function spawn(prefer?: { x: number; y: number }) {
			const slots: [number, number][] = [];
			for (let y = 0; y < rows; y += SPACING)
				for (let x = 0; x < cols; x += SPACING) if (empty(x, y)) slots.push([x, y]);
			if (!slots.length) return;
			// Random spawns land where you can see them; the lattice runs past the edges.
			const visible = slots.filter(([x, y]) => {
				const pos = now(x, y);
				const vx = wrap(pos.x, cols);
				const vy = wrap(pos.y, rows);
				return vx < visibleCols - 3 && vy < visibleRows - 3;
			});
			const pool = visible.length ? visible : slots;
			let pick = pool[Math.floor(Math.random() * pool.length)];
			if (prefer) {
				// Slot nearest the pointer, in today's coordinates.
				const p = Math.floor(gen / 4);
				const d = ([x, y]: [number, number]) => {
					const dx = wrap(x + p * drift[0] - prefer.x + cols / 2, cols) - cols / 2;
					const dy = wrap(y + p * drift[1] - prefer.y + rows / 2, rows) - rows / 2;
					return dx * dx + dy * dy;
				};
				pick = slots.reduce((a, b) => (d(b) < d(a) ? b : a));
			}
			place(pick[0], pick[1]);
			draw();
		}

		function seed() {
			const { width, height } = canvas.getBoundingClientRect();
			if (!width || !height) return;
			dpr = window.devicePixelRatio || 1;
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			color = getComputedStyle(canvas).color;
			// Whole lattice tiles across the wrap seam, so neighbours there stay spaced too.
			size = width < 640 ? Math.round(cell * 0.6) : cell;
			visibleCols = Math.floor(width / size);
			visibleRows = Math.floor(height / size);
			cols = Math.ceil(width / size / SPACING) * SPACING;
			rows = Math.ceil(height / size / SPACING) * SPACING;
			grid = new Uint8Array(cols * rows);
			next = new Uint8Array(cols * rows);
			gen = 0;
			let s = 7;
			const rand = () => {
				s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
				return s / 2 ** 32;
			};
			for (let y = 0; y < rows; y += SPACING)
				for (let x = 0; x < cols; x += SPACING)
					if (rand() < 0.4) place(x + Math.floor(rand() * 4), y + Math.floor(rand() * 4));
			draw();
		}

		function step() {
			for (let y = 0; y < rows; y++) {
				const up = wrap(y - 1, rows) * cols;
				const mid = y * cols;
				const down = wrap(y + 1, rows) * cols;
				for (let x = 0; x < cols; x++) {
					const l = wrap(x - 1, cols);
					const r = wrap(x + 1, cols);
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
			gen++;
		}

		function draw() {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = color;
			const px = size * dpr;
			for (let y = 0; y < rows; y++)
				for (let x = 0; x < cols; x++)
					if (grid[y * cols + x])
						ctx.fillRect(Math.round(x * px), Math.round(y * px), Math.ceil(px), Math.ceil(px));
		}

		function frame(t: number) {
			if (t - last >= TICK) {
				step();
				draw();
				last = t;
			}
			raf = requestAnimationFrame(frame);
		}

		function onPointer(event: PointerEvent) {
			const r = canvas.getBoundingClientRect();
			spawn({
				x: Math.floor((event.clientX - r.left) / size),
				y: Math.floor((event.clientY - r.top) / size)
			});
		}
		const onGlider = () => spawn();

		const observer = new ResizeObserver(seed);
		observer.observe(canvas);
		canvas.addEventListener('pointerdown', onPointer);
		window.addEventListener('ph:glider', onGlider);
		if (!reduce) raf = requestAnimationFrame(frame);

		return () => {
			cancelAnimationFrame(raf);
			observer.disconnect();
			canvas.removeEventListener('pointerdown', onPointer);
			window.removeEventListener('ph:glider', onGlider);
		};
	});
</script>

<canvas bind:this={canvas} aria-hidden="true" class={['block', className]}></canvas>
