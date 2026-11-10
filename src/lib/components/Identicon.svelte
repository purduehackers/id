<script lang="ts">
	import { identicon, swatch, type Cell } from './pixel';

	type Props = {
		seed: string;
		accent?: string;
		cells?: Cell[][];
		class?: string;
	};

	let { seed, accent, cells: suppliedCells, class: className }: Props = $props();
	const cells = $derived(suppliedCells ?? identicon(seed));
	const tint = $derived(accent ?? swatch(seed).accent);
</script>

<svg
	viewBox="0 0 5 5"
	shape-rendering="crispEdges"
	aria-hidden="true"
	class={['block shrink-0', className]}
>
	{#each cells as row, y (y)}
		{#each row as cell, x (x)}
			{#if cell}
				<rect {x} {y} width="1" height="1" fill={cell === 2 ? tint : 'currentColor'} />
			{/if}
		{/each}
	{/each}
</svg>
