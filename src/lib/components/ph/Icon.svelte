<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';
	import { icons, type IconName } from './icons';

	type Props = SVGAttributes<SVGSVGElement> & { name: IconName; label?: string };

	let { name, label, class: className, ...rest }: Props = $props();
</script>

<svg
	viewBox="0 0 24 24"
	fill="currentColor"
	shape-rendering="crispEdges"
	class={['size-4 shrink-0', className]}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	focusable="false"
	{...rest}
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- static icon markup from icons.ts -->
	{@html icons[name]}
</svg>
