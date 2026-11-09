<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import Glider from './ph/Glider.svelte';

	let {
		passportId,
		name,
		username,
		animate = false,
		onfinish
	}: {
		passportId: number;
		name: string;
		username?: string | null;
		animate?: boolean;
		onfinish: () => void;
	} = $props();

	let card: HTMLDivElement;
	let faces: HTMLDivElement;
	let waiting = $state(untrack(() => animate));

	onMount(() => {
		const reduced = matchMedia('(prefers-reduced-motion: reduce)');
		let animations: Animation[] = [];
		let finished = false;
		const finish = () => {
			if (finished) return;
			finished = true;
			waiting = false;
			animations.forEach((animation) => animation.cancel());
			onfinish();
		};
		if (!animate || reduced.matches) {
			finish();
			return;
		}

		const rect = card.getBoundingClientRect();
		const above = -rect.bottom - 40;
		const duration = 2400;
		const glide = 'cubic-bezier(0.16, 1, 0.3, 1)';
		const lift = 'cubic-bezier(0.2, 0.75, 0.25, 1)';
		const gravity = 'cubic-bezier(0.55, 0, 0.9, 0.45)';
		const settle = 'cubic-bezier(0.2, 0.8, 0.3, 1)';
		// Dock the logo face first. The lift and flip begin only after arrival.
		const raised = Math.max(16 - rect.top, -52);
		// Reserve horizontal room for perspective and roll on narrow viewports.
		const center = rect.left + rect.width / 2;
		const room = 2 * Math.min(center, innerWidth - center) - 24;
		const liftScale = Math.min(1, room / (rect.width * 1.24));
		const pose = (y: number, scale = 1) => `translate3d(0, ${y}px, 0) scale(${scale})`;
		const turn = (x: number, y: number, z: number, depth: number) =>
			`translateZ(${depth}px) rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;
		animations = [
			card.animate(
				[
					{ transform: pose(above), offset: 0, easing: glide },
					{ transform: pose(0), offset: 0.29, easing: 'linear' },
					{ transform: pose(0), offset: 0.34, easing: lift },
					{ transform: pose(raised, liftScale), offset: 0.54, easing: 'ease-in-out' },
					{ transform: pose(raised + 6, liftScale), offset: 0.69, easing: gravity },
					{ transform: pose(6), offset: 0.85, easing: settle },
					{ transform: pose(-3), offset: 0.91, easing: settle },
					{ transform: pose(0), offset: 1 }
				],
				{ duration, fill: 'both' }
			),
			faces.animate(
				[
					{ transform: turn(0, 180, 0, 0), offset: 0 },
					{ transform: turn(0, 180, 0, 0), offset: 0.34, easing: lift },
					{
						transform: turn(24, 180, -7, 100),
						offset: 0.45,
						easing: 'cubic-bezier(0.65, 0, 0.35, 1)'
					},
					{
						transform: turn(30, 90, -10, 145),
						offset: 0.56,
						easing: 'cubic-bezier(0.2, 0.65, 0.35, 1)'
					},
					{ transform: turn(-12, 0, 3, 90), offset: 0.69, easing: gravity },
					{ transform: turn(3, 0, -0.5, 0), offset: 0.85, easing: settle },
					{ transform: turn(-1, 0, 0, 8), offset: 0.91, easing: settle },
					{ transform: turn(0, 0, 0, 0), offset: 1 }
				],
				{ duration, fill: 'both' }
			),
			...Array.from(faces.children).map((face) =>
				face.animate(
					[
						{ boxShadow: '0 16px 45px rgb(0 0 0 / 0.16)', offset: 0 },
						{ boxShadow: '0 16px 45px rgb(0 0 0 / 0.16)', offset: 0.34, easing: lift },
						{ boxShadow: '0 48px 70px rgb(0 0 0 / 0.28)', offset: 0.54 },
						{ boxShadow: '0 40px 60px rgb(0 0 0 / 0.24)', offset: 0.69, easing: gravity },
						{ boxShadow: '0 5px 12px rgb(0 0 0 / 0.24)', offset: 0.85, easing: settle },
						{ boxShadow: '0 16px 45px rgb(0 0 0 / 0.16)', offset: 1 }
					],
					{ duration, fill: 'both' }
				)
			)
		];
		waiting = false;
		void Promise.all(animations.map((animation) => animation.finished))
			.then(finish)
			.catch(finish);
		window.addEventListener('resize', finish, { once: true });
		reduced.addEventListener('change', finish, { once: true });
		return () => {
			finish();
			window.removeEventListener('resize', finish);
			reduced.removeEventListener('change', finish);
		};
	});
</script>

<div class="passport-stage" class:waiting bind:this={card}>
	<div class="passport-faces" bind:this={faces}>
		<div class="passport-face passport-front">
			<div
				class="passport-header flex items-center justify-between font-mono font-semibold tracking-wider uppercase"
			>
				<span class="passport-brand flex items-center"
					><Glider class="size-4" /> Purdue Hackers · Identity</span
				>
				<span class="shrink-0">Nº {String(passportId).padStart(4, '0')}</span>
			</div>
			<div class="passport-holder flex flex-col">
				<span class="passport-name ph-headline">{name}</span>
				<span class="passport-username font-mono"
					>{username ? `@${username}` : 'Your next chapter starts here'}</span
				>
			</div>
			<div class="passport-footer border-t border-ph-black/20 font-mono tracking-[0.2em] uppercase">
				Purdue Hackers Passport
			</div>
		</div>
		<div class="passport-face passport-back" aria-hidden="true">
			<Glider class="size-20" />
		</div>
	</div>
</div>

<style>
	.passport-stage {
		position: relative;
		z-index: 60;
		width: 100%;
		max-width: 440px;
		min-width: 0;
		margin-inline: auto;
		aspect-ratio: 85.6 / 53.98;
		container-type: inline-size;
		perspective: 1200px;
	}
	.waiting {
		visibility: hidden;
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
		border-radius: clamp(10px, 4cqw, 16px);
		padding: clamp(16px, 6cqw, 24px);
		backface-visibility: hidden;
		box-shadow: 0 16px 45px rgb(0 0 0 / 0.16);
	}
	.passport-front {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 3cqw;
		background: var(--ph-yellow);
		color: var(--ph-black);
	}
	.passport-header {
		gap: 2cqw;
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
		font-size: clamp(7px, 2.25cqw, 10px);
	}
	.passport-back {
		display: grid;
		place-items: center;
		background: var(--ph-black);
		color: var(--ph-yellow);
		transform: rotateY(180deg);
	}
	.passport-back :global(svg) {
		width: 20cqw;
		height: 20cqw;
	}
	@media (prefers-reduced-motion: reduce) {
		.waiting {
			visibility: visible;
		}
	}
</style>
