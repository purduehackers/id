<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';
	import Identicon from '$lib/components/Identicon.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Section from '$lib/components/Section.svelte';
	import { swatch } from '$lib/components/pixel';
	import Badge from '$lib/components/ph/Badge.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import Checkbox from '$lib/components/ph/Checkbox.svelte';
	import Code from '$lib/components/ph/Code.svelte';
	import DitherButton from '$lib/components/ph/DitherButton.svelte';
	import Field from '$lib/components/ph/Field.svelte';
	import Icon from '$lib/components/ph/Icon.svelte';
	import Input from '$lib/components/ph/Input.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';
	import Secret from '$lib/components/ph/Secret.svelte';
	import Textarea from '$lib/components/ph/Textarea.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const DEFAULT_SCOPES = ['openid', 'profile', 'email'];
	const checked = (scope: string) => (form?.scopes ?? DEFAULT_SCOPES).includes(scope);

	let issued = $derived(form?.created ?? form?.rotated);
	const when = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString() : '');
	const json = (value: unknown) => JSON.stringify(value, null, 2);
	const manage = (clientId: string) => resolve('/(account)/applications/[clientId]', { clientId });
</script>

<svelte:head><title>Your applications - Purdue Hackers ID</title></svelte:head>

<PageTitle title="Your apps">
	{#if data.applications.length === 0}
		Build something that signs people in with their Purdue Hackers ID and register it below.
	{:else}
		Things you built that sign people in with Purdue Hackers ID.
	{/if}
</PageTitle>

{#if form?.message}
	<Notice>{form.message}</Notice>
{:else if form?.deleted}
	<Notice tone="success">Deleted.</Notice>
{/if}

{#if issued}
	<Secret
		seed={issued.clientId}
		title={form?.created ? `${form.created.name} is live` : 'New secret issued'}
		note={issued.clientSecret ? 'Copy the secret now as it will not be shown again.' : undefined}
		values={[
			{ label: 'client_id', value: issued.clientId },
			...(issued.clientSecret ? [{ label: 'client_secret', value: issued.clientSecret }] : [])
		]}
	/>
{/if}

{#if data.applications.length}
	<ul class="flex flex-col gap-4">
		{#each data.applications as app, i (app.clientId)}
			{@const tile = swatch(app.clientId)}
			<li class="flex enter flex-col gap-5 bg-card p-5 sm:p-6" style="--i: {i}">
				<div class="flex flex-wrap items-start gap-4">
					<span class={['grid size-12 shrink-0 place-items-center', tile.bg, tile.fg]}>
						<Identicon seed={app.clientId} class="size-7" />
					</span>
					<div class="flex min-w-0 flex-1 flex-col gap-1">
						<a
							href={manage(app.clientId)}
							class="w-fit ph-headline text-3xl no-underline transition-colors hover:text-primary"
							>{app.name}</a
						>
						<span class="flex flex-wrap items-center gap-1.5">
							<Badge color={app.confidential ? 'blue' : 'muted'}>
								{app.confidential ? 'Confidential' : 'Public'}
							</Badge>
							{#if app.device}<Badge color="teal">Device</Badge>{/if}
							<span class="ml-1 font-mono text-[12px]">since {when(app.createdAt)}</span>
						</span>
					</div>
					<Button size="sm" iconEnd="arrow-right" href={manage(app.clientId)}>Manage</Button>
				</div>

				<dl class="grid grid-cols-[88px_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
					<dt class="ph-subheadline text-[11px] leading-[1.6]">client_id</dt>
					<dd class="font-mono break-all">{app.clientId}</dd>
					<dt class="ph-subheadline text-[11px] leading-[1.6]">redirects</dt>
					<dd class="font-mono break-all">{app.redirectUris.join(', ') || 'none'}</dd>
					<dt class="ph-subheadline text-[11px] leading-[1.6]">scopes</dt>
					<dd class="font-mono">{app.scopes.join(' ')}</dd>
				</dl>

				<div class="-ml-3 flex flex-wrap items-center gap-1">
					<details class="group w-full">
						<summary
							class="inline-flex h-8 list-none items-center gap-1.5 px-3 font-mono text-[13px] font-semibold tracking-wide uppercase hover:bg-foreground/[0.08]"
						>
							<Icon name="code" />
							Token preview
							<Icon name="chevron-down" class="transition-transform group-open:rotate-180" />
						</summary>
						<div class="flex flex-col gap-3 pt-3 pl-3">
							{#if app.preview}
								<p>What this app would get if your account granted every scope above:</p>
								<h3 class="ph-subheadline text-[12px]">ID token payload</h3>
								<Code code={json(app.preview.idToken)} />
								<h3 class="ph-subheadline text-[12px]">GET /api/auth/oauth2/userinfo</h3>
								<Code code={json(app.preview.userinfo)} />
								{#if Object.keys(app.preview.accessToken).length}
									<h3 class="ph-subheadline text-[12px]">
										Extra access token claims (JWT access tokens and introspection)
									</h3>
									<Code code={json(app.preview.accessToken)} />
								{/if}
							{:else}
								<p>Without the <span class="font-mono">openid</span> scope there is no ID token.</p>
							{/if}
						</div>
					</details>
					{#if app.confidential}
						<form method="post" action="?/rotate">
							<input type="hidden" name="clientId" value={app.clientId} />
							<Button type="submit" variant="ghost" size="sm" icon="refresh">New secret</Button>
						</form>
					{/if}
					<form method="post" action="?/delete">
						<input type="hidden" name="clientId" value={app.clientId} />
						<Button type="submit" variant="ghost" size="sm" icon="trash">Delete</Button>
					</form>
				</div>
			</li>
		{/each}
	</ul>
{/if}

<Section title="Register an app">
	<form method="post" action="?/create" class="flex flex-col gap-7">
		<Field label="Name" for="app-name">
			<Input
				id="app-name"
				name="name"
				required
				placeholder="My cool app"
				value={form?.name ?? ''}
			/>
		</Field>

		<Field label="Redirect URLs" for="app-redirects" hint="One per line.">
			<Textarea
				id="app-redirects"
				name="redirectUris"
				rows={3}
				placeholder="https://myapp.com/api/auth/callback/purduehackers"
				class="font-mono text-[13px]"
				value={form?.redirectUris ?? ''}
			/>
		</Field>

		<fieldset class="flex flex-col gap-3">
			<legend class="mb-3 ph-subheadline text-[12px]">Type</legend>
			<Checkbox type="radio" name="type" value="public" checked={!form?.confidential}>
				<span class="font-medium">Public.</span> Runs in a browser or on a phone without a secret.
			</Checkbox>
			<Checkbox type="radio" name="type" value="confidential" checked={!!form?.confidential}>
				<span class="font-medium">Confidential.</span> Has a server that can keep a secret.
			</Checkbox>
			<Checkbox name="device" checked={!!form?.device} class="mt-2">
				<span class="font-medium">Device sign-in.</span> CLIs and devices without a browser enter a
				code at <span class="font-mono">/device</span>.
			</Checkbox>
		</fieldset>

		<fieldset class="flex flex-col gap-3">
			<legend class="mb-3 ph-subheadline text-[12px]">Scopes</legend>
			{#each data.scopes as { scope, description } (scope)}
				<Checkbox name="scope" value={scope} checked={checked(scope)}>
					<span class="font-mono font-semibold">{scope}</span>
					{description}
				</Checkbox>
			{/each}
		</fieldset>

		<DitherButton type="submit">Register</DitherButton>
	</form>
</Section>
