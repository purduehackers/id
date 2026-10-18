<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import './checkbox.css';

	type Props = Omit<HTMLInputAttributes, 'type'> & {
		type?: 'checkbox' | 'radio';
		children?: Snippet;
	};

	let { type = 'checkbox', class: className, children, ...rest }: Props = $props();
</script>

<label class={['inline-flex cursor-pointer items-start gap-2 leading-[1.35]', className]}>
	<input {type} class="ph-checkbox mt-px" {...rest} />
	<span>{@render children?.()}</span>
</label>
