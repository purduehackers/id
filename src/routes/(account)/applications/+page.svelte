<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';
	import Section from '$lib/components/Section.svelte';
	import Badge from '$lib/components/ph/Badge.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import Callout from '$lib/components/ph/Callout.svelte';
	import Checkbox from '$lib/components/ph/Checkbox.svelte';
	import Code from '$lib/components/ph/Code.svelte';
	import DitherButton from '$lib/components/ph/DitherButton.svelte';
	import Field from '$lib/components/ph/Field.svelte';
	import Icon from '$lib/components/ph/Icon.svelte';
	import Input from '$lib/components/ph/Input.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';
	import Textarea from '$lib/components/ph/Textarea.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const DEFAULT_SCOPES = ['openid', 'profile', 'email'];
	const checked = (scope: string) => (form?.scopes ?? DEFAULT_SCOPES).includes(scope);

	let issued = $derived(form?.created ?? form?.rotated);
	const when = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString() : '');
	const json = (value: unknown) => JSON.stringify(value, null, 2);
</script>

<svelte:head><title>Your applications - Purdue Hackers ID</title></svelte:head>

{#if form?.message}
	<Notice>{form.message}</Notice>
{:else if form?.deleted}
	<Notice tone="success">Deleted.</Notice>
{/if}

{#if issued}
	<Callout icon="lock" title={form?.created ? `Created ${form.created.name}` : 'New secret issued'}>
		{#if issued.clientSecret}<p>Copy the secret now, as it will not be shown again.</p>{/if}
		<dl class="mt-3 flex flex-col gap-1 font-mono text-[13px]">
			<dt class="font-semibold uppercase">client_id</dt>
			<dd class="border border-border bg-card px-2 py-1 break-all select-all">{issued.clientId}</dd>
			{#if issued.clientSecret}
				<dt class="mt-2 font-semibold uppercase">client_secret</dt>
				<dd class="border border-border bg-card px-2 py-1 break-all select-all">
					{issued.clientSecret}
				</dd>
			{/if}
		</dl>
	</Callout>
{/if}

<Section title="Your applications">
	{#snippet description()}
		{#if data.applications.length === 0}
			You have not registered any applications.
		{:else}
			Apps that sign people in with Purdue Hackers ID.
		{/if}
	{/snippet}

	{#if data.applications.length}
		<ul class="border-t border-border">
			{#each data.applications as app (app.clientId)}
				<li class="flex flex-col gap-3 border-b border-border py-4">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<span class="flex flex-wrap items-center gap-x-3 gap-y-1">
							<a
								href={resolve('/(account)/applications/[clientId]', { clientId: app.clientId })}
								class="text-lg font-medium no-underline hover:text-ph-purple">{app.name}</a
							>
							<Badge color={app.confidential ? 'blue' : 'outline'}>
								{app.confidential ? 'Confidential' : 'Public'}
							</Badge>
							{#if app.device}<Badge color="teal">Device</Badge>{/if}
							<span class="font-mono text-[13px]">{when(app.createdAt)}</span>
						</span>
						<span class="flex flex-wrap gap-2">
							<Button
								size="sm"
								iconEnd="arrow-right"
								href={resolve('/(account)/applications/[clientId]', { clientId: app.clientId })}
							>
								Manage
							</Button>
							{#if app.confidential}
								<form method="post" action="?/rotate">
									<input type="hidden" name="clientId" value={app.clientId} />
									<Button type="submit" variant="outline" size="sm" icon="refresh"
										>New secret</Button
									>
								</form>
							{/if}
							<form method="post" action="?/delete">
								<input type="hidden" name="clientId" value={app.clientId} />
								<Button type="submit" variant="ghost" size="sm" icon="trash">Delete</Button>
							</form>
						</span>
					</div>

					<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
						<dt class="ph-subheadline">client_id</dt>
						<dd class="font-mono break-all">{app.clientId}</dd>
						<dt class="ph-subheadline">redirects</dt>
						<dd class="font-mono break-all">{app.redirectUris.join(', ') || 'none'}</dd>
						<dt class="ph-subheadline">scopes</dt>
						<dd class="font-mono">{app.scopes.join(' ')}</dd>
					</dl>

					<details class="group">
						<summary
							class="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 px-2 font-mono text-[13px] font-semibold tracking-wide uppercase hover:bg-foreground/[0.08] [&::-webkit-details-marker]:hidden"
						>
							<Icon name="code" />
							Preview token JSON
							<Icon name="chevron-down" class="transition-transform group-open:rotate-180" />
						</summary>
						<div class="mt-3 flex flex-col gap-3">
							{#if app.preview}
								<p>
									Hypothetical data this app would get if your account granted every scope above:
								</p>
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
				</li>
			{/each}
		</ul>
	{/if}
</Section>

<Section title="Register an application">
	<form method="post" action="?/create" class="flex flex-col gap-5">
		<Field label="Name" for="app-name">
			<Input id="app-name" name="name" required value={form?.name ?? ''} />
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

		<Checkbox name="device" checked={!!form?.device}>
			<span class="font-medium">Device sign-in.</span> CLIs and devices without a browser enter a
			code at <span class="font-mono">/device</span>.
		</Checkbox>

		<fieldset class="flex flex-col gap-2.5">
			<legend class="mb-2.5 ph-subheadline text-[12px]">Type</legend>
			<Checkbox type="radio" name="type" value="public" checked={!form?.confidential}>
				<span class="font-medium">Public.</span> Runs in a browser or on a phone without a secret.
			</Checkbox>
			<Checkbox type="radio" name="type" value="confidential" checked={!!form?.confidential}>
				<span class="font-medium">Confidential.</span> Has a server that can keep a secret.
			</Checkbox>
		</fieldset>

		<fieldset class="flex flex-col gap-2.5">
			<legend class="mb-2.5 ph-subheadline text-[12px]">Scopes</legend>
			{#each data.scopes as { scope, description } (scope)}
				<Checkbox name="scope" value={scope} checked={checked(scope)}>
					<span class="font-mono font-semibold">{scope}</span>
					{description}
				</Checkbox>
			{/each}
		</fieldset>

		<DitherButton type="submit" class="mt-2">Register</DitherButton>
	</form>
</Section>
