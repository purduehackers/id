<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import IdCard from './IdCard.svelte';
	import type { IdCardData } from '$lib/id-card';
	import Glider from './ph/Glider.svelte';

	let {
		passportId,
		profile = null,
		name,
		username,
		animate = false,
		onfinish
	}: {
		passportId: number;
		profile?: IdCardData | null;
		name: string;
		username?: string | null;
		animate?: boolean;
		onfinish: () => void;
	} = $props();

	let card: HTMLDivElement;
	let cover: HTMLDivElement;
	let sheen: HTMLDivElement;
	let shade: HTMLDivElement;
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
		const above = -card.getBoundingClientRect().bottom - 24;
		const duration = 2700;
		const easeOut = 'cubic-bezier(0.16, 1, 0.3, 1)';
		const settle = 'cubic-bezier(0.2, 0.8, 0.3, 1)';
		animations = [
			card.animate(
				[
					{
						transform: `translateY(${above}px) rotateZ(-2deg) scale(0.98)`,
						offset: 0,
						easing: easeOut
					},
					{ transform: 'translateY(4px) rotateZ(0.4deg) scale(1)', offset: 0.25, easing: settle },
					{ transform: 'translateY(0) rotateZ(0deg) scale(1)', offset: 0.31 },
					{ transform: 'translateY(0) rotateZ(0deg) scale(1)', offset: 1 }
				],
				{ duration, fill: 'both' }
			),
			cover.animate(
				[
					{ transform: 'rotateX(0deg)', offset: 0 },
					{ transform: 'rotateX(0deg)', offset: 0.35, easing: 'cubic-bezier(0.4, 0, 0.7, 1)' },
					{ transform: 'rotateX(-6deg)', offset: 0.42, easing: 'cubic-bezier(0.55, 0, 0.7, 0.45)' },
					{ transform: 'rotateX(60deg)', offset: 0.56, easing: 'cubic-bezier(0.16, 0.7, 0.25, 1)' },
					{ transform: 'rotateX(134deg)', offset: 0.76, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
					{ transform: 'rotateX(140deg)', offset: 0.86 },
					{ transform: 'rotateX(140deg)', offset: 1 }
				],
				{ duration, fill: 'both' }
			),
			sheen.animate(
				[
					{ transform: 'translateX(-130%)', opacity: 0, offset: 0 },
					{ transform: 'translateX(-90%)', opacity: 0.15, offset: 0.18, easing: 'ease-in-out' },
					{ transform: 'translateX(70%)', opacity: 0.55, offset: 0.48 },
					{ transform: 'translateX(130%)', opacity: 0, offset: 0.63 },
					{ transform: 'translateX(130%)', opacity: 0, offset: 1 }
				],
				{ duration, fill: 'both' }
			),
			shade.animate(
				[
					{ opacity: 0.5, offset: 0 },
					{ opacity: 0.5, offset: 0.42 },
					{ opacity: 0.32, offset: 0.56, easing: 'ease-out' },
					{ opacity: 0.04, offset: 0.72 },
					{ opacity: 0, offset: 0.84 },
					{ opacity: 0, offset: 1 }
				],
				{ duration, fill: 'both' }
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

<div class="cover-safe-area" aria-hidden="true"></div>

<div class="passport-stage" class:waiting bind:this={card}>
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
					<span class="passport-name ph-headline">{name}</span>
					<span class="passport-username font-mono"
						>{username ? `@${username}` : 'Your next chapter starts here'}</span
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
	<div class="passport-cover" bind:this={cover}>
		<div class="cover-outside" aria-hidden="true">
			<div class="cover-sheen" bind:this={sheen}></div>
			<Glider class="cover-logo" />
			<span class="cover-caption font-mono">PURDUE HACKERS<br />PASSPORT</span>
		</div>
		<div class="cover-inside">
			<a class="cover-header" href="/" aria-label="Purdue Hackers ID home">
				<Glider class="size-4" />
				<span class="ph-headline">Purdue Hackers ID</span>
			</a>
		</div>
	</div>
</div>

<style>
	.cover-safe-area {
		position: fixed;
		inset: 0 0 auto;
		height: env(safe-area-inset-top, 0px);
		background: #000;
		z-index: 61;
		pointer-events: none;
	}
	.passport-stage {
		position: relative;
		z-index: 60;
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
	.passport-faces {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		width: 100%;
		height: 100%;
		min-width: 0;
		transform-style: preserve-3d;
		box-shadow: 0 14px 35px rgb(0 0 0 / 0.14);
	}
	.passport-face {
		grid-area: 1 / 1;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		overflow-wrap: anywhere;
		border-radius: 0;
		padding: clamp(16px, 6cqw, 24px);
		backface-visibility: hidden;
		box-shadow: 0 16px 45px rgb(0 0 0 / 0.16);
	}
	.passport-front {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 3cqw;
		background: #fbf7ec;
		color: #000;
		border: 1px solid #000;
		border-top: 5px solid #000;
	}
	.passport-header {
		gap: 2cqw;
		border-bottom: 1px solid #000;
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
		border-top: 1px solid #000;
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
		background: linear-gradient(180deg, #000 0%, rgb(0 0 0 / 0.35) 45%, transparent 100%);
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
		background: #000;
		color: #fbf7ec;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}
	.cover-outside {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 5cqw;
		border: 1px solid #353535;
		overflow: hidden;
		background:
			repeating-linear-gradient(110deg, rgb(255 255 255 / 0.025) 0 1px, transparent 1px 4px),
			linear-gradient(145deg, #202020, #060606 65%);
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 0.16),
			0 12px 30px rgb(0 0 0 / 0.22);
	}
	.cover-outside::before {
		content: '';
		position: absolute;
		inset: 3cqw;
		border: 1px solid rgb(252 210 2 / 0.22);
		pointer-events: none;
	}
	.cover-sheen {
		position: absolute;
		inset: 0;
		opacity: 0;
		pointer-events: none;
		background: linear-gradient(
			110deg,
			transparent 25%,
			rgb(255 255 255 / 0.34) 48%,
			rgb(252 210 2 / 0.08) 56%,
			transparent 75%
		);
	}
	.cover-outside :global(.cover-logo) {
		width: 17cqw;
		height: 17cqw;
		color: #fcd202;
		filter: drop-shadow(0 1px 0 #625000) drop-shadow(0 -1px 0 #ffffa0);
	}
	.cover-caption {
		font-size: clamp(8px, 2.5cqw, 11px);
		line-height: 1.5;
		letter-spacing: 0.25em;
		text-align: center;
	}
	.cover-inside {
		transform: rotateX(180deg);
		border-bottom: 1px solid #555;
	}
	.cover-header {
		position: absolute;
		bottom: clamp(38px, 10cqw, 44px);
		inset-inline: clamp(16px, 6cqw, 24px);
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: clamp(20px, 6cqw, 28px);
		line-height: 1;
		text-decoration: none;
		color: #fbf7ec;
	}
	.cover-header :global(svg) {
		width: clamp(20px, 6cqw, 26px);
		height: clamp(20px, 6cqw, 26px);
	}
	.document-mark {
		color: #7d3bff;
		letter-spacing: -0.1em;
	}
	@media (prefers-reduced-motion: reduce) {
		.waiting {
			visibility: visible;
		}
	}
</style>
