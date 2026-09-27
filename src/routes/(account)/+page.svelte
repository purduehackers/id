<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const when = (value: string | Date | null) => (value ? new Date(value).toLocaleDateString() : '');
</script>

<svelte:head><title>Account - Purdue Hackers ID</title></svelte:head>

{#if form?.message ?? data.error}
	<p class="mt-4 text-red-700">{form?.message ?? data.error}</p>
{:else if data.notice}
	<p class="mt-4 text-green-700">{data.notice}</p>
{/if}

<h2 class="mt-8 text-lg">Connected accounts</h2>

<ul class="mt-2">
	{#each data.connections as connection (connection.id)}
		<li class="flex items-baseline justify-between gap-4 border-b border-gray-200 py-3">
			<span>
				{connection.label}
				{#if connection.accountId}
					<span class="text-sm text-gray-500">connected {when(connection.connectedAt)}</span>
				{:else}
					<span class="text-sm text-gray-500">not connected</span>
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
					<button class="border border-gray-900 bg-gray-900 px-3 py-1 text-white">Connect</button>
				</form>
			{/if}
		</li>
	{/each}
</ul>
