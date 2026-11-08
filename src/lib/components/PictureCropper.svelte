<script lang="ts">
	import Button from './ph/Button.svelte';
	import Icon from './ph/Icon.svelte';

	type Props = {
		file: File | null;
		onsave: (picture: File) => void;
		oncancel: () => void;
		onerror: () => void;
	};

	let { file, onsave, oncancel, onerror }: Props = $props();

	const OUTPUT_SIZE = 512;
	const MAX_ZOOM = 4;
	const KEY_STEP = 16;

	let dialog = $state<HTMLDialogElement>();
	let image = $state<HTMLImageElement>();
	let src = $state('');
	let width = $state(0);
	let height = $state(0);
	let view = $state(0);
	let centerX = $state(0);
	let centerY = $state(0);
	let zoom = $state(1);
	let saving = $state(false);

	const scale = $derived(width && view ? (view / Math.min(width, height)) * zoom : 0);
	const half = $derived(Math.min(width, height) / (2 * zoom));

	$effect(() => {
		if (!file) return;
		const url = URL.createObjectURL(file);
		src = url;
		width = height = 0;
		zoom = 1;
		saving = false;
		dialog?.showModal();
		return () => {
			URL.revokeObjectURL(url);
			src = '';
		};
	});

	function loaded() {
		if (!image) return;
		width = image.naturalWidth;
		height = image.naturalHeight;
		centerX = width / 2;
		centerY = height / 2;
	}

	function failed() {
		dialog?.close();
		onerror();
	}

	const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

	function place(x: number, y: number, nextZoom = zoom) {
		zoom = clamp(nextZoom, 1, MAX_ZOOM);
		const h = Math.min(width, height) / (2 * zoom);
		centerX = clamp(x, h, width - h);
		centerY = clamp(y, h, height - h);
	}

	function pan(dx: number, dy: number) {
		place(centerX - dx / scale, centerY - dy / scale);
	}

	function zoomAt(nextZoom: number, px = view / 2, py = view / 2) {
		const ix = centerX + (px - view / 2) / scale;
		const iy = centerY + (py - view / 2) / scale;
		const next = clamp(nextZoom, 1, MAX_ZOOM);
		const nextScale = (view / Math.min(width, height)) * next;
		place(ix - (px - view / 2) / nextScale, iy - (py - view / 2) / nextScale, next);
	}

	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const pointers = new Map<number, { x: number; y: number }>();
	let pinch = 0;

	function local(event: PointerEvent | WheelEvent) {
		const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
		return { x: event.clientX - box.left, y: event.clientY - box.top };
	}

	function spread() {
		const [a, b] = [...pointers.values()];
		return Math.hypot(a.x - b.x, a.y - b.y);
	}

	function pointerDown(event: PointerEvent) {
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		pointers.set(event.pointerId, local(event));
		if (pointers.size === 2) pinch = spread();
	}

	function pointerMove(event: PointerEvent) {
		const last = pointers.get(event.pointerId);
		if (!last) return;
		const point = local(event);
		pointers.set(event.pointerId, point);
		if (pointers.size === 1) {
			pan(point.x - last.x, point.y - last.y);
		} else if (pointers.size === 2) {
			const [a, b] = [...pointers.values()];
			const distance = spread();
			if (pinch) zoomAt(zoom * (distance / pinch), (a.x + b.x) / 2, (a.y + b.y) / 2);
			pinch = distance;
		}
	}

	function pointerUp(event: PointerEvent) {
		pointers.delete(event.pointerId);
		pinch = pointers.size === 2 ? spread() : 0;
	}

	function wheel(event: WheelEvent) {
		event.preventDefault();
		const point = local(event);
		zoomAt(zoom * Math.exp(-event.deltaY * 0.002), point.x, point.y);
	}

	function key(event: KeyboardEvent) {
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [KEY_STEP, 0],
			ArrowRight: [-KEY_STEP, 0],
			ArrowUp: [0, KEY_STEP],
			ArrowDown: [0, -KEY_STEP]
		};
		const move = moves[event.key];
		if (move) {
			event.preventDefault();
			pan(...move);
		} else if (event.key === '+' || event.key === '=') {
			zoomAt(zoom * 1.1);
		} else if (event.key === '-') {
			zoomAt(zoom / 1.1);
		}
	}

	async function save() {
		if (!image || !width) return;
		saving = true;
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = OUTPUT_SIZE;
		const context = canvas.getContext('2d');
		if (!context) return failed();
		context.imageSmoothingQuality = 'high';
		context.drawImage(
			image,
			centerX - half,
			centerY - half,
			half * 2,
			half * 2,
			0,
			0,
			OUTPUT_SIZE,
			OUTPUT_SIZE
		);
		const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/webp', 0.9));
		if (!blob) return failed();
		dialog?.close();
		onsave(new File([blob], 'picture.webp', { type: blob.type }));
	}

	function cancel() {
		dialog?.close();
		oncancel();
	}
</script>

<dialog
	bind:this={dialog}
	oncancel={(event) => {
		event.preventDefault();
		cancel();
	}}
	aria-labelledby="picture-cropper-title"
	class="m-auto w-[min(26rem,calc(100vw-2rem))] bg-background p-6 text-foreground backdrop:bg-black/60"
>
	<div class="flex flex-col gap-5">
		<h2 id="picture-cropper-title" class="ph-headline text-2xl">Crop picture</h2>

		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<div
			bind:clientWidth={view}
			role="img"
			tabindex="0"
			aria-label="Picture crop. Drag or use the arrow keys to move it, scroll or use + and - to zoom."
			class="relative aspect-square w-full cursor-grab touch-none overflow-hidden bg-foreground/[0.08] outline-offset-2 select-none focus-visible:outline-2 active:cursor-grabbing"
			onpointerdown={pointerDown}
			onpointermove={pointerMove}
			onpointerup={pointerUp}
			onpointercancel={pointerUp}
			onwheel={wheel}
			onkeydown={key}
		>
			{#if src}
				<img
					bind:this={image}
					{src}
					alt=""
					draggable="false"
					onload={loaded}
					onerror={failed}
					class={['absolute top-0 left-0 max-w-none origin-top-left', !scale && 'invisible']}
					style:width="{width}px"
					style:height="{height}px"
					style:transform="translate({view / 2 - centerX * scale}px, {view / 2 - centerY * scale}px)
					scale({scale})"
				/>
			{/if}
		</div>

		<label class="flex items-center gap-3">
			<span class="sr-only">Zoom</span>
			<Icon name="minus" class="size-3.5 shrink-0" />
			<input
				type="range"
				min="1"
				max={MAX_ZOOM}
				step="0.01"
				value={zoom}
				oninput={(event) => zoomAt(Number(event.currentTarget.value))}
				disabled={!scale}
				class="w-full accent-foreground"
			/>
			<Icon name="plus" class="size-3.5 shrink-0" />
		</label>

		<div class="flex justify-end gap-2">
			<Button variant="ghost" size="sm" onclick={cancel}>Cancel</Button>
			<Button size="sm" icon="check" onclick={save} disabled={!scale || saving}>Save</Button>
		</div>
	</div>
</dialog>
