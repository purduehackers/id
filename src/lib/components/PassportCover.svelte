<script lang="ts">
	/** Exact Figma vector artwork, with a reflection clipped to its gold foil. */
	let artwork: HTMLDivElement;
	let pitch = 0;
	let roll = 0;
	let slide = 0;
	function reflect() {
		if (!artwork) return;
		// A fixed virtual light reflected by the moving cover. Coordinates are
		// counter-rotated because the Figma seal itself is rotated clockwise.
		artwork.style.setProperty('--foil-x', `${44 + pitch * 0.85 + slide * 48}%`);
		artwork.style.setProperty('--foil-y', `${38 - roll * 0.8 - slide * 12}%`);
		artwork.style.setProperty('--foil-angle', `${115 + roll * 0.6}deg`);
	}
	export function setPose(nextPitch: number, nextRoll: number, nextSlide = 0) {
		pitch = nextPitch;
		roll = nextRoll;
		slide = nextSlide;
		reflect();
	}
</script>

<div class="passport-cover-art" bind:this={artwork}>
	<div class="seal"></div>
</div>

<style>
	.passport-cover-art {
		position: relative;
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--card);
		box-shadow:
			inset 1px 0 0 var(--border),
			inset -1px 0 0 var(--border),
			inset 0 -1px 0 var(--border),
			inset 10px 0 18px rgb(0 0 0 / 0.25);
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
