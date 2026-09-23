<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const links = [
		{ href: '/dash', label: 'Account' },
		{ href: '/dash/authorized', label: 'Authorized apps' },
		{ href: '/dash/applications', label: 'Your applications' }
	];
</script>

<main class="mx-auto max-w-xl px-4 py-16 font-serif text-gray-900">
	<h1 class="text-2xl">{data.user.name}</h1>
	<p class="mt-1 text-gray-600">
		{data.user.email}
		{#if !data.user.emailVerified}<span class="text-amber-700"> not verified</span>{/if}
	</p>

	<nav class="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-gray-300 pb-2">
		{#each links as link (link.href)}
			<a
				href={link.href}
				class={page.url.pathname === link.href ? 'text-gray-900' : 'text-gray-500 underline'}
			>
				{link.label}
			</a>
		{/each}
		<form method="post" action="/dash?/signOut" class="ml-auto">
			<button class="text-gray-500 underline">Sign out</button>
		</form>
	</nav>

	{@render children()}
</main>
