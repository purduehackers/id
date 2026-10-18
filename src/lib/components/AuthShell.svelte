<!-- Narrow single-column frame for sign-in, verification and consent pages. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import Glider from './ph/Glider.svelte';
	import SiteFooter from './SiteFooter.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="flex min-h-dvh flex-col">
	<header class="border-b border-border grid-bg">
		<div class="measure flex items-center gap-3 py-5">
			<a
				href={resolve('/')}
				class="flex items-end gap-2.5 no-underline transition-colors hover:text-ph-purple"
			>
				<Glider class="size-7" />
				<span class="ph-headline text-2xl">Purdue Hackers ID</span>
			</a>
		</div>
	</header>

	<main class="measure flex flex-1 flex-col gap-6 py-12">
		{@render children()}
	</main>

	<div class="measure"><SiteFooter /></div>
</div>
