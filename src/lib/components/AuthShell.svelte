<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import Glider from './ph/Glider.svelte';
	import Life from './ph/Life.svelte';
	import SiteFooter from './SiteFooter.svelte';

	let { children, booklet = false }: { children: Snippet; booklet?: boolean } = $props();
</script>

<div class="flex min-h-dvh flex-col overflow-x-clip lg:grid lg:grid-cols-2">
	<div class="flex flex-1 flex-col px-6 py-6 sm:px-10 lg:min-h-dvh lg:px-16 lg:py-8 xl:px-24">
		{#if !booklet}
			<a
				href={resolve('/')}
				class="flex items-center gap-2.5 self-start no-underline transition-colors hover:text-primary"
			>
				<Glider class="size-5" />
				<span class="ph-headline text-xl lg:hidden">Purdue Hackers ID</span>
				<span class="hidden font-mono text-[13px] font-semibold tracking-wide uppercase lg:inline">
					ID
				</span>
			</a>
		{/if}

		<main
			class:booklet
			oninput={() => window.dispatchEvent(new Event('ph:glider'))}
			class="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-8 py-8 lg:justify-center lg:py-16"
		>
			{@render children()}
		</main>

		<SiteFooter />
	</div>

	<aside
		class="relative h-40 shrink-0 overflow-hidden bg-ph-yellow text-ph-black sm:h-52 lg:sticky lg:top-0 lg:h-dvh"
	>
		<Life class="absolute inset-0 size-full cursor-crosshair text-ph-black" />
		<a
			href={resolve('/')}
			class="absolute bottom-0 left-0 hidden flex-col gap-3 bg-ph-yellow pt-4 pr-10 pb-10 pl-12 no-underline lg:flex"
		>
			<span class="ph-headline text-7xl xl:text-8xl">Purdue<br /> Hackers ID</span>
		</a>
	</aside>
</div>

<style>
	main.booklet {
		justify-content: flex-start;
		padding-top: calc(32px + env(safe-area-inset-top, 0px));
	}
</style>
