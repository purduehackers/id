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
	const registered = $derived(new Date(since));
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
			`${username.toUpperCase()}<<${serial}<${label.slice(0, 3).toUpperCase()}<${registered.getFullYear()}`
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

	const face = 'id-face col-start-1 row-start-1 flex flex-col backface-hidden';
</script>

<div class="id-card" class:enter={!embedded} style="--i: 1">
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
			class:readonly-card={embedded}
			onclick={() => {
				if (!embedded) flipped = !flipped;
			}}
			aria-pressed={embedded ? undefined : flipped}
			aria-label={`Purdue Hackers ID for ${name}, @${username}, ${label}${embedded ? '' : '. Flip the card'}`}
			class="id-flip grid w-full cursor-pointer grid-cols-1 text-left transition-transform duration-500 ease-quint select-none transform-3d motion-reduce:transition-none"
			style="transform: rotateY({flipped ? 180 : 0}deg)"
		>
			<div class={[face, 'id-front justify-between', theme.card]} aria-hidden="true">
				<div class="id-heading flex items-start justify-between">
					<div class="id-brand flex items-center">
						<Glider class="id-brand-logo" /><span class="ph-subheadline"
							>Purdue Hackers · Identity</span
						>
					</div>
					<span class="id-serial flex items-center font-mono font-semibold"
						>Nº {serial}{#if !embedded}<Icon name="refresh" class="id-refresh" />{/if}</span
					>
				</div>
				<div class="id-person flex items-end">
					<div class="id-picture grid shrink-0 place-items-center overflow-hidden bg-ph-black/10">
						{#if image}<img src={image} alt="" class="size-full object-cover" />{:else}<Identicon
								seed={id}
								accent={theme.accent}
								class="id-identicon"
							/>{/if}
					</div>
					<div class="id-details flex min-w-0 flex-col">
						<span
							class="id-name ph-headline"
							class:long-name={name.length > 12}
							class:long-word={longestWord > 10}>{name}</span
						>
						<span class="id-meta flex flex-wrap font-mono font-semibold uppercase"
							><span>@{username}</span><span>{label}</span><span
								>Since {registered.getFullYear()}</span
							>{#if graduationYear}<span>Class of {graduationYear}</span>{/if}</span
						>
						<span class="id-email truncate">{email}</span>
					</div>
				</div>
				<div class="id-mrz bg-ph-black/[0.07] font-mono">
					{#each mrz as line, i (i)}<div class="truncate">{line}</div>{/each}
				</div>
			</div>
			<div class={[face, 'id-back rotate-y-180', theme.card]} aria-hidden="true">
				<div class="id-stripe shrink-0 bg-ph-black"></div>
				<div class="id-signature flex items-stretch">
					<div
						class="id-signature-box flex min-w-0 flex-1 flex-col justify-center bg-ph-cream text-ph-black"
					>
						<span class="id-signature-label ph-subheadline">Authorized signature</span><span
							class="id-signature-name -rotate-2 truncate ph-headline">{name}</span
						>
					</div>
					<span class="id-seal grid shrink-0 place-items-center bg-ph-black/10"
						><Identicon seed={id} accent={theme.accent} class="id-seal-icon" /></span
					>
				</div>
				<dl class="id-data grid flex-1 grid-cols-2 content-start">
					<div class="min-w-0">
						<dt class="ph-subheadline">Given names</dt>
						<dd>{givenName || name}</dd>
					</div>
					{#if familyName}<div class="min-w-0">
							<dt class="ph-subheadline">Surname</dt>
							<dd>{familyName}</dd>
						</div>{/if}
					<div class="min-w-0">
						<dt class="ph-subheadline">Passport ID<span class="normal-case">s</span></dt>
						<dd class="font-mono font-semibold">
							{passports.length ? passports.map((p) => `#${p}`).join('  ') : 'None yet'}
						</dd>
					</div>
					<div class="min-w-0">
						<dt class="ph-subheadline">Registered</dt>
						<dd>
							{registered.toLocaleDateString(undefined, {
								year: 'numeric',
								month: 'long',
								day: 'numeric'
							})}
						</dd>
					</div>
					{#if phone}<div class="min-w-0">
							<dt class="ph-subheadline">Phone</dt>
							<dd class="font-mono">{formatPhone(phone)}</dd>
						</div>{/if}
					<div class="min-w-0">
						<dt class="ph-subheadline">Linked</dt>
						<dd>{linked.length ? linked.join(', ') : 'Nothing linked'}</dd>
					</div>
				</dl>
				<p class="id-property flex items-center font-mono uppercase">
					<Glider class="id-property-icon" />Property of Purdue Hackers. If found, return to
					purduehackers.com
				</p>
			</div>
		</button>
	</div>
</div>

<style>
	.id-flip.readonly-card {
		cursor: default;
	}
	.id-card {
		position: relative;
		width: 100%;
		max-width: 560px;
		min-width: 0;
		aspect-ratio: 85.6 / 53.98;
		container-type: inline-size;
		perspective: 1200px;
	}
	.id-tilt {
		position: absolute;
		inset: 0;
	}
	.id-flip {
		height: 100%;
		grid-template-columns: minmax(0, 1fr);
	}
	.id-face {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		padding: 5cqw;
		overflow: hidden;
		overflow-wrap: anywhere;
	}
	.id-heading {
		gap: 2.8cqw;
		font-size: 2.14cqw;
		line-height: 1.2;
	}
	.id-brand {
		gap: 1.4cqw;
	}
	.id-brand :global(.id-brand-logo) {
		width: 3.57cqw;
		height: 3.57cqw;
	}
	.id-serial {
		gap: 1.4cqw;
		font-size: 2.32cqw;
		white-space: nowrap;
	}
	.id-serial :global(.id-refresh) {
		width: 2.5cqw;
		height: 2.5cqw;
	}
	.id-person {
		gap: 4.28cqw;
	}
	.id-picture {
		width: 20cqw;
		height: 20cqw;
	}
	.id-picture :global(.id-identicon) {
		width: 11.42cqw;
		height: 11.42cqw;
	}
	.id-details {
		gap: 1.4cqw;
	}
	.id-name {
		font-size: 10.7cqw;
		line-height: 1;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		overflow-wrap: anywhere;
	}
	.id-name.long-name {
		font-size: 8.57cqw;
	}
	.id-name.long-word {
		font-size: 4.28cqw;
	}
	.id-meta {
		gap: 0 2.14cqw;
		font-size: 2.32cqw;
		line-height: 1.3;
	}
	.id-email {
		font-size: 2.5cqw;
	}
	.id-mrz {
		margin: 0 -5cqw -5cqw;
		padding: 1.4cqw 5cqw;
		font-size: 2.14cqw;
		line-height: 1.35;
		letter-spacing: 0.18em;
	}
	.id-back {
		gap: 2.5cqw;
	}
	.id-stripe {
		margin: -0.7cqw -5cqw 0;
		height: 7.85cqw;
	}
	.id-signature {
		gap: 2.14cqw;
	}
	.id-signature-box {
		padding: 1.4cqw 2.14cqw;
	}
	.id-signature-label {
		font-size: 1.6cqw;
	}
	.id-signature-name {
		font-size: 4.28cqw;
	}
	.id-seal {
		width: 10cqw;
	}
	.id-seal :global(.id-seal-icon) {
		width: 5.7cqw;
		height: 5.7cqw;
	}
	.id-data {
		gap: 1.4cqw 3.57cqw;
		font-size: 2.5cqw;
		line-height: 1.25;
	}
	.id-data dt {
		font-size: 1.96cqw;
	}
	.id-data dd {
		overflow-wrap: anywhere;
	}
	.id-property {
		gap: 1.4cqw;
		font-size: 1.96cqw;
	}
	.id-property :global(.id-property-icon) {
		width: 2.5cqw;
		height: 2.5cqw;
	}
</style>
