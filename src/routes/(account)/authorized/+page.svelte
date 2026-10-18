<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import Section from '$lib/components/Section.svelte';
	import Badge from '$lib/components/ph/Badge.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const when = (value: string | Date) => new Date(value).toLocaleDateString();
</script>

<svelte:head><title>Authorized apps - Purdue Hackers ID</title></svelte:head>

{#if form?.message}
	<Notice tone={form.message === 'Access revoked.' ? 'success' : 'error'}>{form.message}</Notice>
{/if}

<Section title="Authorized apps">
	{#snippet description()}
		{#if data.apps.length === 0}
			You have not given any app access to your account.
		{:else}
			Apps that can see your account. Revoking signs you out of them.
		{/if}
	{/snippet}

	{#if data.apps.length}
		<ul class="border-t border-border">
			{#each data.apps as app (app.id)}
				<li class="flex flex-col gap-2 border-b border-border py-4">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<span class="flex flex-wrap items-baseline gap-x-3">
							<span class="text-lg font-medium">{app.name}</span>
							<span class="font-mono text-[13px]">since {when(app.grantedAt)}</span>
						</span>
						<form method="post" action="?/revoke">
							<input type="hidden" name="id" value={app.id} />
							<Button type="submit" variant="outline" size="sm">Revoke</Button>
						</form>
					</div>
					<div class="flex flex-wrap gap-1.5">
						{#each app.scopes as scope (scope)}
							<Badge color="outline">{scope}</Badge>
						{/each}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</Section>
