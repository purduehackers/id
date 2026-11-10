<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import IdCard from './IdCard.svelte';
	import PassportCover from './PassportCover.svelte';
	import type { IdCardData } from '$lib/id-card';
	import Glider from './ph/Glider.svelte';

	let {
		passportId,
		profile = null,
		name,
		username,
		headerStripHeight,
		class: className,
		animate = false,
		onstart = () => {},
		onfinish = () => {}
	}: {
		passportId: number;
		profile?: IdCardData | null;
		name?: string;
		username?: string | null;
		animate?: boolean;
		headerStripHeight?: number;
		class?: string;
		onstart?: () => void;
		onfinish?: () => void;
	} = $props();

	const FONT_WAIT = 1000;
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
	let opened = $state(untrack(() => !animate));
	let waiting = $state(untrack(() => animate));

	onMount(() => {
		const reduced = matchMedia('(prefers-reduced-motion: reduce)');
		let animations: Animation[] = [];
		let finished = false;
		let disposed = false;
		let started = false;
		let reflectionFrame = 0;
		let headerMotion: Animation | undefined;
		let coverFrames: Keyframe[] = [];
		let layoutWidth = 0;
		let stripHeight = '';
		const finish = () => {
			if (finished) return;
			finished = true;
			cancelAnimationFrame(reflectionFrame);
			coverArt?.setPose(140, 0);
			opened = true;
			waiting = false;
			animations.forEach((animation) => animation.cancel());
			onfinish();
		};
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
		const projectedHeaderFrames = () =>
			coverFrames.map((frame) => ({
				...frame,
				transform: headerPose(Number(String(frame.transform).match(/rotateX\(([-.\d]+)/)?.[1] ?? 0))
			}));
		const resize = () => {
			const width = card.offsetWidth;
			const strip = getComputedStyle(card).getPropertyValue('--cover-strip-height');
			// Mobile browser chrome changes viewport height without changing the booklet.
			if (width === layoutWidth && strip === stripHeight) return;
			layoutWidth = width;
			stripHeight = strip;
			alignHeader();
			if (!finished) {
				// Updating an existing effect keeps its currentTime, easing and play state.
				(headerMotion?.effect as KeyframeEffect | null)?.setKeyframes(projectedHeaderFrames());
			}
		};
		const sizeObserver = new ResizeObserver(resize);
		const start = () => {
			if (disposed || finished) return;
			started = true;
			resize();
			sizeObserver.observe(card);
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
			const pageLift = 20;
			const pageFrames: Keyframe[] = [
				{ transform: 'rotateX(0deg)', offset: 0 },
				{
					transform: 'rotateX(0deg)',
					offset: opening(0.1),
					easing: 'cubic-bezier(0.3, 0, 0.3, 1)'
				},
				{
					transform: `rotateX(${pageLift}deg)`,
					offset: opening(0.7),
					easing: 'cubic-bezier(0.5, 0, 0.8, 0.7)'
				},
				{ transform: 'rotateX(0deg)', offset: opening(1) },
				{ transform: 'rotateX(0deg)', offset: 1 }
			];
			coverFrames = [
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

			const play = (element: Element, frames: Keyframe[]) =>
				element.animate(frames, { duration, fill: 'both' });
			const visibilityFrames = (before: number, after: number): Keyframe[] => [
				{ opacity: before, offset: 0 },
				{ opacity: before, offset: faceSwitch - 0.00001 },
				{ opacity: after, offset: faceSwitch },
				{ opacity: after, offset: 1 }
			];

			animations = [
				play(booklet, [
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
				]),
				play(paper, pageFrames),
				play(cover, coverFrames),
				(headerMotion = play(header, projectedHeaderFrames())),
				play(header, visibilityFrames(0, 1)),
				play(
					paperShadow,
					pageFrames.map((frame) => ({
						...frame,
						filter: frame.offset === opening(0.7) ? 'blur(7px)' : 'blur(4px)',
						boxShadow:
							frame.offset === opening(0.7)
								? '0 0 84px 18px var(--passport-glow)'
								: '0 0 72px 14px var(--passport-glow)'
					}))
				),
				// The glow follows the cover and widens as it lifts away from the page.
				play(
					coverShadow,
					coverFrames.map((frame) => {
						const angle = Number(String(frame.transform).match(/rotateX\(([-.\d]+)/)?.[1] ?? 0);
						const lift = Math.min(
							1,
							Math.max(0, Math.sin((angle * Math.PI) / 180)) / Math.sin((140 * Math.PI) / 180)
						);
						return {
							...frame,
							opacity: lift,
							boxShadow: `0 0 ${72 + 48 * lift}px ${14 + 16 * lift}px var(--passport-cover-glow)`
						};
					})
				),
				// Explicit face opacity also prevents Safari from compositing the foil
				// logo through the reverse face. Switch only at the edge-on pose.
				play(outside, visibilityFrames(1, 0)),
				play(inside, visibilityFrames(0, 1)),
				play(shade, [
					{ opacity: 0.5, offset: 0 },
					{ opacity: 0.5, offset: opening(0) },
					{ opacity: 0.32, offset: opening(0.33), easing: 'ease-out' },
					{ opacity: 0.04, offset: opening(0.7) },
					{ opacity: 0, offset: opening(1) },
					{ opacity: 0, offset: 1 }
				])
			];
			const reflectCover = () => {
				if (disposed || finished) return;
				// Sample the actual eased WAAPI pose; there is no separate shine timeline.
				const matrix = new DOMMatrix(getComputedStyle(cover).transform);
				const arrival = new DOMMatrix(getComputedStyle(booklet).transform);
				const pitch = (Math.atan2(matrix.m23, matrix.m22) * 180) / Math.PI;
				const roll = (Math.atan2(arrival.m12, arrival.m11) * 180) / Math.PI;
				coverArt.setPose(pitch, roll, arrival.m42 / card.offsetHeight);
				reflectionFrame = requestAnimationFrame(reflectCover);
			};
			reflectCover();
			waiting = false;
			onstart();
			void Promise.all(animations.map((animation) => animation.finished))
				.then(finish)
				.catch(finish);
			reduced.addEventListener('change', finish, { once: true });
		};
		void (async () => {
			try {
				const labels = [...header.querySelectorAll('span')];
				// Each primary font is supplied by the shared theme. A failed
				// fallback request must not release other pending font waits.
				// A slow font host must not hold the page; fitHeader reruns when it arrives.
				await Promise.race([
					Promise.allSettled(
						labels.map((label) => {
							const font = getComputedStyle(label);
							const primaryFamily = font.fontFamily.split(',')[0];
							return document.fonts.load(
								`${font.fontStyle} ${font.fontWeight} ${font.fontSize} ${primaryFamily}`,
								label.textContent ?? ''
							);
						})
					),
					new Promise((resolve) => setTimeout(resolve, FONT_WAIT))
				]);
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
			sizeObserver.disconnect();
			cancelAnimationFrame(reflectionFrame);
			if (started) animations.forEach((animation) => animation.cancel());
			window.removeEventListener('resize', resize);
			document.fonts.removeEventListener('loadingdone', fitHeader);
			reduced.removeEventListener('change', finish);
		};
	});
</script>

<div
	class="pointer-events-none fixed inset-x-0 top-0 z-[61] h-[env(safe-area-inset-top,0px)] bg-ph-black"
	aria-hidden="true"
></div>

<div
	class={['passport-shell @container relative z-[60] mx-auto w-full max-w-[440px]', className]}
	class:opened
	bind:this={booklet}
	style:--cover-strip-height={headerStripHeight === undefined
		? undefined
		: `${headerStripHeight}px`}
>
	<div
		class="passport-stage @container relative z-0 mx-auto aspect-[85.6/53.98] w-full max-w-[440px] min-w-0 motion-reduce:visible"
		class:invisible={waiting}
		bind:this={card}
	>
		<div
			class="ground-shadow shadow-paper pointer-events-none absolute inset-0 -z-1 bg-[var(--passport-plate)] blur-[4px]"
			bind:this={paperShadow}
			aria-hidden="true"
		></div>
		<div
			class="ground-shadow shadow-cover pointer-events-none absolute inset-0 -z-1 bg-[var(--passport-plate)] blur-[4px]"
			bind:this={coverShadow}
			aria-hidden="true"
		></div>
		<div class="passport-page-clip absolute inset-0 z-0 overflow-visible bg-transparent">
			<div class="passport-page absolute inset-0 z-0" bind:this={paper}>
				<div class="absolute inset-0 grid size-full min-w-0 grid-cols-[minmax(0,1fr)] transform-3d">
					{#if profile}
						<IdCard {...profile} embedded />
					{:else}
						<div
							class="col-start-1 row-start-1 flex size-full min-h-0 min-w-0 flex-col justify-between gap-[3cqw] overflow-hidden border border-[var(--border)] bg-ph-cream p-[clamp(16px,6cqw,24px)] [overflow-wrap:anywhere] text-ph-black backface-hidden"
						>
							<div
								class="flex items-center justify-between gap-[2cqw] border-b border-[var(--border)] pb-[2cqw] font-mono text-[clamp(7px,2.25cqw,10px)] font-semibold tracking-wider uppercase"
							>
								<span class="flex min-w-0 items-center gap-[1.8cqw]">Identity document</span>
								<span class="shrink-0">Nº {String(passportId).padStart(4, '0')}</span>
							</div>
							<div class="flex min-h-0 flex-col gap-[1.6cqw]">
								<span class="line-clamp-2 ph-headline text-[clamp(20px,8cqw,36px)] leading-[1.05]"
									>{displayName}</span
								>
								<span class="truncate font-mono text-[clamp(9px,2.7cqw,12px)]"
									>{displayUsername ? `@${displayUsername}` : 'Your next chapter starts here'}</span
								>
							</div>
							<div
								class="flex justify-between border-t border-[var(--border)] pt-[2cqw] font-mono text-[clamp(7px,2.25cqw,10px)] tracking-[0.2em] uppercase"
							>
								Purdue Hackers Passport <span
									class="tracking-[-0.1em] text-ph-purple"
									aria-hidden="true">|||| ||| || ||||</span
								>
							</div>
						</div>
					{/if}
				</div>
				<div
					class="page-shade pointer-events-none absolute inset-0 z-1 opacity-0"
					bind:this={shade}
					aria-hidden="true"
				></div>
			</div>
		</div>
		<div class="passport-cover absolute inset-0 z-2 transform-3d" bind:this={cover}>
			<div
				class="cover-outside absolute inset-0 overflow-hidden opacity-0"
				bind:this={outside}
				aria-hidden="true"
			>
				<PassportCover bind:this={coverArt} />
			</div>
			<div
				class="cover-inside absolute inset-0 opacity-100"
				bind:this={inside}
				aria-hidden="true"
			></div>
		</div>
	</div>
	<a
		class="cover-header cover-resting-header absolute top-0 right-[clamp(22px,8cqw,34px)] bottom-auto left-[clamp(14px,4cqw,20px)] flex h-[1em] items-center gap-[clamp(14px,4cqw,20px)] text-[clamp(22px,7.8cqw,35px)] leading-none text-ph-cream no-underline"
		bind:this={header}
		href={resolve('/')}
		tabindex={opened ? 0 : -1}
		aria-hidden={!opened}
		aria-label="Purdue Hackers ID home"
	>
		<Glider solid class="size-4" />
		<span class="block min-w-0 flex-1 ph-headline whitespace-nowrap">Purdue Hackers ID</span>
	</a>
</div>

<style>
	.passport-stage,
	.passport-page-clip {
		perspective: 2400px;
		perspective-origin: center top;
	}

	.ground-shadow,
	.passport-page,
	.passport-cover {
		transform-origin: center top;
	}

	.passport-shell {
		/* Black shadows vanish on the dark page, so depth comes from a glow. */
		--passport-glow: rgb(252 210 2 / 0.36);
		--passport-cover-glow: rgb(252 210 2 / 0.22);
		--passport-plate: rgb(252 210 2 / 0.08);
		/* Keeps the same compositing context at rest as during the arrival animation. */
		transform: translateZ(0);
	}
	.shadow-paper {
		box-shadow: 0 0 72px 14px var(--passport-glow);
	}
	.shadow-cover {
		transform: rotateX(140deg);
		box-shadow: 0 0 120px 30px var(--passport-cover-glow);
	}
	.passport-page-clip {
		clip-path: inset(0 -64px -64px);
	}
	.page-shade {
		background: linear-gradient(
			180deg,
			var(--ph-black) 0%,
			rgb(0 0 0 / 0.35) 45%,
			transparent 100%
		);
	}
	.passport-cover {
		transform: rotateX(140deg);
	}
	.cover-outside,
	.cover-inside {
		background: var(--card);
		color: var(--ph-cream);
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}
	.cover-outside {
		transform: translateZ(0.5px);
	}
	.cover-inside {
		transform: rotateX(180deg) translateZ(0.5px);
		/* No light border at the hinge: it reads as a gap against the yellow page.
		   This face is flipped, so its bottom edge is the hinge. */
		box-shadow:
			inset 1px 0 0 var(--border),
			inset -1px 0 0 var(--border),
			inset 0 1px 0 var(--border);
	}
	.cover-header {
		transform: translateY(50%);
	}
	.cover-header > span {
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
</style>
