<script lang="ts">
	import { onMount } from 'svelte';
	/** Exact Figma vector artwork, with a reflection clipped to its gold foil. */
	let {
		title = 'PASSPORT',
		country = 'REPUBLIC OF HACKERLAND'
	}: { title?: string; country?: string } = $props();
	let artwork: HTMLDivElement;
	let pitch = 0;
	let roll = 0;
	let viewX = 0;
	let viewY = 0;
	function reflect() {
		if (!artwork) return;
		// A fixed virtual light reflected by the moving cover. Coordinates are
		// counter-rotated because the Figma seal itself is rotated clockwise.
		artwork.style.setProperty('--foil-x', `${44 + pitch * 0.85 + viewY * 32}%`);
		artwork.style.setProperty('--foil-y', `${38 - roll * 0.8 - viewX * 32}%`);
		artwork.style.setProperty('--foil-angle', `${115 + roll * 0.6 + viewX * 18}deg`);
	}
	export function setPose(nextPitch: number, nextRoll: number) {
		pitch = nextPitch;
		roll = nextRoll;
		reflect();
	}
	onMount(() => {
		const pointer = (event: PointerEvent) => {
			const bounds = artwork.getBoundingClientRect();
			viewX = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
			viewY = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
			reflect();
		};
		const tilt = (event: DeviceOrientationEvent) => {
			// Browsers that already permit orientation events need no permission prompt.
			if (event.gamma === null || event.beta === null) return;
			viewX = Math.max(-1, Math.min(1, event.gamma / 35));
			viewY = Math.max(-1, Math.min(1, (event.beta - 45) / 35));
			reflect();
		};
		window.addEventListener('pointermove', pointer, { passive: true });
		window.addEventListener('deviceorientation', tilt);
		reflect();
		return () => {
			window.removeEventListener('pointermove', pointer);
			window.removeEventListener('deviceorientation', tilt);
		};
	});
</script>

<div class="passport-cover-art" bind:this={artwork}>
	<div class="seal" role="img" aria-label={`${title} — ${country}`}></div>
</div>

<style>
	.passport-cover-art {
		position: relative;
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--ph-black);
		box-shadow:
			inset 10px 0 18px rgb(0 0 0 / 0.25),
			inset 0 1px 0 rgb(255 255 255 / 0.08);
	}
	.passport-cover-art::before {
		content: '';
		position: absolute;
		inset: 0;
		opacity: 0.16;
		pointer-events: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.68 .93' numOctaves='3' stitchTiles='stitch'/%3E%3CfeDiffuseLighting surfaceScale='1.6' diffuseConstant='.8' lighting-color='%23b8b8b8'%3E%3CfeDistantLight azimuth='225' elevation='48'/%3E%3C/feDiffuseLighting%3E%3C/filter%3E%3Cpath fill='%23fff' filter='url(%23grain)' d='M0 0h160v160H0z'/%3E%3C/svg%3E");
		mix-blend-mode: screen;
	}
	.seal {
		position: relative;
		display: block;
		width: auto;
		height: 96%;
		max-width: 94%;
		aspect-ratio: 1;
		transform: rotate(90deg);
		transform-origin: center;
	}
	.seal {
		/* The mask uses the exact outlined Figma lettering and emblem. */
		background:
			radial-gradient(
				ellipse 24% 65% at var(--foil-x, 44%) var(--foil-y, 38%),
				#ffffed 0%,
				#fff1b5 13%,
				#ffe083 30%,
				transparent 70%
			),
			linear-gradient(
				var(--foil-angle, 115deg),
				#80500c 0%,
				#d49a24 23%,
				#ffc000 43%,
				#efbe56 61%,
				#9b6010 80%,
				#e4b34c 100%
			);
		-webkit-mask: url('/passport-seal.svg') center / contain no-repeat;
		mask: url('/passport-seal.svg') center / contain no-repeat;
		overflow: hidden;
	}
</style>
