<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = Omit<HTMLInputAttributes, 'size'> & { size?: 'sm' | 'md' | 'code' };

	let { class: className, size = 'md', value = $bindable(), ...rest }: Props = $props();

	const sizes = {
		sm: 'h-9 text-[15px]',
		md: 'h-12 text-lg',
		code: 'h-16 font-mono text-3xl tracking-[0.35em]'
	};
</script>

<input
	bind:value
	class={[
		'w-full min-w-0 border-0 border-b border-input bg-transparent px-0 text-foreground transition-[border-color,box-shadow] duration-150 ease-quint outline-none placeholder:text-foreground/35 hover:border-foreground/60 focus:border-foreground focus:shadow-[0_1px_0_0_var(--foreground)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-ph-orange',
		sizes[size],
		className
	]}
	{...rest}
/>
