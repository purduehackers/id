<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import BackLink from '$lib/components/ph/BackLink.svelte';
	import DitherButton from '$lib/components/ph/DitherButton.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	$effect(() => {
		if (form && 'claimed' in form) window.dispatchEvent(new Event('ph:celebrate'));
	});
</script>

<svelte:head><title>Add your passport - Purdue Hackers ID</title></svelte:head>

<AuthShell>
	{#if form && 'claimed' in form}
		<PageTitle title="Passport {form.claimed} is yours">
			From now on, tapping it signs you in.
		</PageTitle>
	{:else if form && 'message' in form}
		<PageTitle title="That did not work" />
		<Notice>{form.message}</Notice>
	{:else if !data.passportId}
		<PageTitle title="Tap your passport again">
			That tap expired. Hold your phone against your passport to add it to @{data.me.username}.
		</PageTitle>
	{:else if data.ownedBy === data.me.username}
		<PageTitle title="Passport {data.passportId} is already yours" />
	{:else if data.ownedBy}
		<PageTitle title="Passport {data.passportId}" />
		<Notice>This passport already belongs to someone else.</Notice>
	{:else}
		<PageTitle title="Add passport {data.passportId}">
			It will belong to @{data.me.username} and sign you in.
		</PageTitle>
		<form method="post" class="enter" style="--i: 1">
			<DitherButton type="submit">Add to @{data.me.username}</DitherButton>
		</form>
	{/if}

	<BackLink href={resolve('/')} class="mt-4">Go to your account</BackLink>
</AuthShell>
