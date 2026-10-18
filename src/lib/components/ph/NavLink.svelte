<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import './nav-link.css';

	type Props = HTMLAnchorAttributes & { href: string; tone?: 'light' | 'dark'; children?: Snippet };

	let { href, tone, class: className, children, ...rest }: Props = $props();
	const external = $derived(/^https?:\/\//.test(href));
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolved hrefs -->
<a
	{href}
	target={external ? '_blank' : undefined}
	rel={external ? 'noopener noreferrer' : undefined}
	data-tone={tone}
	class={['ph-nav-link', className]}
	{...rest}>{@render children?.()}</a
>
