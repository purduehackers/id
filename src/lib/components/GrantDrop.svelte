<script lang="ts">
	import Identicon from './Identicon.svelte';
	import { swatch } from './pixel';

	let { name, seed }: { name: string; seed: string } = $props();

	const color = $derived(swatch(seed));
	const date = new Date().toLocaleDateString();
	const flecks = Array.from({ length: 14 }, (_, i) => {
		const angle = (i / 14) * Math.PI * 2 + (i % 2) * 0.3;
		const reach = 120 + (i % 3) * 40;
		return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach, s: 6 + (i % 3) * 4 };
	});
</script>

<div class="stage relative grid place-items-center py-10">
	{#each flecks as f, i (i)}
		<span
			class={['fleck absolute', color.bg]}
			style="--x: {f.x}px; --y: {f.y}px; width: {f.s}px; height: {f.s}px"
		></span>
	{/each}
	<div class={['card relative flex w-full max-w-80 flex-col gap-4 p-6', color.bg, color.fg]}>
		<div class="flex items-start justify-between gap-3">
			<Identicon {seed} class="size-10" />
			<span class="font-mono text-[12px] font-semibold uppercase">Granted {date}</span>
		</div>
		<span class="ph-headline text-4xl break-words">{name}</span>
		<span class="ph-subheadline text-[11px]">Purdue Hackers ID · Approved</span>
	</div>
</div>

<style>
	.card {
		rotate: -6deg;
		animation: slam 520ms cubic-bezier(0.2, 0, 0, 1) both;
	}

	.stage {
		animation: jolt 220ms 300ms linear both;
	}

	.fleck {
		opacity: 0;
		animation: fly 520ms 300ms cubic-bezier(0.1, 0.6, 0.2, 1) both;
	}

	@keyframes slam {
		0% {
			scale: 2.6;
			rotate: -18deg;
			opacity: 0;
		}
		55% {
			scale: 0.94;
			rotate: -5deg;
			opacity: 1;
		}
		75% {
			scale: 1.03;
		}
		100% {
			scale: 1;
			rotate: -6deg;
			opacity: 1;
		}
	}

	@keyframes jolt {
		0%,
		100% {
			translate: 0 0;
		}
		25% {
			translate: 3px 4px;
		}
		50% {
			translate: -3px -2px;
		}
		75% {
			translate: 2px -1px;
		}
	}

	@keyframes fly {
		0% {
			opacity: 1;
			translate: 0 0;
		}
		100% {
			opacity: 0;
			translate: var(--x) var(--y);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.card,
		.stage,
		.fleck {
			animation: none;
		}
	}
</style>
