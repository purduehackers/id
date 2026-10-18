<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { ROLE_LABELS, isRole } from '$lib/roles';
	import Section from '$lib/components/Section.svelte';
	import Badge from '$lib/components/ph/Badge.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import Input from '$lib/components/ph/Input.svelte';
	import LinkButton from '$lib/components/ph/LinkButton.svelte';
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

{#if form && 'message' in form}
	<Notice>{form.message}</Notice>
{:else if form && 'notice' in form}
	<Notice tone="success">{form.notice}</Notice>
{/if}

<Section title="Users">
	<form method="get" class="flex gap-2">
		<Input
			name="q"
			type="search"
			value={data.query}
			placeholder="Username, email or name"
			aria-label="Search users"
			class="flex-1"
		/>
		<Button type="submit" variant="outline" icon="search">Search</Button>
	</form>

	{#if data.users.length === 0}
		<p>Nobody matches that.</p>
	{:else}
		<ul class="border-t border-border">
			{#each data.users as person (person.id)}
				<li class="flex flex-col gap-3 border-b border-border py-4">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<span class="flex flex-wrap items-center gap-x-3 gap-y-1">
							<span class="text-lg font-medium">{person.name}</span>
							<span class="font-mono text-[13px] font-semibold">@{person.username}</span>
							{#if isRole(person.role)}<Badge color="purple">{ROLE_LABELS[person.role]}</Badge>{/if}
							{#if person.banned}<Badge color="orange">Banned</Badge>{/if}
						</span>
						<span class="font-mono text-[13px]">joined {when(person.createdAt)}</span>
					</div>
					<div class="flex flex-col gap-0.5">
						<p class="break-all">{person.email}</p>
						{#if person.banned && person.banReason}
							<p>Reason: {person.banReason}</p>
						{/if}
					</div>

					<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
						<span class="ph-subheadline text-[12px]">Passports</span>
						{#each person.passports as id (id)}
							<form method="post" action="?/passport" class="flex items-center gap-1.5">
								<input type="hidden" name="passport" value={id} />
								<span class="font-mono font-semibold">#{id}</span>
								<LinkButton aria-label="Take passport {id} back" class="text-[13px]">
									remove
								</LinkButton>
							</form>
						{:else}
							<span class="font-mono text-[13px]">none</span>
						{/each}
						<form method="post" action="?/passport" class="flex gap-1.5">
							<input type="hidden" name="userId" value={person.id} />
							<Input
								name="passport"
								inputmode="numeric"
								required
								placeholder="Passport #"
								aria-label="Passport number for @{person.username}"
								class="h-8 w-28 font-mono text-[13px]"
							/>
							<Button type="submit" variant="outline" size="sm">Give</Button>
						</form>
					</div>

					{#if person.id !== data.me}
						<div class="flex flex-wrap items-center gap-2">
							<form
								method="post"
								action="?/role"
								class="flex gap-2"
								onsubmit={(event) => confirmRole(event, person.username)}
							>
								<input type="hidden" name="userId" value={person.id} />
								<Select name="value" aria-label="Role for @{person.username}">
									<option value="" selected={!isRole(person.role)}>No role</option>
									{#each data.roles as { role, label } (role)}
										<option value={role} selected={role === person.role}>{label}</option>
									{/each}
								</Select>
								<Button type="submit" variant="outline">Save</Button>
							</form>

							{#if person.banned}
								<form method="post" action="?/unban">
									<input type="hidden" name="userId" value={person.id} />
									<Button type="submit" variant="outline">Unban</Button>
								</form>
							{:else}
								<form
									method="post"
									action="?/ban"
									class="flex gap-2"
									onsubmit={(event) => confirmBan(event, person.username)}
								>
									<input type="hidden" name="userId" value={person.id} />
									<Input
										name="value"
										placeholder="Reason (optional)"
										aria-label="Ban reason for @{person.username}"
										class="w-48"
									/>
									<Button
										type="submit"
										variant="outline"
										class="hover:border-ph-orange hover:bg-ph-orange hover:text-ph-black"
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
</Section>

<Section title="Recent changes">
	{#if data.events.length === 0}
		<p>No role changes, bans or app access changes yet.</p>
	{:else}
		<ul class="border-t border-border">
			{#each data.events as event (event.id)}
				<li
					class="flex flex-col justify-between gap-x-4 gap-y-0.5 border-b border-border py-2.5 sm:flex-row sm:items-baseline"
				>
					<span>
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
					<span class="shrink-0 font-mono text-[13px]">
						{new Date(event.createdAt).toLocaleString()}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</Section>
