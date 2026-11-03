<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import './link.css';

	let {
		class: className,
		type = 'submit',
		children,
		...rest
	}: HTMLButtonAttributes & { children?: Snippet } = $props();
</script>

<button {type} class={['ph-link cursor-pointer', className]} {...rest}
	>{@render children?.()}</button
>
