<script lang="ts">
	let { code, class: className }: { code: string; class?: string } = $props();
</script>

<pre
	class={[
		'overflow-x-auto bg-muted px-4 py-3.5 font-mono text-[13px] leading-[1.5]',
		className
	]}>{code}</pre>
