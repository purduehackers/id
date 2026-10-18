<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		href,
		class: className,
		children
	}: { href: string; class?: string; children?: Snippet } = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolved hrefs -->
<a
	{href}
	class={[
		'inline-flex items-center gap-1 font-pixel text-xs uppercase no-underline transition-colors duration-150 hover:text-ph-purple sm:text-sm dark:hover:text-ph-yellow',
		className
	]}
>
	<span aria-hidden="true">&lt;&lt;</span>
	{@render children?.()}
</a>
