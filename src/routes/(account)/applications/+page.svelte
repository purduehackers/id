<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const DEFAULT_SCOPES = ['openid', 'profile', 'email'];
	const checked = (scope: string) => (form?.scopes ?? DEFAULT_SCOPES).includes(scope);

	let issued = $derived(form?.created ?? form?.rotated);
	const when = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString() : '');
	const json = (value: unknown) => JSON.stringify(value, null, 2);
</script>

<svelte:head><title>Your applications - Purdue Hackers ID</title></svelte:head>

{#if form?.message}
	<p class="mt-4 text-red-700">{form.message}</p>
{:else if form?.deleted}
	<p class="mt-4 text-green-700">Deleted.</p>
{/if}

{#if issued}
	<div class="mt-6 border border-gray-900 p-4">
		<p>
			{form?.created ? `Created ${form.created.name}.` : 'New secret issued.'}
			{#if issued.clientSecret}Copy the secret now, as it will not be shown again.{/if}
		</p>
		<dl class="mt-3 font-mono text-sm">
			<dt class="text-gray-500">client_id</dt>
			<dd class="break-all">{issued.clientId}</dd>
			{#if issued.clientSecret}
				<dt class="mt-2 text-gray-500">client_secret</dt>
				<dd class="break-all">{issued.clientSecret}</dd>
			{/if}
		</dl>
	</div>
{/if}

<h2 class="mt-8 text-lg">Your applications</h2>

{#if data.applications.length === 0}
	<p class="mt-2 text-gray-600">You have not registered any applications.</p>
{:else}
	<ul class="mt-2">
		{#each data.applications as app (app.clientId)}
			<li class="border-b border-gray-200 py-3">
				<div class="flex items-baseline justify-between gap-4">
					<span>
						{app.name}
						<span class="text-sm text-gray-500">
							{app.confidential ? 'confidential' : 'public'}
							{#if app.device}device{/if}
							{when(app.createdAt)}
						</span>
					</span>
					<span class="flex gap-2">
						<a
							href={resolve('/(account)/applications/[clientId]', { clientId: app.clientId })}
							class="border border-gray-900 px-3 py-1">Manage</a
						>
						{#if app.confidential}
							<form method="post" action="?/rotate">
								<input type="hidden" name="clientId" value={app.clientId} />
								<button class="border border-gray-900 px-3 py-1">New secret</button>
							</form>
						{/if}
						<form method="post" action="?/delete">
							<input type="hidden" name="clientId" value={app.clientId} />
							<button class="border border-gray-900 px-3 py-1">Delete</button>
						</form>
					</span>
				</div>
				<dl class="mt-1 text-sm text-gray-600">
					<dt class="inline">client_id</dt>
					<dd class="inline font-mono break-all">{app.clientId}</dd>
					<br />
					<dt class="inline">redirects</dt>
					<dd class="inline font-mono break-all">{app.redirectUris.join(', ') || 'none'}</dd>
					<br />
					<dt class="inline">scopes</dt>
					<dd class="inline font-mono">{app.scopes.join(' ')}</dd>
				</dl>

				<details class="mt-2 text-sm">
					<summary class="inline-block cursor-pointer border border-gray-900 px-3 py-1">
						Preview token JSON
					</summary>
					{#if app.preview}
						<p class="mt-2 text-gray-600">
							Hypothetical data this app would get it if your account granted every scope above:
						</p>
						<h3 class="mt-3">ID token payload</h3>
						<pre class="mt-1 overflow-x-auto bg-gray-100 p-2 font-mono text-xs">{json(
								app.preview.idToken
							)}</pre>
						<h3 class="mt-3">
							<span class="font-mono">GET /api/auth/oauth2/userinfo</span>
						</h3>
						<pre class="mt-1 overflow-x-auto bg-gray-100 p-2 font-mono text-xs">{json(
								app.preview.userinfo
							)}</pre>
						{#if Object.keys(app.preview.accessToken).length}
							<h3 class="mt-3">Extra access token claims (JWT access tokens and introspection)</h3>
							<pre class="mt-1 overflow-x-auto bg-gray-100 p-2 font-mono text-xs">{json(
									app.preview.accessToken
								)}</pre>
						{/if}
					{:else}
						<p class="mt-2 text-gray-600">
							Without the <span class="font-mono">openid</span> scope there is no ID token.
						</p>
					{/if}
				</details>
			</li>
		{/each}
	</ul>
{/if}

<h2 class="mt-10 text-lg">Register an application</h2>

<form method="post" action="?/create" class="mt-3">
	<label class="block">
		Name
		<input
			name="name"
			required
			value={form?.name ?? ''}
			class="mt-1 block w-full border border-gray-400 px-2 py-1 font-sans"
		/>
	</label>

	<label class="mt-3 block">
		Redirect URLs (one per line)
		<textarea
			name="redirectUris"
			rows="3"
			placeholder="https://myapp.com/api/auth/callback/purduehackers"
			class="mt-1 block w-full border border-gray-400 px-2 py-1 font-mono text-sm"
			>{form?.redirectUris ?? ''}</textarea
		>
	</label>

	<label class="mt-3 block">
		<input type="checkbox" name="device" checked={!!form?.device} />
		Device sign-in (CLIs and devices without a browser enter a code at
		<span class="font-mono text-sm">/device</span>)
	</label>

	<fieldset class="mt-3">
		<legend>Type</legend>
		<label class="block">
			<input type="radio" name="type" value="public" checked={!form?.confidential} />
			Public (runs in a browser or on a phone without secret)
		</label>
		<label class="block">
			<input type="radio" name="type" value="confidential" checked={!!form?.confidential} />
			Confidential (has a server that can keep a secret)
		</label>
	</fieldset>

	<fieldset class="mt-3">
		<legend>Scopes</legend>
		{#each data.scopes as { scope, description } (scope)}
			<label class="block">
				<input type="checkbox" name="scope" value={scope} checked={checked(scope)} />
				<span class="font-mono text-sm">{scope}</span>
				<span class="text-sm text-gray-600">{description}</span>
			</label>
		{/each}
	</fieldset>

	<button class="mt-4 border border-gray-900 bg-gray-900 px-3 py-1 text-white">Register</button>
</form>
