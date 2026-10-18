<script lang="ts">
	let { label, class: className }: { label?: string; class?: string } = $props();
</script>

{#if label}
	<div role="separator" class={['flex items-center gap-2', className]}>
		<span class="font-mono text-[11px] leading-none tracking-wide uppercase">{label}</span>
		<span class="h-px flex-1 bg-foreground"></span>
	</div>
{:else}
	<div role="separator" class={['h-px w-full bg-border', className]}></div>
{/if}
