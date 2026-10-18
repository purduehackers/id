<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import './link.css';

	type Props = HTMLAnchorAttributes & { href: string; tint?: string; children?: Snippet };

	let { href, tint, class: className, style, children, ...rest }: Props = $props();
	const external = $derived(/^https?:\/\//.test(href));
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolved hrefs -->
<a
	{href}
	target={external ? '_blank' : undefined}
	rel={external ? 'noopener noreferrer' : undefined}
	data-tint={tint ? '' : undefined}
	class={['ph-link', className]}
	style={[tint && `--link: ${tint}`, style].filter(Boolean).join('; ') || undefined}
	{...rest}>{@render children?.()}</a
>
