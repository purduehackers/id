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
		'col-start-1 row-start-1 flex size-full min-h-0 min-w-0 flex-col overflow-hidden p-[5cqw] backface-hidden [overflow-wrap:anywhere]';
</script>

<div
	class="@container relative aspect-[85.6/53.98] w-full max-w-[560px] min-w-0 perspective-[1200px]"
	class:enter={!embedded}
	style="--i: 1"
>
	<div
		bind:this={card}
		onpointermove={move}
		onpointerleave={() => (tilt = { x: 0, y: 0 })}
		class="absolute inset-0 transition-transform duration-300 ease-out transform-3d"
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
			class={[
				'grid size-full grid-cols-[minmax(0,1fr)] text-left transition-transform duration-500 ease-quint select-none transform-3d motion-reduce:transition-none',
				embedded ? 'cursor-default' : 'cursor-pointer'
			]}
			style="transform: rotateY({flipped ? 180 : 0}deg)"
		>
			<!-- Front -->
			<div class={[face, 'justify-between', theme.card]} aria-hidden="true">
				<div class="flex items-start justify-between gap-[2.8cqw] text-[2.14cqw] leading-[1.2]">
					<div class="flex items-center gap-[1.4cqw]">
						<Glider class="size-[3.57cqw]" />
						<span class="ph-subheadline text-[length:inherit]">Purdue Hackers · Identity</span>
					</div>
					<span
						class="flex items-center gap-[1.4cqw] font-mono text-[2.32cqw] font-semibold whitespace-nowrap"
					>
						Nº {serial}
						{#if !embedded}<Icon name="refresh" class="size-[2.5cqw]" />{/if}
					</span>
				</div>

				<div class="flex items-end gap-[4.28cqw]">
					<div class="grid size-[20cqw] shrink-0 place-items-center overflow-hidden bg-ph-black/10">
						{#if image}
							<img src={image} alt="" class="size-full object-cover" />
						{:else}
							<Identicon seed={id} accent={theme.accent} class="size-[11.42cqw]" />
						{/if}
					</div>
					<div class="flex min-w-0 flex-col gap-[1.4cqw]">
						<span
							class={[
								'line-clamp-2 ph-headline leading-none [overflow-wrap:anywhere]',
								longestWord > 10
									? 'text-[7.3cqw]'
									: name.length > 12
										? 'text-[8.57cqw]'
										: 'text-[10.7cqw]'
							]}
						>
							{name}
						</span>
						<span
							class="flex flex-wrap gap-x-[2.14cqw] gap-y-0 font-mono text-[2.32cqw] leading-[1.3] font-semibold uppercase"
						>
							<span>@{username}</span>
							<span>{label}</span>
							<span>Since {registered.getFullYear()}</span>
							{#if censored}<span
									>Class of <span class="inline-block h-[1em] w-[5.5cqw] bg-current align-middle"
									></span></span
								>{:else if graduationYear}<span>Class of {graduationYear}</span>{/if}
						</span>
						<span class="truncate text-[2.5cqw]"
							>{#if censored}<span class="inline-block h-[1em] w-[38cqw] bg-current align-middle"
								></span>{:else}{email}{/if}</span
						>
					</div>
				</div>

				<div
					class="-mx-[5cqw] -mb-[5cqw] bg-ph-black/[0.07] px-[5cqw] py-[1.4cqw] font-mono text-[2.14cqw] leading-[1.35] tracking-[0.18em]"
				>
					{#each mrz as line, i (i)}<div class="truncate">{line}</div>{/each}
				</div>
			</div>

			{#if !embedded}
				<!-- Back -->
				<div class={[face, 'rotate-y-180 gap-[2.5cqw]', theme.card]} aria-hidden="true">
					<div class="-mx-[5cqw] -mt-[0.7cqw] h-[7.85cqw] shrink-0 bg-ph-black"></div>

					<div class="flex items-stretch gap-[2.14cqw]">
						<div
							class="flex min-w-0 flex-1 flex-col justify-center bg-ph-cream px-[2.14cqw] py-[1.4cqw] text-ph-black"
						>
							<span class="ph-subheadline text-[1.6cqw]">Authorized signature</span>
							<span class="-rotate-2 truncate ph-headline text-[4.28cqw]">{name}</span>
						</div>
						<span class="grid w-[10cqw] shrink-0 place-items-center bg-ph-black/10">
							<Identicon seed={id} accent={theme.accent} class="size-[5.7cqw]" />
						</span>
					</div>

					<dl
						class="grid flex-1 grid-cols-2 content-start gap-x-[3.57cqw] gap-y-[1.4cqw] text-[2.5cqw] leading-[1.25]"
					>
						<div class="min-w-0">
							<dt class="ph-subheadline text-[1.96cqw]">Given names</dt>
							<dd class="break-words">{givenName || name}</dd>
						</div>
						{#if familyName}
							<div class="min-w-0">
								<dt class="ph-subheadline text-[1.96cqw]">Surname</dt>
								<dd class="break-words">{familyName}</dd>
							</div>
						{/if}
						<div class="min-w-0">
							<dt class="ph-subheadline text-[1.96cqw]">
								Passport ID<span class="normal-case">s</span>
							</dt>
							<dd class="font-mono font-semibold break-words">
								{passports.length ? passports.map((p) => `#${p}`).join('  ') : 'None yet'}
							</dd>
						</div>
						<div class="min-w-0">
							<dt class="ph-subheadline text-[1.96cqw]">Registered</dt>
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
								<dt class="ph-subheadline text-[1.96cqw]">Phone</dt>
								<dd class="font-mono break-words">{formatPhone(phone)}</dd>
							</div>
						{/if}
						<div class="min-w-0">
							<dt class="ph-subheadline text-[1.96cqw]">Linked</dt>
							<dd class="break-words">{linked.length ? linked.join(', ') : 'Nothing linked'}</dd>
						</div>
					</dl>

					<p class="flex items-center gap-[1.4cqw] font-mono text-[1.96cqw] uppercase">
						<Glider class="size-[2.5cqw]" />
						Property of Purdue Hackers. If found, return to purduehackers.com
					</p>
				</div>
			{/if}
		</button>
	</div>
</div>
