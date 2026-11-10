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
		identiconCells,
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

	const face = $derived([
		'col-start-1 row-start-1 flex flex-col backface-hidden',
		embedded
			? 'size-full min-h-0 min-w-0 overflow-hidden p-[5cqw] [overflow-wrap:anywhere]'
			: 'p-5 sm:aspect-[1.586] sm:p-7'
	]);
</script>

<div
	class={[
		'w-full max-w-[560px] perspective-[1200px]',
		embedded && '@container relative aspect-[85.6/53.98] min-w-0'
	]}
	class:enter={!embedded}
	style="--i: 1"
>
	<div
		bind:this={card}
		onpointermove={move}
		onpointerleave={() => (tilt = { x: 0, y: 0 })}
		class={[
			'transition-transform duration-300 ease-out transform-3d',
			embedded && 'absolute inset-0'
		]}
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
				'grid w-full text-left transition-transform duration-500 ease-quint select-none transform-3d motion-reduce:transition-none',
				embedded ? 'h-full cursor-default grid-cols-[minmax(0,1fr)]' : 'cursor-pointer grid-cols-1'
			]}
			style="transform: rotateY({flipped ? 180 : 0}deg)"
		>
			<!-- Front -->
			<div
				class={[face, 'justify-between', embedded ? 'gap-0' : 'gap-6', theme.card]}
				aria-hidden="true"
			>
				<div
					class={[
						'flex items-start justify-between',
						embedded ? 'gap-[2.8cqw] text-[2.14cqw] leading-[1.2]' : 'gap-4'
					]}
				>
					<div class={['flex items-center', embedded ? 'gap-[1.4cqw]' : 'gap-2']}>
						<Glider class={embedded ? 'size-[3.57cqw]' : 'size-5'} />
						<span
							class={[
								'ph-subheadline',
								embedded ? 'text-[length:inherit]' : 'text-[11px] sm:text-[12px]'
							]}>Purdue Hackers · Identity</span
						>
					</div>
					<span
						class={[
							'flex items-center font-mono font-semibold',
							embedded
								? 'gap-[1.4cqw] text-[2.32cqw] whitespace-nowrap'
								: 'gap-2 text-[12px] sm:text-[13px]'
						]}
					>
						Nº {serial}
						{#if !embedded}<Icon name="refresh" class="size-3.5" />{/if}
					</span>
				</div>

				<div class={['flex items-end', embedded ? 'gap-[4.28cqw]' : 'gap-4 sm:gap-6']}>
					<div
						class={[
							'grid shrink-0 place-items-center overflow-hidden bg-ph-black/10',
							embedded ? 'size-[20cqw]' : 'size-20 sm:size-28'
						]}
					>
						{#if image}
							<img src={image} alt="" class="size-full object-cover" />
						{:else}
							<Identicon
								seed={id}
								cells={identiconCells}
								accent={theme.accent}
								class={embedded ? 'size-[11.42cqw]' : 'size-12 sm:size-16'}
							/>
						{/if}
					</div>
					<div class={['flex min-w-0 flex-col', embedded ? 'gap-[1.4cqw]' : 'gap-1.5 sm:gap-2']}>
						<span
							class={[
								'ph-headline break-words',
								embedded
									? [
											'line-clamp-2 leading-none [overflow-wrap:anywhere]',
											longestWord > 10
												? 'text-[7.3cqw]'
												: name.length > 12
													? 'text-[8.57cqw]'
													: 'text-[10.7cqw]'
										]
									: [
											longestWord > 10 ? 'text-2xl' : 'text-4xl',
											name.length > 16 ? 'sm:text-5xl' : 'sm:text-6xl'
										]
							]}
						>
							{name}
						</span>
						<span
							class={[
								'flex flex-wrap font-mono font-semibold uppercase',
								embedded
									? 'gap-x-[2.14cqw] gap-y-0 text-[2.32cqw] leading-[1.3]'
									: 'gap-x-3 text-[12px] sm:text-[13px]'
							]}
						>
							<span>@{username}</span>
							<span>{label}</span>
							<span>Since {registered.getFullYear()}</span>
							{#if censored}<span
									>Class of <span class="inline-block h-[1em] w-[5.5cqw] bg-current align-middle"
									></span></span
								>{:else if graduationYear}<span>Class of {graduationYear}</span>{/if}
						</span>
						<span class={['truncate', embedded ? 'text-[2.5cqw]' : 'text-[13px] sm:text-[14px]']}
							>{#if censored}<span class="inline-block h-[1em] w-[38cqw] bg-current align-middle"
								></span>{:else}{email}{/if}</span
						>
					</div>
				</div>

				<div
					class={[
						'bg-ph-black/[0.07] font-mono leading-[1.35] tracking-[0.18em]',
						embedded
							? '-mx-[5cqw] -mb-[5cqw] px-[5cqw] py-[1.4cqw] text-[2.14cqw]'
							: '-mx-5 -mb-5 px-5 py-2 text-[10px] sm:-mx-7 sm:-mb-7 sm:px-7 sm:text-[12px]'
					]}
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
							<Identicon seed={id} cells={identiconCells} accent={theme.accent} class="size-8" />
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
