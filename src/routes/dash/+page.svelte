<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const when = (value: string | Date | null) => (value ? new Date(value).toLocaleDateString() : '');
</script>

<svelte:head><title>Dashboard - Purdue Hackers ID</title></svelte:head>

<main class="mx-auto max-w-xl px-4 py-16 font-serif text-gray-900">
	<h1 class="text-2xl">{data.user.name}</h1>
	<p class="mt-1 text-gray-600">
		{data.user.email}
		{#if !data.user.emailVerified}<span class="text-amber-700"> · not verified</span>{/if}
	</p>

	{#if form?.message ?? data.error}
		<p class="mt-4 text-red-700">{form?.message ?? data.error}</p>
	{:else if data.notice}
		<p class="mt-4 text-green-700">{data.notice}</p>
	{/if}

	<h2 class="mt-10 border-b border-gray-300 pb-1 text-lg">Connected accounts</h2>

	<ul class="mt-4">
		{#each data.connections as connection (connection.id)}
			<li class="flex items-baseline justify-between gap-4 border-b border-gray-200 py-3">
				<span>
					{connection.label}
					{#if connection.accountId}
						<span class="text-sm text-gray-500">· connected {when(connection.connectedAt)}</span>
					{:else}
						<span class="text-sm text-gray-500">· not connected</span>
					{/if}
				</span>

				{#if connection.accountId}
					<form method="post" action="?/unlink">
						<input type="hidden" name="accountId" value={connection.accountId} />
						<button class="border border-gray-900 px-3 py-1">Disconnect</button>
					</form>
				{:else}
					<form method="post" action="?/link">
						<input type="hidden" name="provider" value={connection.id} />
						<button class="border border-gray-900 bg-gray-900 px-3 py-1 text-white">
							Connect
						</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>

	<h2 class="mt-10 border-b border-gray-300 pb-1 text-lg">Authorized apps</h2>

	{#if data.apps.length === 0}
		<p class="mt-3 text-gray-600">You have not given any app access to your account.</p>
	{:else}
		<ul class="mt-4">
			{#each data.apps as app (app.id)}
				<li class="border-b border-gray-200 py-3">
					<div class="flex items-baseline justify-between gap-4">
						<span>
							{app.name}
							<span class="text-sm text-gray-500">· since {when(app.grantedAt)}</span>
						</span>
						<form method="post" action="?/revoke">
							<input type="hidden" name="id" value={app.id} />
							<button class="border border-gray-900 px-3 py-1">Revoke</button>
						</form>
					</div>
					<ul class="mt-1 list-disc pl-5 text-sm text-gray-600">
						{#each app.scopes as scope (scope)}
							<li>{scope}</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ul>
	{/if}

	<form method="post" action="?/signOut" class="mt-10">
		<button class="border border-gray-900 px-3 py-1">Sign out</button>
	</form>
</main>
