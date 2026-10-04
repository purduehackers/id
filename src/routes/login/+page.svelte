<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';
	import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, normalizeUsername } from '$lib/username';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let registering = $state(untrack(() => form?.username !== undefined));

	function onUsernameInput(event: Event & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		input.value = normalizeUsername(input.value).replace(/[^a-z0-9]/g, '');
	}
</script>

<svelte:head><title>Sign in - Purdue Hackers ID</title></svelte:head>

<main class="mx-auto max-w-sm px-4 py-16 font-serif text-gray-900">
	<h1 class="text-2xl">Purdue Hackers ID</h1>
	<p class="mt-1 text-gray-600">
		{registering ? 'Make an account.' : 'Sign in to continue.'}
	</p>

	{#if form?.message ?? data.error}
		<p class="mt-4 text-red-700">{form?.message ?? data.error}</p>
	{/if}

	<form method="post" action={registering ? '?/signUp' : '?/signIn'} class="mt-6">
		<input type="hidden" name="next" value={data.next} />

		{#if registering}
			<label class="block">
				Name
				<input
					name="name"
					required
					value={form?.name ?? ''}
					class="mt-1 block w-full border border-gray-400 px-2 py-1 font-sans"
				/>
			</label>

			<label class="mt-3 block">
				Username
				<input
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
					class="mt-1 block w-full border border-gray-400 px-2 py-1 font-sans"
				/>
			</label>
		{/if}

		{#if registering}
			<label class="mt-3 block">
				Email
				<input
					name="email"
					type="email"
					required
					autocomplete="email"
					value={form && 'email' in form ? form.email : ''}
					class="mt-1 block w-full border border-gray-400 px-2 py-1 font-sans"
				/>
			</label>
		{:else}
			<label class="mt-3 block">
				Email or username
				<input
					name="identifier"
					required
					autocomplete="username"
					autocapitalize="none"
					spellcheck="false"
					value={form && 'identifier' in form ? form.identifier : ''}
					class="mt-1 block w-full border border-gray-400 px-2 py-1 font-sans"
				/>
			</label>
		{/if}

		<label class="mt-3 block">
			Password
			<input
				name="password"
				type="password"
				required
				minlength="10"
				autocomplete={registering ? 'new-password' : 'current-password'}
				class="mt-1 block w-full border border-gray-400 px-2 py-1 font-sans"
			/>
		</label>

		<button class="mt-4 border border-gray-900 bg-gray-900 px-3 py-1 text-white">
			{registering ? 'Create account' : 'Sign in'}
		</button>
	</form>

	{#if !registering}
		<p class="mt-3 text-sm text-gray-600">
			<a href="{resolve('/forgot')}?next={encodeURIComponent(data.next)}" class="underline">
				Forgot your password?
			</a>
		</p>
	{/if}

	{#if !registering}
		<form method="post" action="?/social" class="mt-8">
			<input type="hidden" name="next" value={data.next} />
			<p class="text-gray-600">Or, if you have connected one:</p>
			<div class="mt-2 flex gap-2">
				{#each data.providers as provider (provider.id)}
					<button name="provider" value={provider.id} class="border border-gray-900 px-3 py-1">
						Continue with {provider.label}
					</button>
				{/each}
			</div>
		</form>
	{/if}

	<p class="mt-8 text-gray-600">
		{registering ? 'Already have an account?' : 'No account yet?'}
		<button class="underline" onclick={() => (registering = !registering)}>
			{registering ? 'Sign in' : 'Create one'}
		</button>
	</p>
</main>
