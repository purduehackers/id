<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import Section from '$lib/components/Section.svelte';
	import Badge from '$lib/components/ph/Badge.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import Checkbox from '$lib/components/ph/Checkbox.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';

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
	<Notice>{form.message}</Notice>
{:else if form && 'notice' in form}
	<Notice tone="success">{form.notice}</Notice>
{/if}

<Section title="App access">
	{#snippet description()}
		Apps that asked to see every member. Granting lets them list members and receive webhooks about
		everyone (not just people who signed into them).
	{/snippet}

	{#if data.apps.length === 0}
		<p>No app has asked for directory access.</p>
	{:else}
		<ul class="border-t border-border">
			{#each data.apps as app (app.clientId)}
				{@const pending = !app.decidedAt || app.requestedAt > app.decidedAt}
				<li class="flex flex-col gap-3 border-b border-border py-4">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<span class="flex flex-wrap items-center gap-x-3 gap-y-1">
							<span class="text-lg font-medium">{app.name ?? app.clientId}</span>
							<span class="font-mono text-[13px]">by @{app.ownerUsername ?? 'unknown'}</span>
							{#if pending}<Badge color="yellow">Waiting</Badge>{/if}
						</span>
						<span class="font-mono text-[13px]">asked {when(app.requestedAt)}</span>
					</div>
					<p class="font-mono text-[13px] break-all">{app.clientId}</p>

					<form
						method="post"
						action="?/decide"
						class="flex flex-col gap-2.5"
						onsubmit={(event) => confirmGrant(event, app.name ?? app.clientId)}
					>
						<input type="hidden" name="clientId" value={app.clientId} />
						{#each app.scopes as { scope, description, granted } (scope)}
							<Checkbox
								name="scope"
								value={scope}
								checked={granted || (pending && !app.grantedScopes.length)}
							>
								<span class="font-mono font-semibold">{scope}</span>
								{description}
							</Checkbox>
						{/each}
						<Button type="submit" variant="outline" size="sm" class="mt-1">Save</Button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</Section>
