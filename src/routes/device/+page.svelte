<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Connect a device - Purdue Hackers ID</title></svelte:head>

<main class="mx-auto max-w-sm px-4 py-16 font-serif text-gray-900">
	{#if form?.answered}
		<h1 class="text-2xl">
			{form.answered === 'allowed' ? 'Device connected' : 'Request denied'}
		</h1>
		<p class="mt-1 text-gray-600">You can close this page and go back to your device.</p>
	{:else if data.request}
		<h1 class="text-2xl">Authorize {data.request.clientName}</h1>
		<p class="mt-1 text-gray-600">
			Only continue if your device shows the code
			<span class="font-mono">{data.request.userCode}</span>. It is asking to:
		</p>

		<ul class="mt-3 list-disc pl-5">
			{#each data.request.scopes as { scope, description } (scope)}
				<li>{description}</li>
			{/each}
		</ul>

		{#if form?.message}
			<p class="mt-4 text-red-700">{form.message}</p>
		{/if}

		<form method="post" class="mt-6 flex gap-2">
			<input type="hidden" name="userCode" value={data.request.userCode} />
			<button formaction="?/allow" class="border border-gray-900 bg-gray-900 px-3 py-1 text-white">
				Allow
			</button>
			<button formaction="?/deny" class="border border-gray-900 px-3 py-1">Deny</button>
		</form>
	{:else}
		<h1 class="text-2xl">Connect a device</h1>
		<p class="mt-1 text-gray-600">Enter the code shown on your device.</p>

		{#if data.message}
			<p class="mt-4 text-red-700">{data.message}</p>
		{/if}

		<form method="get" class="mt-6">
			<input
				name="user_code"
				required
				autocomplete="off"
				autocapitalize="characters"
				spellcheck="false"
				value={data.userCode ?? ''}
				class="block w-full border border-gray-400 px-2 py-1 font-mono text-lg tracking-widest uppercase"
			/>
			<button class="mt-3 border border-gray-900 bg-gray-900 px-3 py-1 text-white">Continue</button>
		</form>
	{/if}
</main>
