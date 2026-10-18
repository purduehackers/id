<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = { title: string; description?: Snippet; children?: Snippet; class?: string };

	let { title, description, children, class: className }: Props = $props();
</script>

<section class={['flex flex-col gap-4', className]}>
	<div class="flex flex-col gap-1.5">
		<h2 class="ph-headline text-3xl sm:text-4xl">{title}</h2>
		{#if description}<div class="text-[15px] leading-[1.5]">{@render description()}</div>{/if}
	</div>
	{@render children?.()}
</section>
