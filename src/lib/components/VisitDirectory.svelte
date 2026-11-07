<script lang="ts">
	import DitherButton from '$lib/components/ph/DitherButton.svelte';
	import Icon from '$lib/components/ph/Icon.svelte';

	const pixelColors = ['pink', 'lime', 'orange', 'teal', 'periwinkle'].flatMap((color) => [
		`var(--ph-${color})`,
		'var(--ph-yellow)'
	]);
</script>

<DitherButton
	href="https://directory.purduehackers.com"
	target="_blank"
	rel="noopener noreferrer"
	cols={12}
	rows={3}
	{pixelColors}
	class="visit-directory active:scale-[0.97]"
	style="--btn-bg: var(--ph-yellow); --pixel: var(--ph-yellow); --label: var(--ph-black); --label-hover: var(--ph-black)"
>
	<span class="label">
		Visit directory
		<Icon name="external-link" />
	</span>
</DitherButton>

<style>
	:global(.ph-dither-btn.visit-directory) {
		height: 2.5rem;
		padding: 0 1rem;
		font-size: 15px;
		font-weight: 600;
		white-space: nowrap;
	}

	:global(.ph-dither-btn.visit-directory::after) {
		--width: 3px;
		--period: 42px;
		--stops:
			var(--ph-orange) 0 6px, var(--ph-pink) 6px 12px, var(--ph-purple) 12px 18px,
			var(--ph-periwinkle) 18px 24px, var(--ph-blue) 24px 30px, var(--ph-teal) 30px 36px,
			var(--ph-lime) 36px 42px;
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			linear-gradient(90deg, var(--stops)) 0 0 / var(--period) var(--width) repeat-x,
			linear-gradient(180deg, var(--stops)) 100% 0 / var(--width) var(--period) repeat-y,
			linear-gradient(270deg, var(--stops)) 0 100% / var(--period) var(--width) repeat-x,
			linear-gradient(0deg, var(--stops)) 0 0 / var(--width) var(--period) repeat-y;
	}

	.label {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	@media (prefers-reduced-motion: no-preference) {
		:global(.ph-dither-btn:focus-visible) .label :global(polygon:last-child) {
			animation: visit-directory-arrow 500ms steps(4);
		}

		:global(.ph-dither-btn.visit-directory:focus-visible::after) {
			animation: visit-directory-border 700ms steps(7) infinite;
		}
	}

	@media (hover: hover) and (prefers-reduced-motion: no-preference) {
		:global(.ph-dither-btn:hover) .label :global(polygon:last-child) {
			animation: visit-directory-arrow 500ms steps(4);
		}

		:global(.ph-dither-btn.visit-directory:hover::after) {
			animation: visit-directory-border 700ms steps(7) infinite;
		}
	}

	@keyframes visit-directory-arrow {
		50% {
			transform: translate(14px, -14px);
		}
		50.01% {
			transform: translate(-14px, 14px);
		}
	}

	@keyframes visit-directory-border {
		to {
			background-position:
				42px 0,
				100% 42px,
				-42px 100%,
				0 -42px;
		}
	}
</style>
