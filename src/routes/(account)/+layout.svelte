<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import { ROLE_LABELS, isRole } from '$lib/roles';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import Badge from '$lib/components/ph/Badge.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import Glider from '$lib/components/ph/Glider.svelte';
	import NavLink from '$lib/components/ph/NavLink.svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const links = $derived([
		{ href: resolve('/'), label: 'Account' },
		{ href: resolve('/authorized'), label: 'Authorized apps' },
		{ href: resolve('/applications'), label: 'Your apps' },
		...(data.user.role === 'admin'
			? [
					{ href: resolve('/users'), label: 'Users' },
					{ href: resolve('/access'), label: 'App access' }
				]
			: [])
	]);

	const current = (href: string) =>
		href === resolve('/') ? page.url.pathname === href : page.url.pathname.startsWith(href);
</script>

<div class="flex min-h-dvh flex-col">
	<header class="border-b border-border grid-bg">
		<div class="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-5 pb-8 sm:px-6">
			<div class="flex items-center justify-between gap-4">
				<a
					href={resolve('/')}
					class="flex items-end gap-2.5 no-underline transition-colors hover:text-ph-purple"
				>
					<Glider class="size-7" />
					<span class="ph-headline text-2xl">Purdue Hackers ID</span>
				</a>
				<form method="post" action="/?/signOut">
					<Button type="submit" variant="ghost" size="sm" icon="logout">Sign out</Button>
				</form>
			</div>

			<div class="flex enter flex-col gap-2">
				<h1 class="ph-headline text-5xl break-words sm:text-6xl">{data.user.name}</h1>
				<p class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[15px]">
					<span class="font-mono font-semibold">@{data.user.username}</span>
					<span>{data.user.email}</span>
					{#if isRole(data.user.role)}<Badge color="purple">{ROLE_LABELS[data.user.role]}</Badge
						>{/if}
					{#if !data.user.emailVerified}<Badge color="orange">Not verified</Badge>{/if}
				</p>
			</div>
		</div>
	</header>

	<nav aria-label="Account" class="sticky top-0 z-10 border-b border-border bg-background">
		<div class="mx-auto flex w-full max-w-3xl gap-1 overflow-x-auto px-2 py-2 sm:px-4">
			{#each links as link (link.href)}
				<NavLink
					href={link.href}
					aria-current={current(link.href) ? 'page' : undefined}
					class="shrink-0 text-[14px] whitespace-nowrap"
				>
					{link.label}
				</NavLink>
			{/each}
		</div>
	</nav>

	<main class="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-4 py-10 sm:px-6">
		{@render children()}
	</main>

	<div class="mx-auto w-full max-w-3xl px-4 sm:px-6"><SiteFooter /></div>
</div>
