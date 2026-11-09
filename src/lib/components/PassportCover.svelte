<script lang="ts">
	/** Exact Figma vector artwork, with a reflection clipped to its gold foil. */
	let {
		title = 'PASSPORT',
		country = 'REPUBLIC OF HACKERLAND'
	}: { title?: string; country?: string } = $props();
</script>

<div class="passport-cover-art">
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
		background: #ffc000;
		-webkit-mask: url('/passport-seal.svg') center / contain no-repeat;
		mask: url('/passport-seal.svg') center / contain no-repeat;
		overflow: hidden;
	}
	.seal::after {
		content: '';
		position: absolute;
		inset: -50%;
		background: linear-gradient(
			115deg,
			transparent 28%,
			rgb(116 65 8 / 0.25) 40%,
			rgb(255 243 192 / 0.85) 49%,
			rgb(255 255 235 / 0.95) 51%,
			rgb(255 228 143 / 0.55) 55%,
			transparent 68%
		);
		animation: foil-reflection 7s ease-in-out infinite alternate;
		pointer-events: none;
	}
	@keyframes foil-reflection {
		from {
			transform: translateX(-35%) rotate(-8deg);
		}
		to {
			transform: translateX(35%) rotate(8deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.seal::after {
			animation: none;
		}
	}
</style>
