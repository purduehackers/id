<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		description?: Snippet;
		actions?: Snippet;
		children?: Snippet;
		class?: string;
	};

	let { title, description, actions, children, class: className }: Props = $props();
</script>

<section class={['flex flex-col gap-6', className]}>
	<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
		<div class="flex max-w-prose flex-col gap-2">
			<h2 class="ph-headline text-4xl">{title}</h2>
			{#if description}<div class="leading-[1.5] text-pretty">{@render description()}</div>{/if}
		</div>
		{@render actions?.()}
	</div>
	{@render children?.()}
</section>
