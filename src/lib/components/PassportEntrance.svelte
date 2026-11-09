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
		const duration = 2300;
		animations = [
			card.animate(
				[
					{
						transform: `translateY(${above}px)`,
						offset: 0,
						easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
					},
					{ transform: 'translateY(0)', offset: 0.3 },
					{ transform: 'translateY(0)', offset: 1 }
				],
				{ duration, fill: 'both' }
			),
			cover.animate(
				[
					{ transform: 'rotateX(0deg)', offset: 0 },
					{ transform: 'rotateX(0deg)', offset: 0.35, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' },
					{ transform: 'rotateX(126deg)', offset: 0.83, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
					{ transform: 'rotateX(142deg)', offset: 0.94, easing: 'ease-out' },
					{ transform: 'rotateX(140deg)', offset: 1 }
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
	<div class="passport-cover" bind:this={cover}>
		<div class="cover-outside" aria-hidden="true">
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
		border: 1px solid #303030;
	}
	.cover-outside :global(.cover-logo) {
		width: 17cqw;
		height: 17cqw;
		color: #fcd202;
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
		bottom: 14px;
		inset-inline: clamp(16px, 6cqw, 24px);
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: clamp(14px, 4.5cqw, 20px);
		line-height: 1;
		text-decoration: none;
		color: #fbf7ec;
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
