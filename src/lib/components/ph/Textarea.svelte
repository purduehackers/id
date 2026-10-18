<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	let { class: className, value = $bindable(), ...rest }: HTMLTextareaAttributes = $props();
</script>

<textarea
	bind:value
	class={[
		'min-h-24 w-full min-w-0 border border-input bg-card px-3 py-2 font-sans text-[15px] text-card-foreground transition-colors duration-150 ease-quint outline-none placeholder:text-card-foreground/55 focus-visible:border-foreground disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-ph-orange',
		className
	]}
	{...rest}></textarea>
