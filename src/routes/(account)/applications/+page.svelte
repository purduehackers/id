<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const DEFAULT_SCOPES = ['openid', 'profile', 'email'];
	const checked = (scope: string) => (form?.scopes ?? DEFAULT_SCOPES).includes(scope);

	let issued = $derived(form?.created ?? form?.rotated);
	const when = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString() : '');
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
							{when(app.createdAt)}
						</span>
					</span>
					<span class="flex gap-2">
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
					<dd class="inline font-mono break-all">{app.redirectUris.join(', ')}</dd>
					<br />
					<dt class="inline">scopes</dt>
					<dd class="inline font-mono">{app.scopes.join(' ')}</dd>
				</dl>
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
			required
			rows="3"
			placeholder="https://myapp.com/api/auth/callback/purduehackers"
			class="mt-1 block w-full border border-gray-400 px-2 py-1 font-mono text-sm"
			>{form?.redirectUris ?? ''}</textarea
		>
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
