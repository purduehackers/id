<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import DitherButton from '$lib/components/ph/DitherButton.svelte';
	import Link from '$lib/components/ph/Link.svelte';
	import LinkButton from '$lib/components/ph/LinkButton.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const pretty = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

	$effect(() => {
		if (!data.code || data.approvedAs) return;
		const timer = setInterval(async () => {
			const { status } = await fetch(resolve('/passport/status')).then((r) => r.json());
			if (status !== 'pending') {
				clearInterval(timer);
				await invalidateAll();
			}
		}, 2000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head><title>Sign in with your passport - Purdue Hackers ID</title></svelte:head>

<AuthShell>
	<PageTitle title="Sign in with your passport">
		{#if data.approvedAs}
			Your phone approved this sign-in.
		{:else if data.code}
			Tap your passport with your phone, then type this code there:
		{/if}
	</PageTitle>

	{#if form?.message ?? data.error}
		<Notice>{form?.message ?? data.error}</Notice>
	{/if}

	{#if data.approvedAs}
		<form method="post" action="?/complete" class="enter" style="--i: 1">
			<input type="hidden" name="next" value={data.next} />
			<DitherButton type="submit">Continue as @{data.approvedAs.username}</DitherButton>
		</form>
		<form method="post" action="?/cancel" class="enter" style="--i: 2">
			<input type="hidden" name="next" value={data.next} />
			Not you? <LinkButton>Start over</LinkButton>
		</form>
	{:else if data.code}
		<p
			class="enter border border-foreground grid-bg py-8 text-center font-mono text-5xl font-semibold tracking-[0.2em] sm:text-6xl"
			style="--i: 1"
		>
			{pretty(data.code)}
		</p>
		<p class="enter" style="--i: 2">This page updates by itself once you approve it.</p>
		<form method="post" action="?/cancel" class="enter" style="--i: 3">
			<input type="hidden" name="next" value={data.next} />
			<LinkButton>Get a new code</LinkButton>
		</form>
	{/if}

	<p class="enter" style="--i: 4">
		<Link href="{resolve('/login')}?next={encodeURIComponent(data.next)}">Sign in another way</Link>
	</p>
</AuthShell>
