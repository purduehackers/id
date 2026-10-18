<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let { class: className, value = $bindable(), ...rest }: HTMLInputAttributes = $props();
</script>

<input
	bind:value
	class={[
		'h-10 w-full min-w-0 border border-input bg-card px-3 font-sans text-[15px] text-card-foreground transition-colors duration-150 ease-quint outline-none placeholder:text-card-foreground/55 focus-visible:border-foreground disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-ph-orange',
		className
	]}
	{...rest}
/>
