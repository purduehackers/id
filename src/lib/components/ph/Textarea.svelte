<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	let { class: className, value = $bindable(), ...rest }: HTMLTextareaAttributes = $props();
</script>

<textarea
	bind:value
	class={[
		'min-h-24 w-full min-w-0 border-0 bg-muted px-3 py-2.5 text-foreground transition-colors duration-150 ease-quint outline-none placeholder:text-foreground/35 focus:bg-foreground/[0.09] focus:shadow-[inset_0_-2px_0_0_var(--foreground)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40',
		className
	]}
	{...rest}></textarea>
