<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Sign in - Purdue Hackers ID</title></svelte:head>

<main class="mx-auto max-w-sm px-4 py-16 font-serif text-gray-900">
	<h1 class="text-2xl">Purdue Hackers ID</h1>
	<p class="mt-1 text-gray-600">Sign in with the Discord account you use in the server.</p>

	{#if form?.message ?? data.error}
		<p class="mt-4 text-red-700">{form?.message ?? data.error}</p>
	{/if}

	<form method="post" class="mt-6">
		<input type="hidden" name="next" value={data.next} />
		<button class="border border-gray-900 bg-gray-900 px-3 py-1 text-white">
			Continue with Discord
		</button>
	</form>
</main>
