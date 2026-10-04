<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { ROLE_LABELS, isRole } from '$lib/roles';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const when = (value: string | Date) => new Date(value).toLocaleDateString();
	const roleLabel = (role: string | null) => (isRole(role) ? ROLE_LABELS[role] : role);

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
	<p class="mt-4 text-red-700">{form.message}</p>
{:else if form && 'notice' in form}
	<p class="mt-4 text-green-700">{form.notice}</p>
{/if}

<h2 class="mt-8 text-lg">Users</h2>

<form method="get" class="mt-2 flex gap-2">
	<input
		name="q"
		value={data.query}
		placeholder="Username, email or name"
		class="block w-full border border-gray-400 px-2 py-1 font-sans"
	/>
	<button class="border border-gray-900 px-3 py-1">Search</button>
</form>

{#if data.users.length === 0}
	<p class="mt-4 text-gray-600">Nobody matches that.</p>
{:else}
	<ul class="mt-2">
		{#each data.users as person (person.id)}
			<li class="border-b border-gray-200 py-3">
				<div class="flex items-baseline justify-between gap-4">
					<span>
						{person.name}
						<span class="text-gray-500">@{person.username}</span>
						{#if person.banned}<span class="text-red-700"> banned</span>{/if}
					</span>
					<span class="text-sm text-gray-500">joined {when(person.createdAt)}</span>
				</div>
				<p class="text-sm text-gray-600">{person.email}</p>
				{#if person.banned && person.banReason}
					<p class="text-sm text-gray-600">Reason: {person.banReason}</p>
				{/if}

				{#if person.id !== data.me}
					<div class="mt-2 flex flex-wrap items-center gap-2">
						<form
							method="post"
							action="?/role"
							class="flex gap-2"
							onsubmit={(event) => confirmRole(event, person.username)}
						>
							<input type="hidden" name="userId" value={person.id} />
							<select name="value" class="border border-gray-400 px-2 py-1 font-sans">
								{#each data.roles as { role, label } (role)}
									<option value={role} selected={role === person.role}>{label}</option>
								{/each}
							</select>
							<button class="border border-gray-900 px-3 py-1">Save</button>
						</form>

						{#if person.banned}
							<form method="post" action="?/unban">
								<input type="hidden" name="userId" value={person.id} />
								<button class="border border-gray-900 px-3 py-1">Unban</button>
							</form>
						{:else}
							<form
								method="post"
								action="?/ban"
								class="flex gap-2"
								onsubmit={(event) => confirmBan(event, person.username)}
							>
								<input type="hidden" name="userId" value={person.id} />
								<input
									name="value"
									placeholder="Reason (optional)"
									class="border border-gray-400 px-2 py-1 font-sans"
								/>
								<button class="border border-red-700 px-3 py-1 text-red-700">Ban</button>
							</form>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<h2 class="mt-12 text-lg">Recent changes</h2>

{#if data.events.length === 0}
	<p class="mt-2 text-gray-600">No role changes or bans yet.</p>
{:else}
	<ul class="mt-2 text-sm">
		{#each data.events as event (event.id)}
			<li class="flex items-baseline justify-between gap-4 border-b border-gray-200 py-2">
				<span>
					<span class="text-gray-900">@{event.actorUsername}</span>
					{#if event.action === 'role'}
						changed @{event.targetUsername} from {roleLabel(event.from)} to {roleLabel(event.to)}
					{:else if event.action === 'ban'}
						banned @{event.targetUsername}{event.to ? `: ${event.to}` : ''}
					{:else}
						unbanned @{event.targetUsername}
					{/if}
				</span>
				<span class="shrink-0 text-gray-500">{new Date(event.createdAt).toLocaleString()}</span>
			</li>
		{/each}
	</ul>
{/if}
