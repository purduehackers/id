<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Authorize {data.clientName} - Purdue Hackers ID</title></svelte:head>

<main class="mx-auto max-w-sm px-4 py-16 font-serif text-gray-900">
	<h1 class="text-2xl">Authorize {data.clientName}</h1>
	<p class="mt-1 text-gray-600">It is asking to:</p>

	<ul class="mt-3 list-disc pl-5">
		{#each data.scopes as { scope, description } (scope)}
			<li>{description}</li>
		{/each}
	</ul>

	{#if form?.message}
		<p class="mt-4 text-red-700">{form.message}</p>
	{/if}

	<form method="post" class="mt-6 flex gap-2">
		<input type="hidden" name="query" value={data.query} />
		<button
			formaction="?/allow&{data.query}"
			class="border border-gray-900 bg-gray-900 px-3 py-1 text-white"
		>
			Allow
		</button>
		<button formaction="?/deny&{data.query}" class="border border-gray-900 px-3 py-1">Deny</button>
	</form>
</main>
