<!-- An authorized app as a stamp in your passport: coloured, slightly crooked, straightens on hover. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { SWATCHES, hash } from './pixel';
	import Identicon from './Identicon.svelte';

	type Props = {
		name: string;
		seed: string;
		date: string;
		scopes: string[];
		children?: Snippet;
		index?: number;
	};

	let { name, seed, date, scopes, children, index = 0 }: Props = $props();

	// Cycle by position so neighbouring stamps never share a colour.
	const color = $derived(SWATCHES[index % SWATCHES.length]);
	const angle = $derived(((hash(seed) % 70) - 35) / 10);
</script>

<li
	class={[
		'group flex enter flex-col gap-4 p-5 transition-transform duration-200 ease-out focus-within:rotate-0 hover:rotate-0',
		color.bg,
		color.fg
	]}
	style="rotate: {angle}deg; --i: {index}"
>
	<div class="flex items-start justify-between gap-3">
		<Identicon {seed} class="size-9" />
		<span class="font-mono text-[12px] font-semibold uppercase">Granted {date}</span>
	</div>
	<h3 class="ph-headline text-3xl break-words">{name}</h3>
	<p class="font-mono text-[12px] leading-[1.6] uppercase">{scopes.join(' · ')}</p>
	<div class="-mx-2 mt-auto -mb-2">{@render children?.()}</div>
</li>
