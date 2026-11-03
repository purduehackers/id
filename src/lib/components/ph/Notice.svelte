<script lang="ts">
	import type { Snippet } from 'svelte';
	import GliderLaunch from './GliderLaunch.svelte';
	import Icon from './Icon.svelte';

	type Props = { tone?: 'error' | 'success' | 'info'; class?: string; children?: Snippet };

	let { tone = 'error', class: className, children }: Props = $props();

	const tones = {
		error: { icon: 'exclamation-triangle', color: 'text-ph-orange' },
		success: { icon: 'check-circle', color: 'text-ph-lime' },
		info: { icon: 'info-circle', color: 'text-ph-blue' }
	} as const;
</script>

<p
	role={tone === 'error' ? 'alert' : 'status'}
	class={['relative flex enter items-start gap-2.5 text-[15px] leading-[1.45]', className]}
>
	<Icon name={tones[tone].icon} class={['mt-0.5 size-[18px]', tones[tone].color]} />
	{#if tone === 'success'}<GliderLaunch class="top-0.5 left-0.5" />{/if}
	<span>{@render children?.()}</span>
</p>
