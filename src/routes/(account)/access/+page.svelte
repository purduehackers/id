<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const when = (value: Date | string | null) => (value ? new Date(value).toLocaleDateString() : '');

	function confirmGrant(event: SubmitEvent & { currentTarget: HTMLFormElement }, name: string) {
		const granting = new FormData(event.currentTarget).getAll('scope').length > 0;
		const message = granting
			? `Give ${name} access to every member's data?`
			: `Revoke all directory access for ${name}?`;
		if (!confirm(message)) event.preventDefault();
	}
</script>

<svelte:head><title>App access - Purdue Hackers ID</title></svelte:head>

{#if form && 'message' in form}
	<p class="mt-4 text-red-700">{form.message}</p>
{:else if form && 'notice' in form}
	<p class="mt-4 text-green-700">{form.notice}</p>
{/if}

<h2 class="mt-8 text-lg">App access</h2>
<p class="mt-1 text-sm text-gray-600">
	Apps that asked to see every member. Granting lets them list members and receive webhooks about
	everyone (not just people who signed into them)
</p>

{#if data.apps.length === 0}
	<p class="mt-4 text-gray-600">No app has asked for directory access.</p>
{:else}
	<ul class="mt-2">
		{#each data.apps as app (app.clientId)}
			{@const pending = !app.decidedAt || app.requestedAt > app.decidedAt}
			<li class="border-b border-gray-200 py-3">
				<div class="flex items-baseline justify-between gap-4">
					<span>
						{app.name ?? app.clientId}
						<span class="text-gray-500">by @{app.ownerUsername ?? 'unknown'}</span>
						{#if pending}<span class="text-amber-700"> waiting</span>{/if}
					</span>
					<span class="text-sm text-gray-500">asked {when(app.requestedAt)}</span>
				</div>
				<p class="font-mono text-xs break-all text-gray-500">{app.clientId}</p>

				<form
					method="post"
					action="?/decide"
					class="mt-2"
					onsubmit={(event) => confirmGrant(event, app.name ?? app.clientId)}
				>
					<input type="hidden" name="clientId" value={app.clientId} />
					{#each app.scopes as { scope, description, granted } (scope)}
						<label class="block text-sm">
							<input
								type="checkbox"
								name="scope"
								value={scope}
								checked={granted || (pending && !app.grantedScopes.length)}
							/>
							<span class="font-mono">{scope}</span>
							<span class="text-gray-600">{description}</span>
						</label>
					{/each}
					<button class="mt-2 border border-gray-900 px-3 py-1">Save</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}
