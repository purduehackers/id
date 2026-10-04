<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Not found' : 'Something went wrong'} - Purdue Hackers ID</title>
</svelte:head>

<main class="mx-auto max-w-sm px-4 py-16 font-serif text-gray-900">
	<p class="font-mono text-sm text-gray-500">{page.status}</p>
	<h1 class="mt-1 text-2xl">{notFound ? 'Nothing here' : 'Something went wrong'}</h1>
	<p class="mt-1 text-gray-600">
		{#if notFound}
			There is no page at <span class="font-mono text-sm text-gray-900">{page.url.pathname}</span>.
		{:else}
			{page.error?.message ?? 'An unexpected error happened.'}
		{/if}
	</p>

	<a
		href={resolve('/')}
		class="mt-6 inline-block border border-gray-900 bg-gray-900 px-3 py-1 text-white"
	>
		Go to your account
	</a>
</main>
