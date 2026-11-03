<!-- Sign-in, verification and consent pages: form on one side, a live Life field on the other. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import Glider from './ph/Glider.svelte';
	import Life from './ph/Life.svelte';
	import SiteFooter from './SiteFooter.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="flex min-h-dvh flex-col lg:grid lg:grid-cols-2">
	<aside
		class="relative h-52 shrink-0 overflow-hidden bg-ph-yellow text-ph-black sm:h-60 lg:sticky lg:top-0 lg:order-2 lg:h-dvh"
	>
		<Life class="absolute inset-0 size-full cursor-crosshair text-ph-black" />
		<a
			href={resolve('/')}
			class="absolute bottom-0 left-0 flex flex-col gap-3 bg-ph-yellow py-4 pr-6 pl-6 no-underline sm:pl-10 lg:pr-10 lg:pb-10 lg:pl-12"
		>
			<span class="ph-headline text-3xl sm:text-5xl lg:text-7xl xl:text-8xl">
				Purdue<br class="hidden lg:block" /> Hackers ID
			</span>
		</a>
	</aside>

	<div class="flex flex-1 flex-col px-6 py-8 sm:px-10 lg:min-h-dvh lg:px-16 xl:px-24">
		<a
			href={resolve('/')}
			class="hidden items-center gap-2.5 self-start no-underline transition-colors hover:text-primary lg:flex"
		>
			<Glider class="size-5" />
			<span class="font-mono text-[13px] font-semibold tracking-wide uppercase">ID</span>
		</a>

		<!-- Every keystroke launches a glider into the field. -->
		<main
			oninput={() => window.dispatchEvent(new Event('ph:glider'))}
			class="flex w-full max-w-[440px] flex-1 flex-col justify-center gap-8 py-10 lg:py-16"
		>
			{@render children()}
		</main>

		<SiteFooter />
	</div>
</div>
