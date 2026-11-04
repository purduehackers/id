<script lang="ts">
	import Glider from './ph/Glider.svelte';
	import Icon from './ph/Icon.svelte';
	import Identicon from './Identicon.svelte';
	import { hash } from './pixel';
	import { ROLE_LABELS, isRole } from '$lib/roles';

	type Props = {
		id: string;
		name: string;
		username: string;
		email: string;
		role?: string | null;
		since: Date | string;
		passports: number[];
		linked: string[];
		addresses: number;
	};

	let { id, name, username, email, role, since, passports, linked, addresses }: Props = $props();

	const themes = {
		admin: { card: 'bg-ph-purple text-ph-cream', accent: 'var(--ph-yellow)' },
		organizer: { card: 'bg-ph-pink text-ph-black', accent: 'var(--ph-purple)' },
		alumni: { card: 'bg-ph-teal text-ph-black', accent: 'var(--ph-cream)' },
		member: { card: 'bg-ph-yellow text-ph-black', accent: 'var(--ph-purple)' }
	};
	const theme = $derived(themes[isRole(role) ? role : 'member']);
	const label = $derived(isRole(role) ? ROLE_LABELS[role] : 'Member');
	const serial = $derived(String(passports[0] ?? hash(id) % 10000).padStart(4, '0'));
	const issued = $derived(new Date(since));
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
			`${username.toUpperCase()}<<${serial}<${label.slice(0, 3).toUpperCase()}<${issued.getFullYear()}`
		)
	]);

	let card: HTMLDivElement;
	let tilt = $state({ x: 0, y: 0 });
	let flipped = $state(false);

	function move(event: PointerEvent) {
		if (event.pointerType !== 'mouse') return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const r = card.getBoundingClientRect();
		tilt = {
			x: ((event.clientY - r.top) / r.height - 0.5) * -8,
			y: ((event.clientX - r.left) / r.width - 0.5) * 10
		};
	}

	const face = 'col-start-1 row-start-1 flex flex-col p-5 backface-hidden sm:aspect-[1.586] sm:p-7';
</script>

<div class="w-full max-w-[560px] enter perspective-[1200px]" style="--i: 1">
	<div
		bind:this={card}
		onpointermove={move}
		onpointerleave={() => (tilt = { x: 0, y: 0 })}
		class="transition-transform duration-300 ease-out transform-3d"
		style="transform: rotateX({tilt.x}deg) rotateY({tilt.y}deg)"
		role="presentation"
	>
		<button
			type="button"
			onclick={() => (flipped = !flipped)}
			aria-pressed={flipped}
			aria-label="Purdue Hackers ID for {name}, @{username}, {label}. Flip the card"
			class="grid w-full cursor-pointer grid-cols-1 text-left transition-transform duration-500 ease-quint select-none transform-3d motion-reduce:transition-none"
			style="transform: rotateY({flipped ? 180 : 0}deg)"
		>
			<!-- Front -->
			<div class={[face, 'justify-between gap-6', theme.card]} aria-hidden="true">
				<div class="flex items-start justify-between gap-4">
					<div class="flex items-center gap-2">
						<Glider class="size-5" />
						<span class="ph-subheadline text-[11px] sm:text-[12px]">Purdue Hackers · Identity</span>
					</div>
					<span class="flex items-center gap-2 font-mono text-[12px] font-semibold sm:text-[13px]">
						Nº {serial}
						<Icon name="refresh" class="size-3.5" />
					</span>
				</div>

				<div class="flex items-end gap-4 sm:gap-6">
					<div class="grid size-20 shrink-0 place-items-center bg-ph-black/10 sm:size-28">
						<Identicon seed={id} accent={theme.accent} class="size-12 sm:size-16" />
					</div>
					<div class="flex min-w-0 flex-col gap-1.5 sm:gap-2">
						<span
							class={[
								'ph-headline break-words',
								longestWord > 10 ? 'text-2xl' : 'text-4xl',
								name.length > 16 ? 'sm:text-5xl' : 'sm:text-6xl'
							]}
						>
							{name}
						</span>
						<span
							class="flex flex-wrap gap-x-3 font-mono text-[12px] font-semibold uppercase sm:text-[13px]"
						>
							<span>@{username}</span>
							<span>{label}</span>
							<span>Since {issued.getFullYear()}</span>
						</span>
						<span class="truncate text-[13px] sm:text-[14px]">{email}</span>
					</div>
				</div>

				<div
					class="-mx-5 -mb-5 bg-ph-black/[0.07] px-5 py-2 font-mono text-[10px] leading-[1.35] tracking-[0.18em] sm:-mx-7 sm:-mb-7 sm:px-7 sm:text-[12px]"
				>
					{#each mrz as line, i (i)}<div class="truncate">{line}</div>{/each}
				</div>
			</div>

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
					class="grid flex-1 grid-cols-[auto_minmax(0,1fr)] content-start gap-x-5 gap-y-1.5 text-[13px] sm:text-[14px]"
				>
					<dt class="pt-0.5 ph-subheadline text-[11px]">Passports</dt>
					<dd class="font-mono font-semibold">
						{passports.length ? passports.map((p) => `#${p}`).join('  ') : 'None yet'}
					</dd>
					<dt class="pt-0.5 ph-subheadline text-[11px]">Linked</dt>
					<dd>{linked.length ? linked.join(', ') : 'Nothing linked'}</dd>
					<dt class="pt-0.5 ph-subheadline text-[11px]">Addresses</dt>
					<dd>{addresses} {addresses === 1 ? 'address' : 'addresses'}</dd>
					<dt class="pt-0.5 ph-subheadline text-[11px]">Issued</dt>
					<dd>
						{issued.toLocaleDateString(undefined, {
							year: 'numeric',
							month: 'long',
							day: 'numeric'
						})}
					</dd>
				</dl>

				<p class="flex items-center gap-2 font-mono text-[10px] uppercase sm:text-[11px]">
					<Glider class="size-3.5" />
					Property of Purdue Hackers. If found, return to purduehackers.com
				</p>
			</div>
		</button>
	</div>
</div>
