<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Passport - Purdue Hackers ID</title></svelte:head>

<main class="mx-auto max-w-sm px-4 py-16 font-serif text-gray-900">
	{#if form && 'approved' in form}
		<h1 class="text-2xl">Approved</h1>
		<p class="mt-1 text-gray-600">
			Your other screen will continue signing you in as @{form.approved}. You can close this page.
		</p>
	{:else if data.error || (form && 'message' in form)}
		<h1 class="text-2xl">That did not work</h1>
		<p class="mt-4 text-red-700">{form && 'message' in form ? form.message : data.error}</p>
	{:else if !data.tap}
		<h1 class="text-2xl">Tap your passport</h1>
		<p class="mt-1 text-gray-600">Hold your phone against your passport to sign in with it.</p>
	{:else if !data.tap.owner && data.tap.returning}
		<h1 class="text-2xl">
			Welcome back, {data.tap.returning.givenName ?? data.tap.returning.name}!
		</h1>
		<p class="mt-1 text-gray-600">
			Passport {data.tap.passportId} is from the previous Purdue Hackers ID. Make your new one to keep
			using it.
		</p>
		<p class="mt-6">
			<a
				href="{resolve('/login')}?signup&name={encodeURIComponent(
					data.tap.returning.name
				)}&next={encodeURIComponent('/?welcome')}"
				class="inline-block border border-gray-900 bg-gray-900 px-3 py-1 text-white"
				>Create your account</a
			>
		</p>
		<p class="mt-4 text-sm text-gray-600">
			Then connect the Discord account you used with Purdue Hackers, and your passport comes with
			you. Already made a new ID?
			<a href="{resolve('/login')}?next={encodeURIComponent('/?welcome')}" class="underline"
				>Sign in</a
			> and connect Discord.
		</p>
	{:else if !data.tap.owner}
		<h1 class="text-2xl">Passport {data.tap.passportId}</h1>
		<p class="mt-4 text-red-700">
			This passport is not connected to a Purdue Hackers ID yet. Sign in with your email, connect
			Discord on your account page, then tap it again.
		</p>
	{:else}
		<h1 class="text-2xl">Hi, {data.tap.owner.name}</h1>
		<p class="mt-1 text-gray-600">Passport {data.tap.passportId}, @{data.tap.owner.username}</p>

		<form method="post" action="?/approve" class="mt-6">
			<label class="block">
				Code from your other screen
				<input
					name="code"
					inputmode="numeric"
					autocomplete="off"
					pattern="[0-9]*"
					maxlength="4"
					required
					class="mt-1 block w-full border border-gray-400 px-2 py-1 font-mono text-3xl tracking-widest"
				/>
			</label>
			<button class="mt-4 border border-gray-900 bg-gray-900 px-3 py-1 text-white">
				Approve sign-in
			</button>
		</form>

		<form method="post" action="?/here" class="mt-8 text-gray-600">
			Signing in on this phone instead?
			<button class="underline">Sign in here</button>
		</form>
	{/if}
</main>
