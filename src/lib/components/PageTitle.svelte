<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title: string; children?: Snippet } = $props();
</script>

<div class="flex enter flex-col gap-4">
	<h1 class="ph-headline text-5xl text-balance break-words sm:text-6xl">{title}</h1>
	{#if children}<div class="text-[17px] leading-[1.5] text-pretty break-words">
			{@render children()}
		</div>{/if}
</div>
