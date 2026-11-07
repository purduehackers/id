<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import Glider from '$lib/components/ph/Glider.svelte';
	import Icon from '$lib/components/ph/Icon.svelte';
	import type { IconName } from '$lib/components/ph/icons';
	import Identicon from '$lib/components/Identicon.svelte';
	import { identiconSvg, swatch } from '$lib/components/pixel';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const links = $derived<{ href: string; label: string; icon: IconName }[]>([
		{ href: resolve('/'), label: 'Account', icon: 'user' },
		{ href: resolve('/authorized'), label: 'Authorized apps', icon: 'lock' },
		{ href: resolve('/sessions'), label: 'Sessions', icon: 'laptop-code' },
		{ href: resolve('/applications'), label: 'Your apps', icon: 'code' },
		...(data.user.role === 'admin'
			? ([
					{ href: resolve('/users'), label: 'Users', icon: 'users' },
					{ href: resolve('/access'), label: 'App access', icon: 'globe' }
				] as const)
			: [])
	]);

	const favicon = $derived(
		`data:image/svg+xml,${encodeURIComponent(identiconSvg(data.user.id, 64))}`
	);
	const tile = $derived(swatch(data.user.id));

	const current = (href: string) =>
		href === resolve('/') ? page.url.pathname === href : page.url.pathname.startsWith(href);
</script>

<svelte:head><link rel="icon" type="image/svg+xml" href={favicon} /></svelte:head>

{#snippet avatar(iconClass: string)}
	{#if data.user.image}
		<img src={data.user.image} alt="" class="size-full object-cover" />
	{:else}
		<Identicon seed={data.user.id} class={iconClass} />
	{/if}
{/snippet}

<div class="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
	<aside
		class="flex flex-col gap-4 bg-card px-4 pt-5 pb-2 lg:sticky lg:top-0 lg:h-dvh lg:gap-10 lg:px-5 lg:py-8"
	>
		<div class="flex items-center justify-between gap-4 px-2">
			<a
				href={resolve('/')}
				class="flex min-w-0 items-center gap-2.5 no-underline transition-colors hover:text-primary"
			>
				<Glider class="size-5 shrink-0" />
				<span class="ph-headline text-xl">Purdue Hackers ID</span>
			</a>
			<span
				class={[
					'ml-auto grid size-8 shrink-0 place-items-center overflow-hidden lg:hidden',
					tile.bg,
					tile.fg
				]}
			>
				{@render avatar('size-5')}
			</span>
			<form method="post" action="/?/signOut" class="-ml-2 lg:hidden">
				<Button type="submit" variant="ghost" size="sm" icon="logout" aria-label="Sign out" />
			</form>
		</div>

		<nav aria-label="Account">
			<ul class="flex flex-wrap gap-1 lg:flex-col">
				{#each links as link (link.href)}
					{@const active = current(link.href)}
					<li>
						<!-- eslint-disable svelte/no-navigation-without-resolve -- hrefs come from resolve() above -->
						<a
							href={link.href}
							aria-current={active ? 'page' : undefined}
							class={[
								'flex h-10 items-center gap-3 px-3 font-mono text-[13px] font-semibold tracking-wide whitespace-nowrap uppercase no-underline transition-colors duration-150',
								active
									? 'bg-foreground text-background'
									: 'hover:bg-foreground/[0.08] hover:text-foreground'
							]}
						>
							<Icon name={link.icon} class="max-sm:hidden" />
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<div class="mt-auto hidden flex-col gap-4 px-2 lg:flex">
			<div class="flex items-center gap-3">
				<span
					class={['grid size-11 shrink-0 place-items-center overflow-hidden', tile.bg, tile.fg]}
				>
					{@render avatar('size-6')}
				</span>
				<div class="flex min-w-0 flex-col gap-0.5">
					<span class="truncate font-medium">{data.user.name}</span>
					<span class="truncate font-mono text-[13px]">@{data.user.username}</span>
				</div>
			</div>
			<form method="post" action="/?/signOut">
				<Button type="submit" variant="ghost" size="sm" icon="logout" class="-ml-3">
					Sign out
				</Button>
			</form>
		</div>
	</aside>

	<div class="flex min-h-dvh flex-col px-6 sm:px-10 lg:px-16 xl:px-24">
		<main class="flex w-full max-w-3xl flex-1 flex-col gap-16 py-10 lg:py-16">
			{@render children()}
		</main>
		<SiteFooter class="max-w-3xl py-8" />
	</div>
</div>
