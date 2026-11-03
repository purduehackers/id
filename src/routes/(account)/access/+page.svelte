<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import Identicon from '$lib/components/Identicon.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
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

<PageTitle title="App access">
	Apps that asked to see every member. Granting lets them list members and receive webhooks about
	everyone, not just people who signed into them.
</PageTitle>

{#if form && 'message' in form}
	<Notice>{form.message}</Notice>
{:else if form && 'notice' in form}
	<Notice tone="success">{form.notice}</Notice>
{/if}

{#if data.apps.length === 0}
	<p>No app has asked for directory access.</p>
{:else}
	<ul class="flex flex-col gap-4">
		{#each data.apps as app, i (app.clientId)}
			{@const pending = !app.decidedAt || app.requestedAt > app.decidedAt}
			<li class="flex enter flex-col gap-5 bg-card p-5 sm:p-6" style="--i: {i}">
				<div class="flex items-start gap-4">
					<span class="grid size-11 shrink-0 place-items-center bg-muted">
						<Identicon seed={app.clientId} class="size-6" />
					</span>
					<div class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[17px]">
							{app.name ?? app.clientId}
							{#if pending}<Badge color="yellow">Waiting</Badge>{/if}
						</span>
						<span class="font-mono text-[13px]">
							@{app.ownerUsername ?? 'unknown'} · asked {when(app.requestedAt)}
						</span>
						<span class="font-mono text-[12px] break-all">{app.clientId}</span>
					</div>
				</div>

				<form
					method="post"
					action="?/decide"
					class="flex flex-col gap-3"
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
					<Button type="submit" size="sm" class="mt-1">Save decision</Button>
				</form>
			</li>
		{/each}
	</ul>
{/if}
