<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';

	type Props = Omit<HTMLSelectAttributes, 'size'> & { size?: 'sm' | 'md' };

	let { class: className, size = 'md', value = $bindable(), children, ...rest }: Props = $props();
</script>

<span class={['relative inline-flex', className]}>
	<select
		bind:value
		class={[
			'w-full min-w-0 cursor-pointer appearance-none border-0 border-b border-input bg-transparent pr-7 pl-0 text-foreground transition-[border-color,box-shadow] duration-150 outline-none hover:border-foreground/60 focus:border-foreground focus:shadow-[0_1px_0_0_var(--foreground)] focus-visible:outline-none',
			size === 'sm' ? 'h-9 text-[15px]' : 'h-12 text-lg'
		]}
		{...rest}
	>
		{@render children?.()}
	</select>
	<Icon name="chevron-down" class="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2" />
</span>
