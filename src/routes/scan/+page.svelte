<script lang="ts">
	import { untrack } from 'svelte';
	import PassportEntrance from '$lib/components/PassportEntrance.svelte';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import DitherButton from '$lib/components/ph/DitherButton.svelte';
	import Field from '$lib/components/ph/Field.svelte';
	import Input from '$lib/components/ph/Input.svelte';
	import LinkButton from '$lib/components/ph/LinkButton.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let entering = $state(untrack(() => data.entrance && !!data.tap));
	let page: HTMLDivElement;
	$effect(() => {
		if (page) page.inert = entering;
	});

	$effect(() => {
		if (form && ('approved' in form || 'claimed' in form))
			window.dispatchEvent(new Event('ph:celebrate'));
	});
</script>

<svelte:head
	><title>Passport - Purdue Hackers ID</title><noscript
		><style>
			.entrance-curtain {
				display: none !important;
			}
			.passport-stage {
				visibility: visible !important;
			}
		</style></noscript
	></svelte:head
>

<div class="scan-page" bind:this={page}>
	<AuthShell>
		{#if data.tap && !form}
			<PassportEntrance
				passportId={data.tap.passportId}
				name={data.tap.owner?.name ?? data.tap.returning?.name ?? `Passport ${data.tap.passportId}`}
				username={data.tap.owner?.username}
				animate={entering}
				onfinish={() => (entering = false)}
			/>
		{/if}
		{#if form && 'claimed' in form}
			<PageTitle title="Passport {form.claimed} is yours">
				From now on, tapping it signs you in.
			</PageTitle>
			<DitherButton href={resolve('/')} class="enter" style="--i: 1"
				>Go to your account</DitherButton
			>
		{:else if form && 'approved' in form}
			<PageTitle title="Approved">
				Your other screen will continue signing you in as @{form.approved}. You can close this page.
			</PageTitle>
		{:else if data.error || (form && 'message' in form)}
			<PageTitle title="That did not work" />
			<Notice>{form && 'message' in form ? form.message : data.error}</Notice>
		{:else if !data.tap}
			<PageTitle title="Tap your passport">
				Hold your phone against your passport to sign in with it.
			</PageTitle>
		{:else if !data.tap.owner}
			<PageTitle
				title={data.tap.returning
					? `Welcome back, ${data.tap.returning.givenName ?? data.tap.returning.name}!`
					: `Passport ${data.tap.passportId}`}
			>
				{#if data.tap.returning}
					Passport {data.tap.passportId} is from the previous Purdue Hackers ID.
				{/if}
				It is not linked to an account yet.
			</PageTitle>

			{#if data.me}
				<form method="post" action="?/claim" class="enter" style="--i: 1">
					<DitherButton type="submit">Add it to @{data.me.username}</DitherButton>
				</form>
			{:else}
				<div class="flex enter flex-wrap items-center gap-3" style="--i: 1">
					<DitherButton
						href="{resolve('/login')}?signup&name={encodeURIComponent(
							data.tap.returning?.name ?? ''
						)}&next={encodeURIComponent('/scan/claim')}">Create an account</DitherButton
					>
					<Button
						variant="outline"
						size="lg"
						href="{resolve('/login')}?next={encodeURIComponent('/scan/claim')}">Log in</Button
					>
				</div>
				<p class="enter" style="--i: 2">Then this passport is yours, and signs you in.</p>
			{/if}
		{:else}
			<PageTitle title="Hi, {data.tap.owner.name}">
				Passport {data.tap.passportId}, @{data.tap.owner.username}
			</PageTitle>

			<form method="post" action="?/approve" class="flex enter flex-col gap-4" style="--i: 1">
				<Field label="Code from your other screen" for="code">
					<Input
						id="code"
						name="code"
						inputmode="numeric"
						autocomplete="off"
						pattern="[0-9]*"
						maxlength={7}
						required
						size="code"
					/>
				</Field>
				<DitherButton type="submit" class="mt-2">Approve sign-in</DitherButton>
			</form>

			<form method="post" action="?/here" class="enter" style="--i: 2">
				Signing in on this phone instead? <LinkButton>Sign in here</LinkButton>
			</form>
		{/if}
	</AuthShell>
</div>
{#if entering}<div class="entrance-curtain" aria-hidden="true"></div>{/if}

<style>
	.entrance-curtain {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: var(--background);
		pointer-events: none;
		animation: reveal-page 700ms 1650ms ease-out both;
	}
	@keyframes reveal-page {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.entrance-curtain {
			display: none;
		}
	}
</style>
