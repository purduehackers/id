<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		color?:
			'default' | 'yellow' | 'purple' | 'pink' | 'blue' | 'lime' | 'teal' | 'orange' | 'outline';
		class?: string;
		children?: Snippet;
	};

	let { color = 'default', class: className, children }: Props = $props();

	const colors = {
		default: 'bg-foreground text-background',
		yellow: 'bg-ph-yellow text-ph-black',
		purple: 'bg-ph-purple text-ph-cream',
		pink: 'bg-ph-pink text-ph-black',
		blue: 'bg-ph-blue text-ph-cream',
		lime: 'bg-ph-lime text-ph-black',
		teal: 'bg-ph-teal text-ph-black',
		orange: 'bg-ph-orange text-ph-black',
		outline: 'border border-foreground text-foreground'
	};
</script>

<span
	class={[
		'inline-flex w-fit items-center gap-1 px-1.5 py-0.5 align-middle font-mono text-[11px] leading-none font-semibold tracking-wide uppercase',
		colors[color],
		className
	]}
>
	{@render children?.()}
</span>
