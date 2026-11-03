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

	const keep = $derived(
		`email=${encodeURIComponent(data.email)}&next=${encodeURIComponent(data.next)}`
	);
</script>

<svelte:head><title>Reset your password - Purdue Hackers ID</title></svelte:head>

<AuthShell>
	<PageTitle title="Reset your password">
		{#if data.email}
			If <strong class="font-medium">{data.email}</strong> has a Purdue Hackers ID, we sent it a six-digit
			code. It is good for ten minutes.
		{:else}
			We will email you a code to set a new one.
		{/if}
	</PageTitle>

	{#if form?.message}
		<Notice>{form.message}</Notice>
	{:else if form && 'notice' in form}
		<Notice tone="success">{form.notice}</Notice>
	{/if}

	{#if data.email}
		<form method="post" action="?/reset&{keep}" class="flex enter flex-col gap-4" style="--i: 1">
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
					size="code"
				/>
			</Field>

			<Field label="New password" for="password" hint="At least ten characters.">
				<Input
					id="password"
					name="password"
					type="password"
					required
					minlength={10}
					autocomplete="new-password"
				/>
			</Field>

			<DitherButton type="submit" class="mt-2">Set new password</DitherButton>
		</form>

		<form method="post" action="?/resend&{keep}" class="enter" style="--i: 2">
			<input type="hidden" name="email" value={data.email} />
			Nothing arrived? <LinkButton>Send another code</LinkButton>
		</form>

		<p class="enter" style="--i: 3">
			Wrong address? <Link href="{resolve('/forgot')}?next={encodeURIComponent(data.next)}"
				>Start over</Link
			>.
		</p>
	{:else}
		<form
			method="post"
			action="?/request&next={encodeURIComponent(data.next)}"
			class="flex enter flex-col gap-4"
			style="--i: 1"
		>
			<input type="hidden" name="next" value={data.next} />

			<Field label="Email" for="email">
				<Input id="email" name="email" type="email" required autocomplete="email" />
			</Field>

			<DitherButton type="submit" class="mt-2">Send code</DitherButton>
		</form>

		<p class="enter" style="--i: 2">
			Remembered it? <Link href="{resolve('/login')}?next={encodeURIComponent(data.next)}"
				>Sign in</Link
			>.
		</p>
	{/if}
</AuthShell>
