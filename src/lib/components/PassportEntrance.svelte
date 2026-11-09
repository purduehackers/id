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
		const x = innerWidth / 2 - (rect.left + rect.width / 2);
		const y = innerHeight / 2 - (rect.top + rect.height / 2);
		const above = -rect.bottom - 40;
		const at = (dy: number) => `translate3d(${x}px, ${dy}px, 0)`;
		animations = [
			card.animate(
				[
					{ transform: at(above), offset: 0 },
					{ transform: at(above), offset: 0.08 },
					{ transform: at(y), offset: 0.36, easing: 'ease-in-out' },
					{ transform: at(y), offset: 0.72, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
					{ transform: 'translate3d(0, 0, 0)', offset: 1 }
				],
				{ duration: 2200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
			),
			faces.animate(
				[
					{ transform: 'rotateY(180deg)', offset: 0 },
					{ transform: 'rotateY(180deg)', offset: 0.38 },
					{ transform: 'rotateY(0deg)', offset: 0.7 },
					{ transform: 'rotateY(0deg)', offset: 1 }
				],
				{ duration: 2200, easing: 'ease-in-out', fill: 'both' }
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
				class="flex items-center justify-between gap-3 font-mono text-[10px] font-semibold tracking-wider uppercase"
			>
				<span class="flex items-center gap-2"
					><Glider class="size-4" /> Purdue Hackers · Identity</span
				>
				<span>Nº {String(passportId).padStart(4, '0')}</span>
			</div>
			<div class="flex flex-col gap-2">
				<span class="ph-headline text-3xl break-words sm:text-4xl">{name}</span>
				<span class="font-mono text-xs"
					>{username ? `@${username}` : 'Your next chapter starts here'}</span
				>
			</div>
			<div
				class="border-t border-ph-black/20 pt-2 font-mono text-[10px] tracking-[0.2em] uppercase"
			>
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
		perspective: 1200px;
	}
	.waiting {
		visibility: hidden;
	}
	.passport-faces {
		display: grid;
		transform-style: preserve-3d;
	}
	.passport-face {
		grid-area: 1 / 1;
		min-height: 220px;
		aspect-ratio: 1.586;
		border-radius: 16px;
		padding: 24px;
		backface-visibility: hidden;
		box-shadow: 0 16px 45px rgb(0 0 0 / 0.16);
	}
	.passport-front {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 20px;
		background: var(--ph-yellow);
		color: var(--ph-black);
	}
	.passport-back {
		display: grid;
		place-items: center;
		background: var(--ph-black);
		color: var(--ph-yellow);
		transform: rotateY(180deg);
	}
	@media (prefers-reduced-motion: reduce) {
		.waiting {
			visibility: visible;
		}
	}
</style>
