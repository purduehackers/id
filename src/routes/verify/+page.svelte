<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import DitherButton from '$lib/components/ph/DitherButton.svelte';
	import Field from '$lib/components/ph/Field.svelte';
	import Input from '$lib/components/ph/Input.svelte';
	import Link from '$lib/components/ph/Link.svelte';
	import LinkButton from '$lib/components/ph/LinkButton.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// A failed action re-runs `load` with the action URL, so the identifying
	// params have to ride along on it or the page loses track of who you are.
	const keep = $derived(
		`email=${encodeURIComponent(data.email)}&next=${encodeURIComponent(data.next)}`
	);
</script>

<svelte:head><title>Verify your email - Purdue Hackers ID</title></svelte:head>

<AuthShell>
	<PageTitle title="Check your email">
		We sent a six-digit code to <strong class="font-medium">{data.email}</strong>. It is good for
		ten minutes.
	</PageTitle>

	{#if form?.message}
		<Notice>{form.message}</Notice>
	{:else if form?.notice}
		<Notice tone="success">{form.notice}</Notice>
	{/if}

	<form method="post" action="?/verify&{keep}" class="flex enter flex-col gap-4" style="--i: 1">
		<input type="hidden" name="email" value={data.email} />
		<input type="hidden" name="next" value={data.next} />

		<Field label="Code" for="otp">
			<Input
				id="otp"
				name="otp"
				inputmode="numeric"
				autocomplete="one-time-code"
				pattern="[0-9 ]*"
				maxlength={7}
				required
				class="h-14 font-mono text-2xl tracking-[0.3em]"
			/>
		</Field>

		<DitherButton type="submit" class="mt-2">Verify</DitherButton>
	</form>

	<form method="post" action="?/resend&{keep}" class="enter" style="--i: 2">
		<input type="hidden" name="email" value={data.email} />
		Nothing arrived? <LinkButton>Send another code</LinkButton>
	</form>

	<p class="enter" style="--i: 3">
		Wrong address? <Link href={resolve('/login')}>Start over</Link>.
	</p>
</AuthShell>
