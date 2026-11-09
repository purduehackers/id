<script lang="ts">
	/** Vector cover artwork; palette is illustration ink, not application theme tokens. */
	let {
		title = 'PASSPORT',
		country = 'REPUBLIC OF HACKERLAND'
	}: { title?: string; country?: string } = $props();
	const uid = $props.id();
</script>

<div class="passport-cover-art">
	<svg class="seal" viewBox="0 0 600 600" role="img" aria-label={`${title} — ${country}`}>
		<defs>
			<linearGradient
				id={`${uid}-foil`}
				x1="0.15"
				y1="0"
				x2="0.8"
				y2="1"
				gradientUnits="objectBoundingBox"
			>
				<stop offset="0" stop-color="#f6dfaa" />
				<stop offset="0.35" stop-color="#dfb96a" />
				<stop offset="0.64" stop-color="#bd833c" />
				<stop offset="1" stop-color="#efd199" />
			</linearGradient>
			<linearGradient id={`${uid}-front`} x1="0" y1="0" x2="0.45" y2="1">
				<stop stop-color="#efd38e" />
				<stop offset="0.58" stop-color="#e4bd6c" />
				<stop offset="1" stop-color="#c28a42" />
			</linearGradient>
			<linearGradient id={`${uid}-side`} x1="0" y1="0" x2="1" y2="0.8">
				<stop stop-color="#a96c2b" />
				<stop offset="0.55" stop-color="#dfb366" />
				<stop offset="1" stop-color="#edcf8f" />
			</linearGradient>
			<path id={`${uid}-top`} d="M 123 190 A 222 222 0 0 1 477 190" />
			<path id={`${uid}-bottom`} d="M 517 261 A 224 224 0 1 1 83 261" />
		</defs>

		<g class="foil-type" fill="#e4bd6c">
			<text font-size="42" letter-spacing="7.5" text-anchor="middle">
				<textPath href={`#${uid}-top`} startOffset="50%">{title}</textPath>
			</text>
			<text font-size="37" letter-spacing="7" text-anchor="middle">
				<textPath href={`#${uid}-bottom`} startOffset="50%">{country}</textPath>
			</text>
		</g>

		<!-- Vector tracing of the reference geometry: cap, tapered seam,
		     recessed triangular notch, and the two lower extruded faces. -->
		<g
			transform="translate(300 311) scale(0.56) translate(-204.5 -235)"
			stroke-linejoin="round"
			stroke-linecap="round"
		>
			<path
				d="M 198 49 L 264 86 L 338 130 L 348 297 L 284 336 L 275 250 L 207 293 L 207 382 L 137 421 L 67 375 L 61 311 L 126 269 L 125 94 Z"
				fill={`url(#${uid}-front)`}
				stroke="#e7c786"
				stroke-width="2.5"
			/>
			<path
				d="M 264 86 L 338 130 L 348 297 L 284 336 L 275 250 L 268 202 Z"
				fill={`url(#${uid}-side)`}
			/>
			<path d="M 61 311 L 130 350 L 137 421 L 67 375 Z" fill={`url(#${uid}-side)`} />
			<path d="M 130 350 L 207 293 L 207 382 L 137 421 Z" fill={`url(#${uid}-foil)`} />
			<path
				d="M 207 293 L 275 250 L 284 336 Z"
				fill={`url(#${uid}-side)`}
				stroke="#151515"
				stroke-width="3.5"
			/>
			<path
				d="M 125 94 L 198 49 L 264 86 L 193 130 Z"
				fill="#efd183"
				stroke="#151515"
				stroke-width="4"
			/>
			<path d="M 260 88 L 267 84 L 269 204 L 266 185 Z" fill="#151515" />
			<path
				d="M 61 311 L 124 345 M 207 293 L 207 382"
				fill="none"
				stroke="#151515"
				stroke-width="3.5"
			/>
			<path
				d="M 67 375 L 137 421 L 207 382 M 284 336 L 348 297"
				fill="none"
				stroke="#f0d391"
				stroke-width="2"
			/>
		</g>
	</svg>
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
	.foil-type {
		font-family: var(--ph-font-sans);
		font-weight: 800;
	}
</style>
