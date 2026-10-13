<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const chosen = $derived(
		form && 'events' in form && form.events
			? form.events
			: (data.webhook?.events ?? data.events.map((e) => e.type))
	);
	const subscribed = (type: string) => (chosen as string[]).includes(type);
	const at = (value: Date | string | null) => (value ? new Date(value).toLocaleString() : '');
	const pretty = (payload: string) => JSON.stringify(JSON.parse(payload), null, 2);

	function status(d: PageData['deliveries'][number]) {
		if (d.deliveredAt) return { label: 'delivered', tone: 'text-green-700' };
		if (d.failedAt) return { label: `gave up: ${d.lastError}`, tone: 'text-red-700' };
		if (d.attempts === 0) return { label: 'sending', tone: 'text-gray-500' };
		return {
			label: `${d.lastError}, retries after ${at(d.nextAttemptAt)}`,
			tone: 'text-amber-700'
		};
	}

	function confirmRemove(event: SubmitEvent) {
		if (!confirm('Remove this webhook?')) event.preventDefault();
	}
</script>

<svelte:head><title>{data.app.name} - Purdue Hackers ID</title></svelte:head>

<p class="mt-6 text-sm">
	<a href={resolve('/applications')} class="text-gray-500 underline">Your applications</a>
</p>
<h2 class="mt-2 text-lg">{data.app.name}</h2>
<p class="font-mono text-sm break-all text-gray-600">{data.app.clientId}</p>

{#if form && 'message' in form}
	<p class="mt-4 text-red-700">{form.message}</p>
{:else if form && 'notice' in form}
	<p class="mt-4 text-green-700">{form.notice}</p>
{/if}

{#if form && 'secret' in form}
	<div class="mt-6 border border-gray-900 p-4">
		<p>Copy the signing secret now, it will not be shown again.</p>
		<p class="mt-2 font-mono text-sm break-all">{form.secret}</p>
	</div>
{/if}

<h3 class="mt-8 text-lg">Webhook</h3>
<form method="post" action="?/save" class="mt-3">
	<label class="block">
		URL
		<input
			name="url"
			type="url"
			required
			placeholder="https://myapp.com/webhooks/purduehackers"
			value={form && 'url' in form ? form.url : (data.webhook?.url ?? '')}
			class="mt-1 block w-full border border-gray-400 px-2 py-1 font-mono text-sm"
		/>
	</label>

	<fieldset class="mt-3">
		<legend>Events</legend>
		{#each data.events as { type, description } (type)}
			<label class="block">
				<input type="checkbox" name="event" value={type} checked={subscribed(type)} />
				<span class="font-mono text-sm">{type}</span>
				<span class="text-sm text-gray-600">{description}</span>
			</label>
		{/each}
	</fieldset>

	<button class="mt-4 border border-gray-900 bg-gray-900 px-3 py-1 text-white">
		{data.webhook ? 'Save' : 'Add webhook'}
	</button>
</form>

{#if data.webhook}
	<div class="mt-4 flex flex-wrap gap-2">
		<form method="post" action="?/test">
			<button class="border border-gray-900 px-3 py-1">Send test event</button>
		</form>
		<form method="post" action="?/rotate">
			<button class="border border-gray-900 px-3 py-1">New secret</button>
		</form>
		<form method="post" action="?/remove" onsubmit={confirmRemove}>
			<button class="border border-red-700 px-3 py-1 text-red-700">Remove</button>
		</form>
	</div>

	<h3 class="mt-10 text-lg">Recent deliveries</h3>
	{#if data.deliveries.length === 0}
		<p class="mt-2 text-gray-600">Nothing sent yet</p>
	{:else}
		<ul class="mt-2 text-sm">
			{#each data.deliveries as delivery (delivery.id)}
				{@const state = status(delivery)}
				<li class="border-b border-gray-200 py-2">
					<details>
						<summary class="flex cursor-pointer items-baseline justify-between gap-4">
							<span>
								<span class="font-mono">{delivery.type}</span>
								<span class={state.tone}>{state.label}</span>
							</span>
							<span class="shrink-0 text-gray-500">{at(delivery.createdAt)}</span>
						</summary>
						<p class="mt-1 font-mono text-xs text-gray-500">{delivery.id}</p>
						<pre class="mt-1 overflow-x-auto bg-gray-100 p-2 font-mono text-xs">{pretty(
								delivery.payload
							)}</pre>
						{#if delivery.attempts > 0}
							<form method="post" action="?/resend" class="mt-1">
								<input type="hidden" name="deliveryId" value={delivery.id} />
								<button class="underline">Send again</button>
							</form>
						{/if}
					</details>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

{#if data.app.confidential}
	<h3 class="mt-12 text-lg">Directory access</h3>
	<p class="mt-1 text-sm text-gray-600">
		With directory access the app sees every member. Requires admin approval.
	</p>

	{#if data.directory.granted.length}
		<p class="mt-2 text-sm text-green-700">
			Granted: <span class="font-mono">{data.directory.granted.join(' ')}</span>
		</p>
	{:else if data.directory.requested.length && data.directory.decided}
		<p class="mt-2 text-sm text-red-700">An admin did not grant the access you asked for.</p>
	{:else if data.directory.requested.length}
		<p class="mt-2 text-sm text-amber-700">Waiting for an admin to approve.</p>
	{/if}

	<form method="post" action="?/requestAccess" class="mt-3">
		{#each data.directory.scopes as { scope, description } (scope)}
			<label class="block">
				<input
					type="checkbox"
					name="scope"
					value={scope}
					checked={data.directory.requested.includes(scope)}
				/>
				<span class="font-mono text-sm">{scope}</span>
				<span class="text-sm text-gray-600">{description}</span>
			</label>
		{/each}
		<button class="mt-3 border border-gray-900 px-3 py-1">
			{data.directory.requested.length ? 'Change request' : 'Ask for access'}
		</button>
	</form>

	{#if data.directory.granted.length}
		<p class="mt-4 text-sm text-gray-600">
			Get a token as the app itself (it lasts five minutes), then call the API with it:
		</p>
		<pre
			class="mt-1 overflow-x-auto bg-gray-100 p-2 font-mono text-xs">curl -u "$CLIENT_ID:$CLIENT_SECRET" {data
				.directory.tokenUrl} \
  -d grant_type=client_credentials \
  -d scope="{data.directory.granted.join(' ')}" \
  -d resource={data.directory.resource}

curl -H "Authorization: Bearer $TOKEN" "{data.directory.apiUrl}?limit=100"</pre>
		<p class="mt-1 text-sm text-gray-600">
			Page with <span class="font-mono">cursor=next_cursor</span> until it is null. Look someone up
			with
			<span class="font-mono">discord_id=…</span>.
		</p>
	{/if}
{/if}
