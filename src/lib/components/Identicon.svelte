<script lang="ts">
	import { identicon } from './pixel';

	let { seed, class: className }: { seed: string; class?: string } = $props();
	const cells = $derived(identicon(seed));
</script>

<svg
	viewBox="0 0 5 5"
	shape-rendering="crispEdges"
	aria-hidden="true"
	class={['block shrink-0', className]}
>
	{#each cells as row, y (y)}
		{#each row as on, x (x)}
			{#if on}<rect {x} {y} width="1" height="1" fill="currentColor" />{/if}
		{/each}
	{/each}
</svg>
