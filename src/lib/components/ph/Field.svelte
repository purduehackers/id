<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	type Props = {
		label: string;
		for?: string;
		hint?: string;
		optional?: boolean;
		error?: string;
		class?: string;
		children?: Snippet;
	};

	let { label, for: htmlFor, hint, optional, error, class: className, children }: Props = $props();
</script>

<div class={['flex flex-col gap-1.5', className]}>
	<label for={htmlFor} class={['ph-subheadline text-[12px]', optional && 'text-foreground/55']}>
		{label}
	</label>
	{@render children?.()}
	{#if error}
		<p class="flex items-center gap-1.5 text-[13px]">
			<Icon name="exclamation-triangle" class="size-3.5 text-ph-orange" />
			{error}
		</p>
	{:else if hint}
		<p class="text-[13px]">{hint}</p>
	{/if}
</div>
