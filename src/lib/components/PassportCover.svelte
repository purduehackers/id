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
				<stop stop-color="#ebc878" />
				<stop offset="0.58" stop-color="#d7a553" />
				<stop offset="1" stop-color="#b77933" />
			</linearGradient>
			<linearGradient id={`${uid}-side`} x1="0" y1="0" x2="1" y2="0.8">
				<stop stop-color="#a96c2b" />
				<stop offset="0.55" stop-color="#dfb366" />
				<stop offset="1" stop-color="#edcf8f" />
			</linearGradient>
			<path id={`${uid}-top`} d="M 123 190 A 222 222 0 0 1 477 190" />
			<path id={`${uid}-bottom`} d="M 517 261 A 224 224 0 1 1 83 261" />
		</defs>

		<g class="foil-type" fill={`url(#${uid}-foil)`} stroke="#f7dda5" stroke-width="0.35">
			<text font-size="42" letter-spacing="7.5" text-anchor="middle">
				<textPath href={`#${uid}-top`} startOffset="50%">{title}</textPath>
			</text>
			<text font-size="37" letter-spacing="7" text-anchor="middle">
				<textPath href={`#${uid}-bottom`} startOffset="50%">{country}</textPath>
			</text>
		</g>

		<!-- Hand-drawn isometric glider. Dark seams separate the gold foil faces. -->
		<g
			transform="translate(300 311) scale(0.72) translate(-305 -330)"
			stroke-linejoin="round"
			stroke-linecap="round"
		>
			<path
				d="M 300 190 L 350 218 L 410 252 L 414 378 L 365 406 L 358 343 L 309 373 L 310 437 L 253 470 L 198 440 L 196 379 L 251 340 L 250 218 Z"
				fill={`url(#${uid}-front)`}
				stroke="#e6c385"
				stroke-width="3"
			/>
			<path
				d="M 350 218 L 410 252 L 414 378 L 365 406 L 358 343 L 354 280 Z"
				fill={`url(#${uid}-side)`}
			/>
			<path d="M 196 379 L 253 411 L 253 470 L 198 440 Z" fill={`url(#${uid}-side)`} />
			<path d="M 253 411 L 309 373 L 310 437 L 253 470 Z" fill={`url(#${uid}-foil)`} />
			<path
				d="M 250 218 L 300 190 L 350 218 L 301 248 Z"
				fill="#efce83"
				stroke="#13202d"
				stroke-width="4"
			/>
			<path
				d="M 350 218 L 354 280 M 196 379 L 247 407 M 309 373 L 358 343 L 365 406"
				fill="none"
				stroke="#17212b"
				stroke-width="4"
			/>
			<path
				d="M 198 440 L 253 470 L 310 437 M 365 406 L 414 378"
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
		background: #081321;
		box-shadow:
			inset 10px 0 18px rgb(0 0 0 / 0.25),
			inset 0 1px 0 rgb(255 255 255 / 0.08);
	}
	.passport-cover-art::before {
		content: '';
		position: absolute;
		inset: 0;
		opacity: 0.46;
		pointer-events: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.68 .93' numOctaves='3' stitchTiles='stitch'/%3E%3CfeDiffuseLighting surfaceScale='1.6' diffuseConstant='.8' lighting-color='%23c5cfdd'%3E%3CfeDistantLight azimuth='225' elevation='48'/%3E%3C/feDiffuseLighting%3E%3C/filter%3E%3Cpath fill='%23fff' filter='url(%23grain)' d='M0 0h160v160H0z'/%3E%3C/svg%3E");
		mix-blend-mode: soft-light;
	}
	.seal {
		position: relative;
		display: block;
		width: auto;
		height: 96%;
		max-width: 94%;
		aspect-ratio: 1;
	}
	.foil-type {
		font-family: var(--ph-font-sans);
		font-weight: 800;
	}
</style>
