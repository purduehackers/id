<!--
	The account, as the thing it is: a Purdue Hackers ID card. Colour follows the role,
	the portrait is a pixel identicon, and the bottom carries a passport-style MRZ.
	Tilts toward the pointer; holds still under reduced motion.
-->
<script lang="ts">
	import Glider from './ph/Glider.svelte';
	import Identicon from './Identicon.svelte';
	import { hash } from './pixel';
	import { ROLE_LABELS, isRole } from '$lib/roles';

	type Props = {
		name: string;
		username: string;
		email: string;
		role?: string | null;
		since: Date | string;
		number?: number;
	};

	let { name, username, email, role, since, number }: Props = $props();

	const themes = {
		admin: 'bg-ph-purple text-ph-cream',
		organizer: 'bg-ph-pink text-ph-black',
		alumni: 'bg-ph-teal text-ph-black',
		member: 'bg-ph-yellow text-ph-black'
	};
	const theme = $derived(themes[isRole(role) ? role : 'member']);
	const label = $derived(isRole(role) ? ROLE_LABELS[role] : 'Member');
	const serial = $derived(String(number ?? hash(username) % 10000).padStart(4, '0'));
	const year = $derived(new Date(since).getFullYear());

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
		fill(`${username.toUpperCase()}<<${serial}<${label.slice(0, 3).toUpperCase()}<${year}`)
	]);

	let card: HTMLDivElement;
	let tilt = $state({ x: 0, y: 0 });

	function move(event: PointerEvent) {
		if (event.pointerType !== 'mouse') return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const r = card.getBoundingClientRect();
		tilt = {
			x: ((event.clientY - r.top) / r.height - 0.5) * -8,
			y: ((event.clientX - r.left) / r.width - 0.5) * 10
		};
	}
</script>

<div class="enter perspective-[1200px]" style="--i: 1">
	<div
		bind:this={card}
		role="img"
		aria-label="Purdue Hackers ID for {name}, @{username}, {label}"
		onpointermove={move}
		onpointerleave={() => (tilt = { x: 0, y: 0 })}
		class={[
			// The aspect ratio is a minimum: without overflow clipping the card grows to fit long names.
			'relative flex min-h-60 w-full max-w-[560px] flex-col justify-between gap-6 p-5 transition-transform duration-300 ease-out select-none sm:aspect-[1.586] sm:min-h-auto sm:p-7',
			theme
		]}
		style="transform: rotateX({tilt.x}deg) rotateY({tilt.y}deg)"
	>
		<div class="flex items-start justify-between gap-4">
			<div class="flex items-center gap-2">
				<Glider class="size-5" />
				<span class="ph-subheadline text-[11px] sm:text-[12px]">Purdue Hackers · Identity</span>
			</div>
			<span class="font-mono text-[12px] font-semibold sm:text-[13px]">Nº {serial}</span>
		</div>

		<div class="flex items-end gap-4 sm:gap-6">
			<div class="grid size-20 shrink-0 place-items-center bg-ph-black/10 sm:size-28">
				<Identicon seed={username} class="size-12 sm:size-16" />
			</div>
			<div class="flex min-w-0 flex-col gap-1.5 sm:gap-2">
				<span
					class={[
						'ph-headline text-4xl break-words',
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
					<span>Since {year}</span>
				</span>
				<span class="truncate text-[13px] sm:text-[14px]">{email}</span>
			</div>
		</div>

		<div
			class="-mx-5 -mb-5 bg-ph-black/[0.07] px-5 py-2 font-mono text-[10px] leading-[1.35] tracking-[0.18em] sm:-mx-7 sm:-mb-7 sm:px-7 sm:text-[12px]"
			aria-hidden="true"
		>
			{#each mrz as line, i (i)}<div class="truncate">{line}</div>{/each}
		</div>
	</div>
</div>
