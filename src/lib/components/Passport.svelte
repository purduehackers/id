<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import IdCard from './IdCard.svelte';
	import PassportCover from './PassportCover.svelte';
	import type { IdCardData } from '$lib/id-card';
	import Glider from './ph/Glider.svelte';

	let {
		passportId,
		profile = null,
		name,
		username,
		coverTitle = 'PASSPORT',
		coverCountry = 'REPUBLIC OF HACKERLAND',
		headerStripHeight,
		inspectOnSpace = true,
		class: className,
		animate = false,
		onfinish = () => {}
	}: {
		passportId: number;
		profile?: IdCardData | null;
		name?: string;
		username?: string | null;
		animate?: boolean;
		coverTitle?: string;
		coverCountry?: string;
		headerStripHeight?: number;
		inspectOnSpace?: boolean;
		class?: string;
		onfinish?: () => void;
	} = $props();

	const displayName = $derived(name ?? profile?.name ?? `Passport ${passportId}`);
	const displayUsername = $derived(username ?? profile?.username);

	let card: HTMLDivElement;
	let booklet: HTMLDivElement;
	let cover: HTMLDivElement;
	let paper: HTMLDivElement;
	let paperShadow: HTMLDivElement;
	let coverShadow: HTMLDivElement;
	let outside: HTMLDivElement;
	let inside: HTMLDivElement;
	let shade: HTMLDivElement;
	let header: HTMLAnchorElement;
	let coverArt: PassportCover;
	let inspecting = $state(false);
	let opened = $state(untrack(() => !animate));
	let waiting = $state(untrack(() => animate));

	onMount(() => {
		const reduced = matchMedia('(prefers-reduced-motion: reduce)');
		let animations: Animation[] = [];
		let finished = false;
		let disposed = false;
		let started = false;
		let reflectionFrame = 0;
		const finish = () => {
			if (finished) return;
			finished = true;
			cancelAnimationFrame(reflectionFrame);
			coverArt?.setPose(inspecting ? 0 : 140, 0);
			opened = !inspecting;
			waiting = false;
			animations.forEach((animation) => animation.cancel());
			onfinish();
		};
		const inspectCover = () => {
			if (!inspectOnSpace || disposed || inspecting) return;
			inspecting = true;
			window.scrollTo(0, 0);
			finish();
		};
		const handleSpace = (event: KeyboardEvent) => {
			if (event.code !== 'Space' || !inspectOnSpace || (finished && !inspecting)) return;
			const target = event.target;
			if (
				target instanceof Element &&
				target.closest('input, textarea, select, [contenteditable="true"]')
			)
				return;
			event.preventDefault();
			inspectCover();
		};
		window.addEventListener('keydown', handleSpace, true);
		if ((window as Window & { __phPassportSpaceHeld?: boolean }).__phPassportSpaceHeld)
			inspectCover();

		let headerDistance = 36;
		const headerPose = (coverAngle: number) => {
			// Flatten the cover's exact perspective onto one front-facing plane.
			// No back-face ancestor or end-of-animation replacement is involved.
			const width = card.offsetWidth;
			const left = header.offsetLeft;
			const labelWidth = header.offsetWidth;
			const height = header.offsetHeight;
			const projection = new DOMMatrix();
			projection.m34 = -1 / 2400;
			const matrix = new DOMMatrix()
				.translate(width / 2 - left, 0, 0)
				.multiply(projection)
				.rotateAxisAngle(1, 0, 0, coverAngle)
				.translate(left + labelWidth / 2 - width / 2, headerDistance, -0.5)
				.rotateAxisAngle(1, 0, 0, 180)
				.translate(-labelWidth / 2, -height / 2, 0);
			// Use a canonical homogeneous scale in both CSS and WAAPI.
			return `matrix3d(${Array.from(matrix.toFloat64Array())
				.map((value) => value / matrix.m44)
				.join(',')})`;
		};
		const fitHeader = () => {
			const text = header?.querySelector('span');
			if (text && text.clientWidth > 0 && text.scrollWidth > 0) {
				text.style.setProperty(
					'--cover-header-text-scale',
					String(Math.min(1, text.clientWidth / text.scrollWidth))
				);
			}
		};
		const alignHeader = () => {
			fitHeader();
			const stripHeight =
				parseFloat(getComputedStyle(card).getPropertyValue('--cover-strip-height')) || 56;
			const distance = stripHeight / 2;
			const angle = (40 * Math.PI) / 180;
			headerDistance = distance / (Math.cos(angle) + (distance * Math.sin(angle)) / 2400);
			header.style.transform = headerPose(140);
		};
		const resize = () => {
			finish();
			alignHeader();
		};
		const start = () => {
			if (disposed || finished) return;
			started = true;
			alignHeader();
			window.addEventListener('resize', resize);
			document.fonts.addEventListener('loadingdone', fitHeader);

			if (!animate || reduced.matches) {
				finish();
				return;
			}
			const above = -card.getBoundingClientRect().bottom - 24;
			const arrivalDuration = 600;
			const openingStart = arrivalDuration * 0.4;
			const openingDuration = 700;
			const duration = openingStart + openingDuration + 80;
			const opening = (progress: number) => (openingStart + progress * openingDuration) / duration;
			const faceSwitch = opening(0.45);
			const easeOut = 'cubic-bezier(0.16, 1, 0.3, 1)';
			const settle = 'cubic-bezier(0.2, 0.8, 0.3, 1)';
			const pageFrames: Keyframe[] = [
				{ transform: 'rotateX(0deg)', offset: 0 },
				{
					transform: 'rotateX(0deg)',
					offset: opening(0),
					easing: 'cubic-bezier(0.25, 0.5, 0.35, 1)'
				},
				{ transform: 'rotateX(6deg)', offset: opening(0.3), easing: easeOut },
				{
					transform: 'rotateX(20deg)',
					offset: opening(0.7),
					easing: 'cubic-bezier(0.5, 0, 0.75, 0.6)'
				},
				{ transform: 'rotateX(3deg)', offset: opening(0.94), easing: settle },
				{ transform: 'rotateX(0deg)', offset: opening(1) },
				{ transform: 'rotateX(0deg)', offset: 1 }
			];
			const coverFrames: Keyframe[] = [
				{ transform: 'rotateX(0deg)', offset: 0 },
				{
					transform: 'rotateX(0deg)',
					offset: opening(0),
					easing: 'cubic-bezier(0.55, 0, 0.7, 0.45)'
				},
				{
					transform: 'rotateX(60deg)',
					offset: opening(0.33),
					easing: 'cubic-bezier(0.3, 0.4, 0.6, 0.8)'
				},
				{
					transform: 'rotateX(90deg)',
					offset: faceSwitch,
					easing: 'cubic-bezier(0.16, 0.7, 0.25, 1)'
				},
				{ transform: 'rotateX(134deg)', offset: opening(0.78), easing: settle },
				{ transform: 'rotateX(140deg)', offset: opening(1) },
				{ transform: 'rotateX(140deg)', offset: 1 }
			];

			animations = [
				booklet.animate(
					[
						{
							transform: `translateY(${above}px) rotateZ(-2deg) scale(0.98)`,
							offset: 0,
							easing: easeOut
						},
						{
							transform: 'translateY(0) rotateZ(0deg) scale(1)',
							offset: arrivalDuration / duration
						},
						{ transform: 'translateY(0) rotateZ(0deg) scale(1)', offset: 1 }
					],
					{ duration, fill: 'both' }
				),
				paper.animate(pageFrames, { duration, fill: 'both' }),
				cover.animate(coverFrames, { duration, fill: 'both' }),
				header.animate(
					coverFrames.map((frame) => ({
						...frame,
						transform: headerPose(
							Number(String(frame.transform).match(/rotateX\(([-.\d]+)/)?.[1] ?? 0)
						)
					})),
					{ duration, fill: 'both' }
				),
				header.animate(
					[
						{ opacity: 0, offset: 0 },
						{ opacity: 0, offset: faceSwitch - 0.00001 },
						{ opacity: 1, offset: faceSwitch },
						{ opacity: 1, offset: 1 }
					],
					{ duration, fill: 'both' }
				),
				paperShadow.animate(
					pageFrames.map((frame) => ({
						...frame,
						transform: `translate3d(6px, 10px, -16px) ${frame.transform}`,
						filter: frame.offset === opening(0.7) ? 'blur(7px)' : 'blur(4px)',
						boxShadow:
							frame.offset === opening(0.7)
								? '0 16px 24px 4px rgb(0 0 0 / .3)'
								: '0 8px 16px 2px rgb(0 0 0 / .34)'
					})),
					{ duration, fill: 'both' }
				),
				coverShadow.animate(
					coverFrames.map((frame) => {
						const angle = Number(String(frame.transform).match(/rotateX\(([-.\d]+)/)?.[1] ?? 0);
						const elevation =
							Math.max(0, Math.sin((angle * Math.PI) / 180)) / Math.sin((140 * Math.PI) / 180);
						return {
							...frame,
							transform: `translate3d(${6 + 8 * elevation}px, ${8 + 12 * elevation}px, -24px) ${frame.transform}`,
							filter: `blur(${4 + 4 * elevation}px)`,
							boxShadow: `0 ${6 + 6 * elevation}px ${14 + 10 * elevation}px ${2 + 2 * elevation}px rgb(0 0 0 / .3)`
						};
					}),
					{ duration, fill: 'both' }
				),
				// Explicit face opacity also prevents Safari from compositing the foil
				// logo through the reverse face. Switch only at the edge-on pose.
				outside.animate(
					[
						{ opacity: 1, offset: 0 },
						{ opacity: 1, offset: faceSwitch - 0.00001 },
						{ opacity: 0, offset: faceSwitch },
						{ opacity: 0, offset: 1 }
					],
					{ duration, fill: 'both' }
				),
				inside.animate(
					[
						{ opacity: 0, offset: 0 },
						{ opacity: 0, offset: faceSwitch - 0.00001 },
						{ opacity: 1, offset: faceSwitch },
						{ opacity: 1, offset: 1 }
					],
					{ duration, fill: 'both' }
				),
				shade.animate(
					[
						{ opacity: 0.5, offset: 0 },
						{ opacity: 0.5, offset: opening(0) },
						{ opacity: 0.32, offset: opening(0.33), easing: 'ease-out' },
						{ opacity: 0.04, offset: opening(0.7) },
						{ opacity: 0, offset: opening(1) },
						{ opacity: 0, offset: 1 }
					],
					{ duration, fill: 'both' }
				)
			];
			const reflectCover = () => {
				if (disposed || finished) return;
				// Sample the actual eased WAAPI pose; there is no separate shine timeline.
				const matrix = new DOMMatrix(getComputedStyle(cover).transform);
				const arrival = new DOMMatrix(getComputedStyle(booklet).transform);
				const pitch = (Math.atan2(matrix.m23, matrix.m22) * 180) / Math.PI;
				const roll = (Math.atan2(arrival.m12, arrival.m11) * 180) / Math.PI;
				coverArt.setPose(pitch, roll);
				reflectionFrame = requestAnimationFrame(reflectCover);
			};
			reflectCover();
			waiting = false;
			void Promise.all(animations.map((animation) => animation.finished))
				.then(finish)
				.catch(finish);
			reduced.addEventListener('change', finish, { once: true });
		};
		void (async () => {
			try {
				const labels = [
					...header.querySelectorAll('span'),
					...card.querySelectorAll('.passport-cover-art text')
				];
				// Each primary font is supplied by the shared theme. A failed
				// fallback request must not release other pending font waits.
				await Promise.allSettled(
					labels.map((label) => {
						const font = getComputedStyle(label);
						const primaryFamily = font.fontFamily.split(',')[0];
						return document.fonts.load(
							`${font.fontStyle} ${font.fontWeight} ${font.fontSize} ${primaryFamily}`,
							label.textContent ?? ''
						);
					})
				);
			} catch {
				// A failed font request uses the browser's fallback rather than blocking entry.
			}
			await new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			);
			start();
		})();
		return () => {
			disposed = true;
			cancelAnimationFrame(reflectionFrame);
			if (started) animations.forEach((animation) => animation.cancel());
			window.removeEventListener('resize', resize);
			window.removeEventListener('keydown', handleSpace, true);
			document.fonts.removeEventListener('loadingdone', fitHeader);
			reduced.removeEventListener('change', finish);
		};
	});
</script>

<div class="cover-safe-area" aria-hidden="true"></div>

<div
	class={['passport-shell', className]}
	class:opened
	class:inspecting
	bind:this={booklet}
	style:--cover-strip-height={headerStripHeight === undefined
		? undefined
		: `${headerStripHeight}px`}
>
	<div class="passport-stage" class:waiting bind:this={card}>
		<div class="ground-shadow shadow-paper" bind:this={paperShadow} aria-hidden="true"></div>
		<div class="ground-shadow shadow-cover" bind:this={coverShadow} aria-hidden="true"></div>
		<div class="passport-page-clip">
			<div class="passport-page" bind:this={paper}>
				<div class="passport-faces">
					{#if profile}
						<IdCard {...profile} embedded />
					{:else}
						<div class="passport-face passport-front">
							<div
								class="passport-header flex items-center justify-between font-mono font-semibold tracking-wider uppercase"
							>
								<span class="passport-brand flex items-center">Identity document</span>
								<span class="shrink-0">Nº {String(passportId).padStart(4, '0')}</span>
							</div>
							<div class="passport-holder flex flex-col">
								<span class="passport-name ph-headline">{displayName}</span>
								<span class="passport-username font-mono"
									>{displayUsername ? `@${displayUsername}` : 'Your next chapter starts here'}</span
								>
							</div>
							<div class="passport-footer font-mono tracking-[0.2em] uppercase">
								Purdue Hackers Passport <span class="document-mark" aria-hidden="true"
									>|||| ||| || ||||</span
								>
							</div>
						</div>
					{/if}
				</div>
				<div class="page-shade" bind:this={shade} aria-hidden="true"></div>
			</div>
		</div>
		<div class="passport-cover" bind:this={cover}>
			<div class="cover-outside" bind:this={outside} aria-hidden="true">
				<PassportCover bind:this={coverArt} title={coverTitle} country={coverCountry} />
			</div>
			<div class="cover-inside" bind:this={inside} aria-hidden="true"></div>
		</div>
	</div>
	<a
		class="cover-header cover-resting-header"
		bind:this={header}
		href="/"
		tabindex={opened ? 0 : -1}
		aria-hidden={!opened}
		aria-label="Purdue Hackers ID home"
	>
		<Glider class="size-4" />
		<span class="ph-headline">Purdue Hackers ID</span>
	</a>
</div>

<style>
	.cover-safe-area {
		position: fixed;
		inset: 0 0 auto;
		height: env(safe-area-inset-top, 0px);
		background: var(--ph-black);
		z-index: 61;
		pointer-events: none;
	}
	.passport-shell {
		position: relative;
		z-index: 60;
		width: 100%;
		max-width: 440px;
		margin-inline: auto;
		container-type: inline-size;
	}
	.passport-stage {
		position: relative;
		z-index: 0;
		width: 100%;
		max-width: 440px;
		min-width: 0;
		margin-inline: auto;
		aspect-ratio: 85.6 / 53.98;
		container-type: inline-size;
		perspective: 2400px;
		perspective-origin: center top;
	}
	.waiting {
		visibility: hidden;
	}
	.ground-shadow {
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background: rgb(0 0 0 / 0.2);
		filter: blur(4px);
		transform-origin: center top;
	}
	.shadow-paper {
		transform: translate3d(6px, 10px, -16px);
		box-shadow: 0 8px 16px 2px rgb(0 0 0 / 0.34);
	}
	.shadow-cover {
		filter: blur(8px);
		transform: translate3d(14px, 20px, -24px) rotateX(140deg);
		box-shadow: 0 12px 24px 4px rgb(0 0 0 / 0.3);
	}
	.passport-page-clip {
		position: absolute;
		inset: 0;
		z-index: 0;
		overflow: visible;
		clip-path: inset(0 -64px -64px);
		perspective: 2400px;
		perspective-origin: center top;
		background: transparent;
	}
	.passport-page {
		transform-origin: center top;
		position: absolute;
		inset: 0;
		z-index: 0;
	}
	.passport-faces {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		width: 100%;
		height: 100%;
		min-width: 0;
		transform-style: preserve-3d;
	}
	.passport-face {
		grid-area: 1 / 1;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		overflow-wrap: anywhere;
		padding: clamp(16px, 6cqw, 24px);
		backface-visibility: hidden;
	}
	.passport-front {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 3cqw;
		background: var(--ph-cream);
		color: var(--ph-black);
		border: 1px solid var(--border);
		border-top: 1px solid var(--border);
	}
	.passport-header {
		gap: 2cqw;
		border-bottom: 1px solid var(--border);
		padding-bottom: 2cqw;
		font-size: clamp(7px, 2.25cqw, 10px);
	}
	.passport-brand {
		gap: 1.8cqw;
		min-width: 0;
	}
	.passport-brand :global(svg) {
		width: 4cqw;
		height: 4cqw;
	}
	.passport-holder {
		gap: 1.6cqw;
		min-height: 0;
	}
	.passport-name {
		font-size: clamp(20px, 8cqw, 36px);
		line-height: 1.05;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}
	.passport-username {
		font-size: clamp(9px, 2.7cqw, 12px);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.passport-footer {
		padding-top: 2cqw;
		border-top: 1px solid var(--border);
		display: flex;
		justify-content: space-between;
		font-size: clamp(7px, 2.25cqw, 10px);
	}
	.page-shade {
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		opacity: 0;
		background: linear-gradient(
			180deg,
			var(--ph-black) 0%,
			rgb(0 0 0 / 0.35) 45%,
			transparent 100%
		);
	}
	.passport-cover {
		position: absolute;
		inset: 0;
		z-index: 2;
		transform-style: preserve-3d;
		transform-origin: center top;
		transform: rotateX(140deg);
	}
	.cover-outside,
	.cover-inside {
		position: absolute;
		inset: 0;
		background: var(--ph-black);
		color: var(--ph-cream);
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}
	.cover-outside {
		opacity: 0;
		transform: translateZ(0.5px);
		overflow: hidden;
	}
	.cover-inside {
		transform: rotateX(180deg) translateZ(0.5px);
		opacity: 1;
		border-bottom: 1px solid var(--border);
	}
	.cover-header {
		position: absolute;
		top: 0;
		bottom: auto;
		height: 1em;
		transform: translateY(50%);
		left: clamp(14px, 4cqw, 20px);
		right: clamp(22px, 8cqw, 34px);
		display: flex;
		align-items: center;
		gap: clamp(14px, 4cqw, 20px);
		font-size: clamp(22px, 7.8cqw, 35px);
		line-height: 1;
		text-decoration: none;
		color: var(--ph-cream);
	}
	.cover-header > span {
		display: block;
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		transform: translateY(0.08em) scaleX(var(--cover-header-text-scale, 1));
		transform-origin: left center;
	}
	.cover-header :global(svg) {
		width: 1em;
		height: 1em;
	}
	/* One projected header plane keeps the cover's angle without a handoff. */
	.cover-resting-header {
		transform-origin: 0 0;
		transform: translateY(calc(-0.5 * var(--cover-strip-height, 56px) - 0.5em)) perspective(2400px)
			rotateX(-40deg);
		z-index: 3;
		opacity: 0;
	}
	.opened .cover-resting-header {
		opacity: 1;
	}
	.inspecting .passport-cover {
		transform: rotateX(0deg);
	}
	.inspecting .cover-outside {
		opacity: 1;
	}
	.inspecting .cover-inside,
	.inspecting .cover-header {
		opacity: 0;
		pointer-events: none;
	}
	.inspecting .shadow-cover {
		transform: translate3d(6px, 8px, -24px) rotateX(0deg);
		filter: blur(4px);
		box-shadow: 0 6px 14px 2px rgb(0 0 0 / 0.3);
	}
	.document-mark {
		color: var(--ph-purple);
		letter-spacing: -0.1em;
	}
	@media (prefers-reduced-motion: reduce) {
		.waiting {
			visibility: visible;
		}
	}
</style>
