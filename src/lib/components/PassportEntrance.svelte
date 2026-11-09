<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import Passport from './Passport.svelte';

	// Compatibility alias; new consumers should import Passport directly.
	let props: ComponentProps<typeof Passport> = $props();
</script>

<Passport {...props} />
