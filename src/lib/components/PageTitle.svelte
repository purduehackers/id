<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title: string; children?: Snippet } = $props();
</script>

<div class="flex enter flex-col gap-3">
	<h1 class="ph-headline text-5xl sm:text-6xl">{title}</h1>
	{#if children}<div class="text-[15px] leading-[1.5]">{@render children()}</div>{/if}
</div>
