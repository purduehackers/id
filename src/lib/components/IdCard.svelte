<script lang="ts">
	import type { IdCardData } from '$lib/id-card';
	import Glider from './ph/Glider.svelte';
	import Icon from './ph/Icon.svelte';
	import Identicon from './Identicon.svelte';
	import { hash } from './pixel';
	import { formatPhone } from '$lib/profile';
	import { ROLE_LABELS } from '$lib/roles';

	type Props = IdCardData & { embedded?: boolean };

	let {
		id,
		name,
		givenName,
		familyName,
		username,
		image,
		email,
		phone,
		roles,
		graduationYear,
		since,
		passports,
		linked,
		censored = false,
		embedded = false
	}: Props = $props();

	const themes = {
		admin: { card: 'bg-ph-purple text-ph-cream', accent: 'var(--ph-yellow)' },
		organizer: { card: 'bg-ph-pink text-ph-black', accent: 'var(--ph-purple)' },
		alumni: { card: 'bg-ph-teal text-ph-black', accent: 'var(--ph-cream)' },
		member: { card: 'bg-ph-yellow text-ph-black', accent: 'var(--ph-purple)' }
	};
	const theme = $derived(themes[roles[0] ?? 'member']);
	const label = $derived(roles[0] ? ROLE_LABELS[roles[0]] : 'Member');
	const serial = $derived(String(passports[0] ?? hash(id) % 10000).padStart(4, '0'));
	const registered = $derived(new Date(since ?? 0));
	const longestWord = $derived(Math.max(...name.split(/\s+/).map((word) => word.length)));

	const mrzName = $derived(
		name
			.normalize('NFD')
			.replace(/[^A-Za-z ]/g, '')
			.trim()
			.toUpperCase()
			.split(/\s+/)
			.join('<')
	);
	const fill = (s: string, n = 36) => (s + '<'.repeat(n)).slice(0, n);
	const mrz = $derived([
		fill(`ID<PRH<${mrzName}`),
		fill(
			`${(username ?? '').toUpperCase()}<<${serial}<${label.slice(0, 3).toUpperCase()}<${registered.getFullYear()}`
		)
	]);

	let card: HTMLDivElement;
	let tilt = $state({ x: 0, y: 0 });
	let flipped = $state(false);

	function move(event: PointerEvent) {
		if (embedded || event.pointerType !== 'mouse') return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const r = card.getBoundingClientRect();
		tilt = {
			x: ((event.clientY - r.top) / r.height - 0.5) * -8,
			y: ((event.clientX - r.left) / r.width - 0.5) * 10
		};
	}

	const face =
		'id-face col-start-1 row-start-1 flex flex-col p-5 backface-hidden sm:aspect-[1.586] sm:p-7';
</script>

<div
	class="id-card w-full max-w-[560px] perspective-[1200px]"
	class:enter={!embedded}
	class:embedded
	style="--i: 1"
>
	<div
		bind:this={card}
		onpointermove={move}
		onpointerleave={() => (tilt = { x: 0, y: 0 })}
		class="id-tilt transition-transform duration-300 ease-out transform-3d"
		style="transform: rotateX({tilt.x}deg) rotateY({tilt.y}deg)"
		role="presentation"
	>
		<button
			type="button"
			disabled={embedded}
			onclick={() => {
				if (!embedded) flipped = !flipped;
			}}
			aria-pressed={embedded ? undefined : flipped}
			aria-label={`Purdue Hackers ID for ${name}, @${username}, ${label}${embedded ? '' : '. Flip the card'}`}
			class="id-flip grid w-full cursor-pointer grid-cols-1 text-left transition-transform duration-500 ease-quint select-none transform-3d motion-reduce:transition-none"
			style="transform: rotateY({flipped ? 180 : 0}deg)"
		>
			<!-- Front -->
			<div class={[face, 'id-front justify-between gap-6', theme.card]} aria-hidden="true">
				<div class="id-heading flex items-start justify-between gap-4">
					<div class="id-brand flex items-center gap-2">
						<Glider class="id-brand-logo size-5" />
						<span class="ph-subheadline text-[11px] sm:text-[12px]">Purdue Hackers · Identity</span>
					</div>
					<span
						class="id-serial flex items-center gap-2 font-mono text-[12px] font-semibold sm:text-[13px]"
					>
						Nº {serial}
						{#if !embedded}<Icon name="refresh" class="size-3.5" />{/if}
					</span>
				</div>

				<div class="id-person flex items-end gap-4 sm:gap-6">
					<div
						class="id-picture grid size-20 shrink-0 place-items-center overflow-hidden bg-ph-black/10 sm:size-28"
					>
						{#if image}
							<img src={image} alt="" class="size-full object-cover" />
						{:else}
							<Identicon seed={id} accent={theme.accent} class="id-identicon size-12 sm:size-16" />
						{/if}
					</div>
					<div class="id-details flex min-w-0 flex-col gap-1.5 sm:gap-2">
						<span
							class:long-name={name.length > 12}
							class:long-word={longestWord > 10}
							class={[
								'id-name ph-headline break-words',
								longestWord > 10 ? 'text-2xl' : 'text-4xl',
								name.length > 16 ? 'sm:text-5xl' : 'sm:text-6xl'
							]}
						>
							{name}
						</span>
						<span
							class="id-meta flex flex-wrap gap-x-3 font-mono text-[12px] font-semibold uppercase sm:text-[13px]"
						>
							<span>@{username}</span>
							<span>{label}</span>
							<span>Since {registered.getFullYear()}</span>
							{#if censored}<span
									>Class of <span class="id-redacted" style:width="5.5cqw"></span></span
								>{:else if graduationYear}<span>Class of {graduationYear}</span>{/if}
						</span>
						<span class="id-email truncate text-[13px] sm:text-[14px]"
							>{#if censored}<span class="id-redacted" style:width="38cqw"
								></span>{:else}{email}{/if}</span
						>
					</div>
				</div>

				<div
					class="id-mrz -mx-5 -mb-5 bg-ph-black/[0.07] px-5 py-2 font-mono text-[10px] leading-[1.35] tracking-[0.18em] sm:-mx-7 sm:-mb-7 sm:px-7 sm:text-[12px]"
				>
					{#each mrz as line, i (i)}<div class="truncate">{line}</div>{/each}
				</div>
			</div>

			{#if !embedded}
				<!-- Back -->
				<div class={[face, 'rotate-y-180 gap-4', theme.card]} aria-hidden="true">
					<div class="-mx-5 -mt-1 h-10 shrink-0 bg-ph-black sm:-mx-7 sm:h-11"></div>

					<div class="flex items-stretch gap-3">
						<div
							class="flex min-w-0 flex-1 flex-col justify-center bg-ph-cream px-3 py-2 text-ph-black"
						>
							<span class="ph-subheadline text-[9px]">Authorized signature</span>
							<span class="-rotate-2 truncate ph-headline text-2xl">{name}</span>
						</div>
						<span class="grid w-14 shrink-0 place-items-center bg-ph-black/10">
							<Identicon seed={id} accent={theme.accent} class="size-8" />
						</span>
					</div>

					<dl
						class="grid flex-1 grid-cols-2 content-start gap-x-5 gap-y-2 text-[13px] sm:text-[14px]"
					>
						<div class="min-w-0">
							<dt class="ph-subheadline text-[10px] sm:text-[11px]">Given names</dt>
							<dd class="break-words">{givenName || name}</dd>
						</div>
						{#if familyName}
							<div class="min-w-0">
								<dt class="ph-subheadline text-[10px] sm:text-[11px]">Surname</dt>
								<dd class="break-words">{familyName}</dd>
							</div>
						{/if}
						<div class="min-w-0">
							<dt class="ph-subheadline text-[10px] sm:text-[11px]">
								Passport ID<span class="normal-case">s</span>
							</dt>
							<dd class="font-mono font-semibold break-words">
								{passports.length ? passports.map((p) => `#${p}`).join('  ') : 'None yet'}
							</dd>
						</div>
						<div class="min-w-0">
							<dt class="ph-subheadline text-[10px] sm:text-[11px]">Registered</dt>
							<dd>
								{registered.toLocaleDateString(undefined, {
									year: 'numeric',
									month: 'long',
									day: 'numeric'
								})}
							</dd>
						</div>
						{#if phone}
							<div class="min-w-0">
								<dt class="ph-subheadline text-[10px] sm:text-[11px]">Phone</dt>
								<dd class="font-mono break-words">{formatPhone(phone)}</dd>
							</div>
						{/if}
						<div class="min-w-0">
							<dt class="ph-subheadline text-[10px] sm:text-[11px]">Linked</dt>
							<dd class="break-words">{linked.length ? linked.join(', ') : 'Nothing linked'}</dd>
						</div>
					</dl>

					<p class="flex items-center gap-2 font-mono text-[10px] uppercase sm:text-[11px]">
						<Glider class="size-3.5" />
						Property of Purdue Hackers. If found, return to purduehackers.com
					</p>
				</div>
			{/if}
		</button>
	</div>
</div>

<style>
	.embedded {
		position: relative;
		width: 100%;
		max-width: 560px;
		min-width: 0;
		aspect-ratio: 85.6 / 53.98;
		container-type: inline-size;
		perspective: 1200px;
	}
	.embedded .id-tilt {
		position: absolute;
		inset: 0;
	}
	.embedded .id-flip {
		cursor: default;
		height: 100%;
		grid-template-columns: minmax(0, 1fr);
	}
	.embedded .id-face {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		padding: 5cqw;
		aspect-ratio: auto;
		overflow: hidden;
		overflow-wrap: anywhere;
	}
	.embedded .id-heading {
		gap: 2.8cqw;
		font-size: 2.14cqw;
		line-height: 1.2;
	}
	.embedded .id-brand,
	.embedded .id-brand :global(.id-brand-logo) {
		width: 3.57cqw;
		height: 3.57cqw;
	}
	.embedded .id-serial {
		gap: 1.4cqw;
		font-size: 2.32cqw;
		white-space: nowrap;
	}
	.embedded .id-person {
		gap: 4.28cqw;
	}
	.embedded .id-picture {
		width: 20cqw;
		height: 20cqw;
	}
	.embedded .id-picture :global(.id-identicon) {
		width: 11.42cqw;
		height: 11.42cqw;
	}
	.embedded .id-name {
		font-size: 10.7cqw;
		line-height: 1;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		overflow-wrap: anywhere;
	}
	.embedded .id-name.long-name {
		font-size: 8.57cqw;
	}
	.embedded .id-name.long-word {
		font-size: 7.3cqw;
	}
	.id-redacted {
		display: inline-block;
		height: 1em;
		vertical-align: middle;
		background: currentColor;
	}
	.embedded .id-meta {
		gap: 0 2.14cqw;
		font-size: 2.32cqw;
		line-height: 1.3;
	}
	.embedded .id-email {
		font-size: 2.5cqw;
	}
	.embedded .id-mrz {
		margin: 0 -5cqw -5cqw;
		padding: 1.4cqw 5cqw;
		font-size: 2.14cqw;
		line-height: 1.35;
		letter-spacing: 0.18em;
	}
	.embedded .id-front {
		gap: 0;
	}
	.embedded .id-heading .ph-subheadline {
		font-size: inherit;
	}
</style>
