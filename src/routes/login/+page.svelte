<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let registering = $state(false);
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
					class="mt-1 block w-full border border-gray-400 px-2 py-1 font-sans"
				/>
			</label>
		{/if}

		<label class="mt-3 block">
			Email
			<input
				name="email"
				type="email"
				required
				autocomplete="email"
				value={form?.email ?? ''}
				class="mt-1 block w-full border border-gray-400 px-2 py-1 font-sans"
			/>
		</label>

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
