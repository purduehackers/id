<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';
	import { formatPhone } from '$lib/profile';
	import { ROLE_LABELS, isRole } from '$lib/roles';
	import Identicon from '$lib/components/Identicon.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Section from '$lib/components/Section.svelte';
	import { hash, swatch } from '$lib/components/pixel';
	import Badge from '$lib/components/ph/Badge.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import Icon from '$lib/components/ph/Icon.svelte';
	import type { IconName } from '$lib/components/ph/icons';
	import Input from '$lib/components/ph/Input.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';
	import Select from '$lib/components/ph/Select.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const TILES = [
		{ filter: null, label: 'Everyone', color: 'bg-ph-yellow', tilt: '-1deg' },
		{ filter: 'unverified', label: 'Unverified', color: 'bg-ph-teal', tilt: '1.5deg' },
		{ filter: 'banned', label: 'Banned', color: 'bg-ph-orange', tilt: '-1.5deg' }
	] as const;

	const CONNECTIONS: { id: string; label: string; icon: IconName; color: string }[] = [
		{ id: 'discord', label: 'Discord', icon: 'discord', color: 'bg-ph-periwinkle text-ph-black' },
		{ id: 'github', label: 'GitHub', icon: 'github', color: 'bg-foreground text-background' }
	];

	const ROLE_COLORS = { admin: 'purple', organizer: 'pink', alumni: 'teal' } as const;

	const listQuery = (filter: string | null) =>
		[data.query && `q=${encodeURIComponent(data.query)}`, filter && `filter=${filter}`]
			.filter(Boolean)
			.join('&');
	const action = (name: string) => {
		const query = listQuery(data.filter);
		return `?/${name}${query ? `&${query}` : ''}`;
	};
	const tileHref = (filter: string | null) => {
		const query = listQuery(filter);
		return `${resolve('/users')}${query ? `?${query}` : ''}`;
	};
	const stampTilt = (id: number) => `${(hash(String(id)) % 9) - 4}deg`;

	let managing = $derived(form && 'opened' in form ? (form.opened ?? null) : null);

	const when = (value: string | Date) => new Date(value).toLocaleDateString();
	const roleLabel = (role: string | null) => (isRole(role) ? ROLE_LABELS[role] : 'no role');

	function confirmRole(event: SubmitEvent & { currentTarget: HTMLFormElement }, username: string) {
		const role = new FormData(event.currentTarget).get('value');
		if (
			role === 'admin' &&
			!confirm(`Make @${username} an admin? They will be able to manage everyone.`)
		) {
			event.preventDefault();
		}
	}

	function confirmBan(event: SubmitEvent, username: string) {
		if (!confirm(`Ban @${username}? They will be signed out of ID and every app.`)) {
			event.preventDefault();
		}
	}
</script>

<svelte:head><title>Users - Purdue Hackers ID</title></svelte:head>

<PageTitle title="Users" />

{#if form && 'message' in form}
	<Notice>{form.message}</Notice>
{:else if form && 'notice' in form}
	<Notice tone="success">{form.notice}</Notice>
{/if}

<nav aria-label="Filter people" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
	{#each TILES as tile, i (tile.label)}
		{@const active = data.filter === tile.filter}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- tileHref() uses resolve() -->
		<a
			href={tileHref(tile.filter)}
			aria-current={active ? 'page' : undefined}
			class={[
				'flex enter flex-col gap-1.5 p-3 no-underline transition-transform duration-200 ease-out hover:rotate-0 motion-safe:hover:-translate-y-1',
				i === 0 && 'max-sm:col-span-2',
				active ? 'bg-foreground text-background' : [tile.color, 'text-ph-black']
			]}
			style="rotate: {active ? '0deg' : tile.tilt}; --i: {i}"
		>
			<span class="ph-subheadline text-[11px]">{tile.label}</span>
			<span class="ph-headline text-5xl">{data.counts[tile.filter ?? 'everyone']}</span>
		</a>
	{/each}
</nav>

<form method="get" class="flex items-end gap-3">
	{#if data.filter}<input type="hidden" name="filter" value={data.filter} />{/if}
	<span class="pb-3"><Icon name="search" class="size-5" /></span>
	<Input
		name="q"
		type="search"
		value={data.query}
		placeholder="Username, email or name"
		aria-label="Search users"
		class="min-w-0 flex-1"
	/>
	<Button type="submit">Search</Button>
</form>

{#if data.users.length === 0}
	<div class="grid h-56 place-items-center dither-field">
		<span class="bg-background px-3 py-1.5 ph-subheadline text-[12px]">Nobody here</span>
	</div>
{:else}
	<ul class="flex flex-col divide-y divide-foreground/15">
		{#each data.users as person, i (person.id)}
			{@const tile = swatch(person.id)}
			{@const open = managing === person.id}
			<li class="group flex enter flex-col gap-5 py-6" style="--i: {Math.min(i, 8)}">
				<div class="flex items-start gap-4">
					<span class="relative shrink-0">
						<span
							class={[
								'grid size-14 place-items-center transition-transform duration-200 ease-out motion-safe:group-hover:scale-105 motion-safe:group-hover:-rotate-6',
								tile.bg,
								tile.fg,
								person.banned && 'grayscale'
							]}
						>
							<Identicon seed={person.id} class="size-8" />
						</span>
						{#if person.banned}
							<span
								class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 bg-ph-orange px-1 font-mono text-[10px] font-bold text-ph-black uppercase"
							>
								Banned
							</span>
						{/if}
					</span>

					<div class="flex min-w-0 flex-1 flex-col gap-2.5">
						<div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
							<div class="flex min-w-0 flex-col gap-0.5">
								<span class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[17px] break-words">
									{person.name}
									{#if person.emailVerified}
										<Badge color="lime" class="-rotate-2">
											<Icon name="check" class="size-3!" />Verified
										</Badge>
									{:else}
										<Badge color="outline" class="rotate-1 border-dashed">
											<Icon name="question-circle" class="size-3!" />Unverified
										</Badge>
									{/if}
									{#if isRole(person.role)}
										<Badge color={ROLE_COLORS[person.role]}>{ROLE_LABELS[person.role]}</Badge>
									{/if}
									{#if person.id === data.me}<Badge color="yellow">That's you!</Badge>{/if}
								</span>
								<span class="font-mono text-[13px] break-all">
									@{person.username}
									{#if person.graduationYear}
										· Class of {person.graduationYear}
									{/if}
									{#if person.github}
										· gh/{person.github}
									{/if}
								</span>
								<span class="text-[14px] break-all">
									{person.email}{#if person.phone}
										<span class="font-mono text-[13px]"> · {formatPhone(person.phone)}</span>
									{/if}
								</span>
							</div>
							<Button
								variant="ghost"
								size="sm"
								iconEnd="chevron-down"
								aria-expanded={open}
								aria-controls="manage-{person.id}"
								class={['-ml-3 sm:ml-0', open && '[&_svg]:rotate-180']}
								onclick={() => (managing = open ? null : person.id)}
							>
								Manage
							</Button>
						</div>

						{#if person.banned && person.banReason}
							<span class="text-[14px]">Reason: {person.banReason}</span>
						{/if}

						<div class="flex flex-wrap items-center gap-1.5">
							{#each CONNECTIONS as connection (connection.id)}
								{@const linked = person.connections.includes(connection.id)}
								<span
									role="img"
									aria-label="{connection.label} {linked ? 'connected' : 'not connected'}"
									title="{connection.label} {linked ? 'connected' : 'not connected'}"
									class={[
										'grid size-7 place-items-center transition-transform duration-150 motion-safe:hover:-translate-y-1 motion-safe:hover:rotate-6',
										linked
											? connection.color
											: 'border border-dashed border-foreground/30 text-foreground/30'
									]}
								>
									<Icon name={connection.icon} class="size-4" />
								</span>
							{/each}
							{#if person.passkeys}
								<span
									title="{person.passkeys} {person.passkeys === 1 ? 'passkey' : 'passkeys'}"
									class="flex h-7 items-center gap-1 bg-ph-pink px-2 font-mono text-[12px] font-semibold text-ph-black transition-transform duration-150 motion-safe:hover:-translate-y-1 motion-safe:hover:-rotate-6"
								>
									<Icon name="lock" class="size-3.5" />
									×{person.passkeys}
									<span class="sr-only">{person.passkeys === 1 ? 'passkey' : 'passkeys'}</span>
								</span>
							{/if}
							{#each person.passports as passport (passport.id)}
								<span
									title="Passport {passport.id}{passport.activated ? '' : ' (not activated)'}"
									class={[
										'flex h-7 items-center gap-1 px-2 font-mono text-[12px] font-semibold',
										passport.activated
											? 'bg-ph-yellow text-ph-black'
											: 'border border-dashed border-foreground/50'
									]}
									style="rotate: {stampTilt(passport.id)}"
								>
									<Icon name="credit-card" class="size-3.5" />#{passport.id}
								</span>
							{/each}
						</div>

						<span class="font-mono text-[12px]">Joined {when(person.createdAt)}</span>
					</div>
				</div>

				{#if open}
					<div id="manage-{person.id}" class="flex enter flex-col gap-6 bg-card p-5" style="--i: 0">
						<div class="flex flex-col gap-2">
							<h3 class="ph-subheadline text-[12px]">Passports</h3>
							<div class="flex flex-wrap items-center gap-2">
								{#each person.passports as passport (passport.id)}
									<form method="post" action={action('passport')}>
										<input type="hidden" name="passport" value={passport.id} />
										<input type="hidden" name="from" value={person.id} />
										<button
											class="group/stamp flex h-8 items-center gap-1.5 bg-foreground px-2.5 font-mono text-[13px] font-semibold text-background transition-colors hover:bg-ph-orange hover:text-ph-black"
											aria-label="Take passport {passport.id} back"
										>
											<Icon name="credit-card" class="group-hover/stamp:hidden" />
											<Icon name="times" class="hidden group-hover/stamp:block" />
											#{passport.id}
										</button>
									</form>
								{/each}
								<form method="post" action={action('passport')} class="flex items-center gap-2">
									<input type="hidden" name="userId" value={person.id} />
									<Input
										name="passport"
										size="sm"
										inputmode="numeric"
										required
										placeholder="+ Passport #"
										aria-label="Passport number for @{person.username}"
										class="w-32! font-mono"
									/>
									<Button type="submit" variant="ghost" size="sm">Give</Button>
								</form>
							</div>
						</div>

						{#if person.id !== data.me}
							<div class="flex flex-col gap-2">
								<h3 class="ph-subheadline text-[12px]">Role and ban</h3>
								<div class="flex flex-wrap items-center gap-x-6 gap-y-3">
									<form
										method="post"
										action={action('role')}
										class="flex items-center gap-2"
										onsubmit={(event) => confirmRole(event, person.username)}
									>
										<input type="hidden" name="userId" value={person.id} />
										<Select
											name="value"
											size="sm"
											aria-label="Role for @{person.username}"
											class="w-36"
										>
											<option value="" selected={!isRole(person.role)}>No role</option>
											{#each data.roles as { role, label } (role)}
												<option value={role} selected={role === person.role}>{label}</option>
											{/each}
										</Select>
										<Button type="submit" variant="ghost" size="sm">Set role</Button>
									</form>

									{#if person.banned}
										<form method="post" action={action('unban')}>
											<input type="hidden" name="userId" value={person.id} />
											<Button type="submit" variant="ghost" size="sm">Unban</Button>
										</form>
									{:else}
										<form
											method="post"
											action={action('ban')}
											class="flex flex-wrap items-center gap-2"
											onsubmit={(event) => confirmBan(event, person.username)}
										>
											<input type="hidden" name="userId" value={person.id} />
											<Input
												name="value"
												size="sm"
												placeholder="Ban reason (optional)"
												aria-label="Ban reason for @{person.username}"
												class="w-48!"
											/>
											<Button
												type="submit"
												variant="ghost"
												size="sm"
												class="hover:bg-ph-orange hover:text-ph-black"
											>
												Ban
											</Button>
										</form>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>
	{#if data.counts[data.filter ?? 'everyone'] > data.users.length}
		<p class="font-mono text-[13px]">
			Showing the newest {data.users.length} of {data.counts[data.filter ?? 'everyone']}. Search to
			find the rest.
		</p>
	{/if}
{/if}

<Section title="Log">
	{#if data.events.length === 0}
		<p>No role changes, bans or app access changes yet.</p>
	{:else}
		<ol class="flex flex-col font-mono text-[13px]">
			{#each data.events as event (event.id)}
				<li class="grid gap-x-6 gap-y-0.5 py-1.5 sm:grid-cols-[150px_1fr]">
					<time>{new Date(event.createdAt).toLocaleString()}</time>
					<span class="font-sans text-[15px]">
						<span class="font-mono font-semibold">@{event.actorUsername}</span>
						{#if event.action === 'role'}
							changed @{event.targetUsername} from {roleLabel(event.from)} to {roleLabel(event.to)}
						{:else if event.action === 'ban'}
							banned @{event.targetUsername}{event.to ? `: ${event.to}` : ''}
						{:else if event.action === 'passport'}
							{#if event.targetUsername === 'nobody'}
								took passport #{event.to} from @{event.from}
							{:else if event.actorUsername === event.targetUsername}
								{event.from
									? `took passport #${event.to} back from @${event.from}`
									: `claimed passport #${event.to}`}
							{:else}
								gave passport #{event.to} to @{event.targetUsername}{event.from
									? ` (was @${event.from})`
									: ''}
							{/if}
						{:else if event.action === 'access'}
							{event.to
								? `gave ${event.appName} ${event.to}`
								: `revoked access for ${event.appName}`}
							(by @{event.targetUsername})
						{:else}
							unbanned @{event.targetUsername}
						{/if}
					</span>
				</li>
			{/each}
		</ol>
	{/if}
</Section>
