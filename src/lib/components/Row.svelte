<!-- List row: icon tile, a title line, mono meta, actions on the right. Spacing, not lines. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './ph/Icon.svelte';
	import type { IconName } from './ph/icons';

	type Props = {
		icon?: IconName;
		title: Snippet;
		meta?: Snippet;
		actions?: Snippet;
		children?: Snippet;
	};

	let { icon, title, meta, actions, children }: Props = $props();
</script>

<li class="flex gap-4 py-3">
	{#if icon}
		<span class="grid size-11 shrink-0 place-items-center bg-muted">
			<Icon name={icon} class="size-5" />
		</span>
	{/if}
	<div class="flex min-w-0 flex-1 flex-col gap-3">
		<div class="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2">
			<div class="flex min-w-0 flex-col gap-0.5">
				<div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[17px] break-all">
					{@render title()}
				</div>
				{#if meta}<div class="font-mono text-[13px]">{@render meta()}</div>{/if}
			</div>
			{#if actions}<div class="flex flex-wrap items-center gap-1">{@render actions()}</div>{/if}
		</div>
		{@render children?.()}
	</div>
</li>
