<!-- Preformatted block for JSON payloads and shell snippets. -->
<script lang="ts">
	let { code, class: className }: { code: string; class?: string } = $props();
</script>

<pre
	class={[
		'overflow-x-auto border border-border bg-muted p-3 font-mono text-[13px] leading-[1.45]',
		className
	]}>{code}</pre>
