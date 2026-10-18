<!-- Inline status line for form results. Not a registry component: built from Icon + palette. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	type Props = { tone?: 'error' | 'success' | 'info'; class?: string; children?: Snippet };

	let { tone = 'error', class: className, children }: Props = $props();

	const tones = {
		error: { icon: 'exclamation-triangle', box: 'border-ph-orange bg-ph-orange/15' },
		success: { icon: 'check-circle', box: 'border-ph-lime bg-ph-lime/20' },
		info: { icon: 'info-circle', box: 'border-ph-blue bg-ph-blue/10' }
	} as const;
</script>

<p
	role={tone === 'error' ? 'alert' : 'status'}
	class={['flex items-start gap-2 border-l-4 px-3 py-2 text-[15px]', tones[tone].box, className]}
>
	<Icon name={tones[tone].icon} class="mt-0.5" />
	<span>{@render children?.()}</span>
</p>
