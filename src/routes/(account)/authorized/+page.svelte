<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Stamp from '$lib/components/Stamp.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const when = (value: string | Date) => new Date(value).toLocaleDateString();
</script>

<svelte:head><title>Authorized apps - Purdue Hackers ID</title></svelte:head>

<PageTitle title="Stamps">
	{#if data.apps.length === 0}
		Every app you let into your account leaves a stamp here. None yet.
	{:else}
		Every app you let into your account leaves a stamp. Revoke one to sign out of it everywhere.
	{/if}
</PageTitle>

{#if form?.message}
	<Notice tone={form.message === 'Access revoked.' ? 'success' : 'error'}>{form.message}</Notice>
{/if}

{#if data.apps.length === 0}
	<div class="grid h-56 max-w-md place-items-center dither-field">
		<span class="bg-background px-3 py-1.5 ph-subheadline text-[12px]">Empty page</span>
	</div>
{:else}
	<ul class="grid gap-x-6 gap-y-8 py-2 sm:grid-cols-2">
		{#each data.apps as app, i (app.id)}
			<Stamp
				name={app.name}
				seed={app.name}
				date={when(app.grantedAt)}
				scopes={app.scopes}
				index={i}
			>
				<form method="post" action="?/revoke">
					<input type="hidden" name="id" value={app.id} />
					<Button type="submit" variant="plain" size="sm" icon="times">Revoke</Button>
				</form>
			</Stamp>
		{/each}
	</ul>
{/if}
