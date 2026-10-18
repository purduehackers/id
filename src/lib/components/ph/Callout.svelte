<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons';

	type Props = { title?: string; icon?: IconName; class?: string; children?: Snippet };

	let { title, icon = 'info-circle', class: className, children }: Props = $props();
</script>

<aside
	class={[
		'flex items-start gap-4 border-2 border-dashed border-ph-purple bg-ph-yellow/30 p-5 sm:p-6 dark:border-ph-yellow dark:bg-ph-purple/15',
		className
	]}
>
	<Icon name={icon} class="mt-0.5 size-6 text-ph-purple dark:text-ph-yellow" />
	<div class="flex min-w-0 flex-col gap-2">
		{#if title}<p class="font-pixel text-base uppercase sm:text-lg">{title}</p>{/if}
		<div class="text-sm leading-[1.5] sm:text-base">{@render children?.()}</div>
	</div>
</aside>
