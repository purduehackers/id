<script lang="ts">
	import type { Snippet } from 'svelte';
	import Glider from './Glider.svelte';
	import Link from './Link.svelte';

	type Props = { links?: { label: string; href: string }[]; class?: string; children?: Snippet };

	let { links = [], class: className, children }: Props = $props();
</script>

<footer class={['flex flex-col gap-6 border-t border-foreground py-8', className]}>
	<div class="flex flex-wrap items-end justify-between gap-6">
		<div class="flex items-end gap-3">
			<Glider class="size-8" />
			<span class="ph-headline text-3xl">Purdue Hackers</span>
		</div>
		{#if links.length > 0}
			<nav class="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[13px] uppercase">
				{#each links as l (l.href)}
					<Link href={l.href}>{l.label}</Link>
				{/each}
			</nav>
		{/if}
	</div>
	<div class="text-[13px] leading-[1.5]">{@render children?.()}</div>
</footer>
