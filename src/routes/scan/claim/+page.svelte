<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Add your passport - Purdue Hackers ID</title></svelte:head>

<main class="mx-auto max-w-sm px-4 py-16 font-serif text-gray-900">
	{#if form && 'claimed' in form}
		<h1 class="text-2xl">Passport {form.claimed} is yours</h1>
		<p class="mt-1 text-gray-600">From now on, tapping it signs you in.</p>
	{:else if form && 'message' in form}
		<h1 class="text-2xl">That did not work</h1>
		<p class="mt-4 text-red-700">{form.message}</p>
	{:else if !data.passportId}
		<h1 class="text-2xl">Tap your passport again</h1>
		<p class="mt-1 text-gray-600">
			That tap expired. Hold your phone against your passport to add it to @{data.me.username}.
		</p>
	{:else if data.ownedBy === data.me.username}
		<h1 class="text-2xl">Passport {data.passportId} is already yours</h1>
	{:else if data.ownedBy}
		<h1 class="text-2xl">Passport {data.passportId}</h1>
		<p class="mt-4 text-red-700">This passport already belongs to someone else.</p>
	{:else}
		<h1 class="text-2xl">Add passport {data.passportId}</h1>
		<p class="mt-1 text-gray-600">It will belong to @{data.me.username} and sign you in.</p>
		<form method="post" class="mt-6">
			<button class="border border-gray-900 bg-gray-900 px-3 py-1 text-white">
				Add to @{data.me.username}
			</button>
		</form>
	{/if}

	<p class="mt-8">
		<a href={resolve('/')} class="text-sm text-gray-500 underline">Go to your account</a>
	</p>
</main>
