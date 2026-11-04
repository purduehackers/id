<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Row from '$lib/components/Row.svelte';
	import Badge from '$lib/components/ph/Badge.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import Link from '$lib/components/ph/Link.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const when = (value: string | Date) => new Date(value).toLocaleDateString();
	const hasOthers = $derived(data.sessions.some((session) => !session.current));
</script>

<svelte:head><title>Sessions - Purdue Hackers ID</title></svelte:head>

<PageTitle title="Sessions">
	Devices signed in to your Purdue Hackers ID. Signing one out does not remove apps you let in, for
	that go to <Link href={resolve('/authorized')}>Authorized apps</Link>.
</PageTitle>

{#if form && 'message' in form}
	<Notice>{form.message}</Notice>
{:else if form && 'notice' in form}
	<Notice tone="success">{form.notice}</Notice>
{/if}

<ul class="flex flex-col">
	{#each data.sessions as session (session.id)}
		<Row icon="laptop-code">
			{#snippet title()}
				{session.device}
				{#if session.current}<Badge color="lime">This device</Badge>{/if}
			{/snippet}
			{#snippet meta()}
				{[
					`Signed in ${when(session.signedInAt)}`,
					`Active ${when(session.activeAt)}`,
					session.ipAddress
				]
					.filter(Boolean)
					.join(' · ')}
			{/snippet}
			{#snippet actions()}
				{#if session.current}
					<form method="post" action="/?/signOut">
						<Button type="submit" variant="ghost" size="sm" icon="logout">Sign out</Button>
					</form>
				{:else}
					<form method="post" action="?/revoke">
						<input type="hidden" name="id" value={session.id} />
						<Button type="submit" variant="ghost" size="sm" icon="logout">Sign out</Button>
					</form>
				{/if}
			{/snippet}
		</Row>
	{/each}
</ul>

{#if hasOthers}
	<form method="post" action="?/revokeOthers">
		<Button type="submit" variant="outline">Sign out everywhere else</Button>
	</form>
{/if}
