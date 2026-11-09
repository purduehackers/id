<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';

	type Props = SVGAttributes<SVGSVGElement> & { label?: string; solid?: boolean };

	let { label, solid = false, class: className, ...rest }: Props = $props();
</script>

<svg
	viewBox="0 0 3 3"
	xmlns="http://www.w3.org/2000/svg"
	class={['block size-6 shrink-0', className]}
	shape-rendering={solid ? 'geometricPrecision' : 'crispEdges'}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	focusable="false"
	{...rest}
>
	{#if solid}
		<!-- Union the two connected blocks so transformed edges cannot expose a seam. -->
		<path d="M1 0H2V1H3V3H2V2H1ZM0 2H1V3H0Z" fill="currentColor" />
	{:else}
		<rect x="1" y="0" width="1" height="2" fill="var(--glider-a, currentColor)" />
		<rect x="2" y="1" width="1" height="2" fill="var(--glider-b, currentColor)" />
		<rect x="0" y="2" width="1" height="1" fill="var(--glider-c, currentColor)" />
	{/if}
</svg>
