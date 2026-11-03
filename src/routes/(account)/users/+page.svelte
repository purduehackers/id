<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { ROLE_LABELS, isRole } from '$lib/roles';
	import Identicon from '$lib/components/Identicon.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Section from '$lib/components/Section.svelte';
	import { swatch } from '$lib/components/pixel';
	import Badge from '$lib/components/ph/Badge.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import Icon from '$lib/components/ph/Icon.svelte';
	import Input from '$lib/components/ph/Input.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';
	import Select from '$lib/components/ph/Select.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

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

<form method="get" class="flex items-end gap-3">
	<span class="pb-3"><Icon name="search" class="size-5" /></span>
	<Input
		name="q"
		type="search"
		value={data.query}
		placeholder="Username, email or name"
		aria-label="Search users"
		class="flex-1"
	/>
	<Button type="submit">Search</Button>
</form>

{#if data.users.length === 0}
	<p>Nobody matches that.</p>
{:else}
	<ul class="flex flex-col gap-4">
		{#each data.users as person, i (person.id)}
			{@const tile = swatch(person.id)}
			<li class="flex enter flex-col gap-5 bg-card p-5 sm:p-6" style="--i: {Math.min(i, 8)}">
				<div class="flex items-start gap-4">
					<span class={['grid size-12 shrink-0 place-items-center', tile.bg, tile.fg]}>
						<Identicon seed={person.id} class="size-7" />
					</span>
					<div class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[17px]">
							{person.name}
							{#if isRole(person.role)}<Badge color="purple">{ROLE_LABELS[person.role]}</Badge>{/if}
							{#if person.banned}<Badge color="orange">Banned</Badge>{/if}
						</span>
						<span class="font-mono text-[13px]">
							@{person.username} · joined {when(person.createdAt)}
						</span>
						<span class="text-[14px] break-all">{person.email}</span>
						{#if person.banned && person.banReason}
							<span class="text-[14px]">Reason: {person.banReason}</span>
						{/if}
					</div>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					{#each person.passports as id (id)}
						<form method="post" action="?/passport">
							<input type="hidden" name="passport" value={id} />
							<button
								class="group flex h-8 items-center gap-1.5 bg-foreground px-2.5 font-mono text-[13px] font-semibold text-background transition-colors hover:bg-ph-orange hover:text-ph-black"
								aria-label="Take passport {id} back"
							>
								<Icon name="credit-card" class="group-hover:hidden" />
								<Icon name="times" class="hidden group-hover:block" />
								#{id}
							</button>
						</form>
					{/each}
					<form method="post" action="?/passport" class="flex items-end gap-2">
						<input type="hidden" name="userId" value={person.id} />
						<Input
							name="passport"
							size="sm"
							inputmode="numeric"
							required
							placeholder="+ Passport #"
							aria-label="Passport number for @{person.username}"
							class="w-32 font-mono"
						/>
						<Button type="submit" variant="ghost" size="sm">Give</Button>
					</form>
				</div>

				{#if person.id !== data.me}
					<div class="flex flex-wrap items-end gap-x-6 gap-y-3">
						<form
							method="post"
							action="?/role"
							class="flex items-end gap-2"
							onsubmit={(event) => confirmRole(event, person.username)}
						>
							<input type="hidden" name="userId" value={person.id} />
							<Select name="value" size="sm" aria-label="Role for @{person.username}" class="w-36">
								<option value="" selected={!isRole(person.role)}>No role</option>
								{#each data.roles as { role, label } (role)}
									<option value={role} selected={role === person.role}>{label}</option>
								{/each}
							</Select>
							<Button type="submit" variant="ghost" size="sm">Set role</Button>
						</form>

						{#if person.banned}
							<form method="post" action="?/unban">
								<input type="hidden" name="userId" value={person.id} />
								<Button type="submit" variant="ghost" size="sm">Unban</Button>
							</form>
						{:else}
							<form
								method="post"
								action="?/ban"
								class="flex items-end gap-2"
								onsubmit={(event) => confirmBan(event, person.username)}
							>
								<input type="hidden" name="userId" value={person.id} />
								<Input
									name="value"
									size="sm"
									placeholder="Ban reason (optional)"
									aria-label="Ban reason for @{person.username}"
									class="w-48"
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
				{/if}
			</li>
		{/each}
	</ul>
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
