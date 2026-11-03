<script lang="ts">
	import Icon from './Icon.svelte';
	import Identicon from '../Identicon.svelte';

	type Props = {
		title: string;
		note?: string;
		seed?: string;
		values: { label: string; value: string }[];
	};

	let { title, note, seed, values }: Props = $props();
	let copied = $state<string | null>(null);

	async function copy(label: string, value: string) {
		await navigator.clipboard.writeText(value);
		copied = label;
		setTimeout(() => (copied = copied === label ? null : copied), 1500);
	}
</script>

<section class="flex enter flex-col gap-4 bg-ph-yellow p-5 text-ph-black sm:p-7">
	<div class="flex items-start justify-between gap-4">
		<div class="flex flex-col gap-1.5">
			<h2 class="ph-headline text-3xl">{title}</h2>
			{#if note}<p>{note}</p>{/if}
		</div>
		{#if seed}
			<span class="print grid size-16 shrink-0 place-items-center bg-ph-black text-ph-yellow">
				<Identicon {seed} accent="var(--ph-pink)" class="size-10" />
			</span>
		{/if}
	</div>
	{#each values as { label, value } (label)}
		<div class="flex flex-col gap-1.5">
			<span class="ph-subheadline text-[12px]">{label}</span>
			<div class="flex items-stretch bg-ph-black/[0.08]">
				<code class="min-w-0 flex-1 px-3 py-2.5 font-mono text-[14px] break-all select-all">
					{value}
				</code>
				<button
					type="button"
					onclick={() => copy(label, value)}
					class="flex shrink-0 items-center gap-1.5 px-3 font-mono text-[12px] font-semibold uppercase transition-colors hover:bg-ph-black hover:text-ph-yellow active:scale-[0.97]"
				>
					<Icon name={copied === label ? 'check' : 'copy'} />
					{copied === label ? 'Copied' : 'Copy'}
				</button>
			</div>
		</div>
	{/each}
</section>

<style>
	.print {
		animation: print 750ms 250ms steps(5, end) both;
	}

	@keyframes print {
		from {
			clip-path: inset(0 0 100% 0);
		}
		to {
			clip-path: inset(0 0 0 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.print {
			animation: none;
		}
	}
</style>
