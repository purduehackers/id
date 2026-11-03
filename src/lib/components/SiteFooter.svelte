<script lang="ts">
	import Link from './ph/Link.svelte';

	let { class: className }: { class?: string } = $props();
</script>

<footer
	class={[
		'flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] tracking-wide uppercase',
		className
	]}
>
	<Link href="https://purduehackers.com">Purdue Hackers</Link>
	<Link href="https://github.com/purduehackers/id">Source</Link>
	<span>
		Icons: <Link href="https://pixeliconlibrary.com">HackerNoon Pixel Icon Library</Link>, CC BY 4.0
	</span>
</footer>
