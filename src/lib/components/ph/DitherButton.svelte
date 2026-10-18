<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { pixelOrder } from './dither';
	import './dither-button.css';

	type Props = Omit<HTMLAnchorAttributes & HTMLButtonAttributes, 'type'> & {
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		tone?: 'light' | 'dark';
		cols?: number;
		rows?: number;
		children?: Snippet;
	};

	let {
		href,
		type = 'button',
		tone,
		cols = 10,
		rows = 5,
		class: className,
		style,
		children,
		...rest
	}: Props = $props();

	const order = $derived(pixelOrder(cols * rows));
</script>

<svelte:element
	this={href ? 'a' : 'button'}
	{href}
	type={href ? undefined : type}
	data-tone={tone}
	class={['ph-dither-btn', className]}
	style={[`--cols: ${cols}`, style].filter(Boolean).join('; ')}
	{...rest}
>
	<span class="ph-dither-btn__pixels" aria-hidden="true">
		{#each order as i, index (index)}
			<span class="ph-dither-btn__pixel" style="--i: {i}"></span>
		{/each}
	</span>
	<span class="ph-dither-btn__label">{@render children?.()}</span>
</svelte:element>
