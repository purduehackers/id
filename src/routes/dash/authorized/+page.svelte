<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const when = (value: string | Date) => new Date(value).toLocaleDateString();
</script>

<svelte:head><title>Authorized apps - Purdue Hackers ID</title></svelte:head>

{#if form?.message}
	<p class="mt-4 {form.message === 'Access revoked.' ? 'text-green-700' : 'text-red-700'}">
		{form.message}
	</p>
{/if}

<h2 class="mt-8 text-lg">Authorized apps</h2>

{#if data.apps.length === 0}
	<p class="mt-2 text-gray-600">You have not given any app access to your account.</p>
{:else}
	<ul class="mt-2">
		{#each data.apps as app (app.id)}
			<li class="border-b border-gray-200 py-3">
				<div class="flex items-baseline justify-between gap-4">
					<span>
						{app.name}
						<span class="text-sm text-gray-500">since {when(app.grantedAt)}</span>
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
