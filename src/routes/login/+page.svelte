<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';
	import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, normalizeUsername } from '$lib/username';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import DitherButton from '$lib/components/ph/DitherButton.svelte';
	import Field from '$lib/components/ph/Field.svelte';
	import Input from '$lib/components/ph/Input.svelte';
	import Link from '$lib/components/ph/Link.svelte';
	import LinkButton from '$lib/components/ph/LinkButton.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let registering = $state(untrack(() => form?.username !== undefined || data.signup));

	function onUsernameInput(event: Event & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		input.value = normalizeUsername(input.value).replace(/[^a-z0-9]/g, '');
	}
</script>

<svelte:head><title>Sign in - Purdue Hackers ID</title></svelte:head>

<AuthShell>
	<PageTitle title={registering ? 'Make an account' : 'Sign in'}>
		{registering
			? 'One account for every Purdue Hackers app.'
			: 'Use your Purdue Hackers ID to continue.'}
	</PageTitle>

	{#if form?.message ?? data.error}
		<Notice>{form?.message ?? data.error}</Notice>
	{/if}

	<form
		method="post"
		action={registering ? '?/signUp' : '?/signIn'}
		class="flex enter flex-col gap-4"
		style="--i: 1"
	>
		<input type="hidden" name="next" value={data.next} />

		{#if registering}
			<Field label="Name" for="name">
				<Input id="name" name="name" required autocomplete="name" value={form?.name ?? data.name} />
			</Field>

			<Field label="Username" for="username" hint="Lowercase letters and numbers.">
				<Input
					id="username"
					name="username"
					required
					minlength={USERNAME_MIN_LENGTH}
					maxlength={USERNAME_MAX_LENGTH}
					pattern="[a-z0-9]+"
					autocomplete="username"
					autocapitalize="none"
					spellcheck="false"
					value={form?.username ?? ''}
					oninput={onUsernameInput}
				/>
			</Field>

			<Field label="Email" for="email">
				<Input
					id="email"
					name="email"
					type="email"
					required
					autocomplete="email"
					value={form && 'email' in form ? form.email : ''}
				/>
			</Field>
		{:else}
			<Field label="Email or username" for="identifier">
				<Input
					id="identifier"
					name="identifier"
					required
					autocomplete="username"
					autocapitalize="none"
					spellcheck="false"
					value={form && 'identifier' in form ? form.identifier : ''}
				/>
			</Field>
		{/if}

		<Field
			label="Password"
			for="password"
			hint={registering ? 'At least ten characters.' : undefined}
		>
			<Input
				id="password"
				name="password"
				type="password"
				required
				minlength={10}
				autocomplete={registering ? 'new-password' : 'current-password'}
			/>
		</Field>

		<div class="flex flex-wrap items-center justify-between gap-4 pt-2">
			<DitherButton type="submit">{registering ? 'Create account' : 'Sign in'}</DitherButton>
			{#if !registering}
				<Link href="{resolve('/forgot')}?next={encodeURIComponent(data.next)}">
					Forgot your password?
				</Link>
			{/if}
		</div>
	</form>

	{#if !registering}
		<form method="post" action="?/social" class="flex enter flex-col gap-3" style="--i: 2">
			<input type="hidden" name="next" value={data.next} />
			<p class="ph-subheadline text-[12px]">Or continue with</p>
			<div class="flex flex-wrap gap-2">
				<Button
					variant="outline"
					icon="credit-card"
					href="{resolve('/passport')}?next={encodeURIComponent(data.next)}"
				>
					Passport
				</Button>
				{#each data.providers as provider (provider.id)}
					<Button
						type="submit"
						variant="outline"
						name="provider"
						value={provider.id}
						icon={provider.id === 'discord' || provider.id === 'github' ? provider.id : undefined}
					>
						{provider.label}
					</Button>
				{/each}
			</div>
		</form>
	{/if}

	<p class="enter" style="--i: 3">
		{registering ? 'Already have an account?' : 'No account yet?'}
		<LinkButton type="button" onclick={() => (registering = !registering)}>
			{registering ? 'Sign in' : 'Create one'}
		</LinkButton>
	</p>
</AuthShell>
