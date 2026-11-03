<script lang="ts">
	import { onMount } from 'svelte';

	let { class: className }: { class?: string } = $props();

	// Logo glider, generations 0 to 3.
	const PHASES = [
		[
			[1, 0],
			[1, 1],
			[2, 1],
			[0, 2],
			[2, 2]
		],
		[
			[1, 0],
			[2, 0],
			[0, 1],
			[2, 1],
			[2, 2]
		],
		[
			[1, 0],
			[2, 0],
			[2, 1],
			[3, 1],
			[1, 2]
		],
		[
			[1, 0],
			[2, 0],
			[3, 0],
			[3, 1],
			[2, 2]
		]
	];

	let phase = $state(0);
	let flying = $state(false);

	onMount(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		flying = true;
		const timer = setInterval(() => (phase = (phase + 1) % 4), 70);
		const stop = setTimeout(() => {
			clearInterval(timer);
			flying = false;
		}, 1200);
		return () => {
			clearInterval(timer);
			clearTimeout(stop);
		};
	});
</script>

{#if flying}
	<svg
		viewBox="0 0 4 3"
		shape-rendering="crispEdges"
		aria-hidden="true"
		class={['launch pointer-events-none absolute h-3 w-4 text-ph-lime', className]}
	>
		{#each PHASES[phase] as [x, y], i (i)}
			<rect {x} {y} width="1" height="1" fill="currentColor" />
		{/each}
	</svg>
{/if}

<style>
	.launch {
		animation: launch 1150ms cubic-bezier(0.5, 0, 0.9, 0.6) forwards;
	}

	@keyframes launch {
		0% {
			translate: 0 0;
			scale: 1;
			opacity: 1;
		}
		70% {
			opacity: 1;
		}
		100% {
			translate: 260px -220px;
			scale: 2.2;
			opacity: 0;
		}
	}
</style>
