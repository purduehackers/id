<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { capitalizeName } from '$lib/profile';
	import Input from './Input.svelte';

	let { value = $bindable(), ...rest }: ComponentProps<typeof Input> = $props();

	function capitalize(event: Event) {
		if ((event as InputEvent).isComposing) return;
		const input = event.currentTarget as HTMLInputElement;
		const next = capitalizeName(input.value);
		if (next === input.value) return;
		const { selectionStart, selectionEnd } = input;
		input.value = next;
		input.setSelectionRange(selectionStart, selectionEnd);
		value = next;
	}
</script>

<Input
	bind:value
	autocapitalize="words"
	oninput={capitalize}
	oncompositionend={capitalize}
	{...rest}
/>
