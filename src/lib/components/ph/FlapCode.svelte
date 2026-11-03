<!-- A code that lands like a split-flap board: each cell spins through digits, then settles. -->
<script lang="ts">
	import { onMount, untrack } from 'svelte';

	let { code, group = 3 }: { code: string; group?: number } = $props();

	let shown = $state(untrack(() => code.split('')));

	onMount(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const chars = code.split('');
		const start = performance.now();
		let raf = 0;
		const tick = (t: number) => {
			let done = true;
			shown = chars.map((c, i) => {
				if (t - start > 260 + i * 90) return c;
				done = false;
				return String(Math.floor(Math.random() * 10));
			});
			if (!done) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<div class="flex items-center gap-1.5 sm:gap-2" aria-label={code.split('').join(' ')} role="img">
	{#each shown as c, i (i)}
		{#if i > 0 && i % group === 0}<span class="w-2 sm:w-4"></span>{/if}
		<span
			class="relative grid h-20 w-13 place-items-center bg-muted font-mono text-5xl font-semibold sm:h-24 sm:w-16 sm:text-6xl"
		>
			<span class="absolute inset-x-0 top-1/2 h-0.5 bg-background"></span>
			{c}
		</span>
	{/each}
</div>
