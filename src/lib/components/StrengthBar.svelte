<script lang="ts">
	import { STRENGTH_MAX, type AuthStrength } from '$lib/auth-strength';
	import Glider from './ph/Glider.svelte';

	let { strength }: { strength: AuthStrength } = $props();

	const COLORS = ['bg-ph-orange', 'bg-ph-yellow', 'bg-ph-lime', 'bg-ph-teal', 'bg-ph-purple'];
	const full = $derived(strength.score === STRENGTH_MAX);
</script>

<span
	class="bar flex w-fit items-center gap-2"
	role="img"
	aria-label="Auth strength: {strength.tier}, {strength.score} of {STRENGTH_MAX}"
	title="{strength.tier}: {strength.score} of {STRENGTH_MAX}"
>
	<span class="flex gap-0.5" aria-hidden="true">
		{#each COLORS as color, n (color)}
			{@const on = n < strength.score}
			<span
				class={['cell block h-3.5 w-4 sm:w-5', on ? ['on', color] : 'dither-field']}
				style="--n: {n}"
			></span>
		{/each}
	</span>
	{#if full}<Glider class="glider size-3.5!" />{/if}
</span>

<style>
	.on {
		animation: fill 320ms var(--ph-ease) backwards;
		animation-delay: calc(var(--n) * 70ms);
		transform-origin: left;
	}

	.bar:hover .on {
		animation: hop 420ms var(--ph-ease);
		animation-delay: calc(var(--n) * 50ms);
	}

	.bar :global(.glider) {
		animation: glide 900ms steps(2) infinite;
	}

	@keyframes fill {
		from {
			transform: scaleX(0);
		}
	}

	@keyframes hop {
		40% {
			transform: translateY(-5px);
		}
	}

	@keyframes glide {
		50% {
			transform: translate(2px, -2px) rotate(90deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.on,
		.bar:hover .on,
		.bar :global(.glider) {
			animation: none;
		}
	}
</style>
