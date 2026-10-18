<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';

	let { class: className, children, ...rest }: HTMLSelectAttributes = $props();
</script>

<span class={['relative inline-flex', className]}>
	<select
		class="h-10 w-full min-w-0 cursor-pointer appearance-none border border-input bg-card pr-9 pl-3 font-sans text-[15px] text-card-foreground transition-colors duration-150 ease-quint outline-none focus-visible:border-foreground"
		{...rest}
	>
		{@render children?.()}
	</select>
	<Icon name="chevron-down" class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" />
</span>
