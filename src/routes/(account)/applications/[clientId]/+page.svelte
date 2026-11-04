<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';
	import Section from '$lib/components/Section.svelte';
	import BackLink from '$lib/components/ph/BackLink.svelte';
	import Badge from '$lib/components/ph/Badge.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import Checkbox from '$lib/components/ph/Checkbox.svelte';
	import Code from '$lib/components/ph/Code.svelte';
	import Field from '$lib/components/ph/Field.svelte';
	import Icon from '$lib/components/ph/Icon.svelte';
	import Input from '$lib/components/ph/Input.svelte';
	import LinkButton from '$lib/components/ph/LinkButton.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';
	import Secret from '$lib/components/ph/Secret.svelte';
	import Identicon from '$lib/components/Identicon.svelte';
	import { swatch } from '$lib/components/pixel';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const chosen = $derived(
		form && 'events' in form && form.events
			? form.events
			: (data.webhook?.events ?? data.events.map((e) => e.type))
	);
	const subscribed = (type: string) => (chosen as string[]).includes(type);
	const at = (value: Date | string | null) => (value ? new Date(value).toLocaleString() : '');
	const pretty = (payload: string) => JSON.stringify(JSON.parse(payload), null, 2);

	type Tone = 'lime' | 'orange' | 'muted' | 'yellow';
	function status(d: PageData['deliveries'][number]): {
		label: string;
		detail?: string;
		tone: Tone;
	} {
		if (d.deliveredAt) return { label: 'Delivered', tone: 'lime' };
		if (d.failedAt) return { label: 'Gave up', detail: d.lastError ?? undefined, tone: 'orange' };
		if (d.attempts === 0) return { label: 'Sending', tone: 'muted' };
		return {
			label: 'Retrying',
			detail: `${d.lastError}, retries after ${at(d.nextAttemptAt)}`,
			tone: 'yellow'
		};
	}

	const tile = $derived(swatch(data.app.clientId));

	function confirmRemove(event: SubmitEvent) {
		if (!confirm('Remove this webhook?')) event.preventDefault();
	}

	const curl = $derived(`curl -u "$CLIENT_ID:$CLIENT_SECRET" ${data.directory.tokenUrl} \\
  -d grant_type=client_credentials \\
  -d scope="${data.directory.granted.join(' ')}" \\
  -d resource=${data.directory.resource}

curl -H "Authorization: Bearer $TOKEN" "${data.directory.apiUrl}?limit=100"`);
</script>

<svelte:head><title>{data.app.name} - Purdue Hackers ID</title></svelte:head>

<div class="flex enter flex-col gap-5">
	<BackLink href={resolve('/applications')}>Your apps</BackLink>
	<div class="flex items-center gap-5">
		<span class={['grid size-16 shrink-0 place-items-center sm:size-20', tile.bg, tile.fg]}>
			<Identicon seed={data.app.clientId} class="size-9 sm:size-11" />
		</span>
		<div class="flex min-w-0 flex-col gap-1.5">
			<h1 class="ph-headline text-5xl break-words sm:text-6xl">{data.app.name}</h1>
			<p class="font-mono text-[13px] break-all">{data.app.clientId}</p>
		</div>
	</div>
</div>

{#if form && 'message' in form}
	<Notice>{form.message}</Notice>
{:else if form && 'notice' in form}
	<Notice tone="success">{form.notice}</Notice>
{/if}

{#if form && 'secret' in form}
	<Secret
		seed={data.app.clientId}
		title="Signing secret"
		note="Copy it now as it will not be shown again."
		values={[{ label: 'webhook secret', value: form.secret as string }]}
	/>
{/if}

<Section title="Webhook">
	<form method="post" action="?/save" class="flex flex-col gap-7">
		<Field label="URL" for="webhook-url">
			<Input
				id="webhook-url"
				name="url"
				type="url"
				required
				placeholder="https://myapp.com/webhooks/purduehackers"
				value={form && 'url' in form ? form.url : (data.webhook?.url ?? '')}
				size="md"
				class="font-mono"
			/>
		</Field>

		<fieldset class="flex flex-col gap-3">
			<legend class="mb-3 ph-subheadline text-[12px]">Events</legend>
			{#each data.events as { type, description } (type)}
				<Checkbox name="event" value={type} checked={subscribed(type)}>
					<span class="font-mono font-semibold">{type}</span>
					{description}
				</Checkbox>
			{/each}
		</fieldset>

		<Button type="submit">{data.webhook ? 'Save' : 'Add webhook'}</Button>
	</form>

	{#if data.webhook}
		<div class="-ml-3 flex flex-wrap gap-1">
			<form method="post" action="?/test">
				<Button type="submit" variant="ghost" size="sm" icon="bolt">Send test event</Button>
			</form>
			<form method="post" action="?/rotate">
				<Button type="submit" variant="ghost" size="sm" icon="refresh">New secret</Button>
			</form>
			<form method="post" action="?/remove" onsubmit={confirmRemove}>
				<Button type="submit" variant="ghost" size="sm" icon="trash">Remove</Button>
			</form>
		</div>
	{/if}
</Section>

{#if data.webhook}
	<Section title="Recent deliveries">
		{#if data.deliveries.length === 0}
			<p>Nothing sent yet. Send a test event to see one land here.</p>
		{:else}
			<ul class="flex flex-col">
				{#each data.deliveries as delivery (delivery.id)}
					{@const state = status(delivery)}
					<li>
						<details class="group">
							<summary
								class="-mx-3 flex cursor-pointer list-none flex-col gap-1 px-3 py-3 hover:bg-foreground/[0.05] sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden"
							>
								<span class="flex flex-wrap items-center gap-x-3 gap-y-1">
									<Icon
										name="chevron-down"
										class="-rotate-90 transition-transform group-open:rotate-0"
									/>
									<span class="font-mono font-semibold">{delivery.type}</span>
									<Badge color={state.tone}>{state.label}</Badge>
									{#if state.detail}<span class="text-[13px]">{state.detail}</span>{/if}
								</span>
								<span class="shrink-0 pl-7 font-mono text-[13px] sm:pl-0">
									{at(delivery.createdAt)}
								</span>
							</summary>
							<div class="flex flex-col gap-2 pb-4">
								<p class="font-mono text-[13px]">{delivery.id}</p>
								<Code code={pretty(delivery.payload)} />
								{#if delivery.attempts > 0}
									<form method="post" action="?/resend">
										<input type="hidden" name="deliveryId" value={delivery.id} />
										<LinkButton>Send again</LinkButton>
									</form>
								{/if}
							</div>
						</details>
					</li>
				{/each}
			</ul>
		{/if}
	</Section>
{/if}

{#if data.app.confidential}
	<Section title="Directory access">
		{#snippet description()}
			With directory access the app sees every member. Requires admin approval.
		{/snippet}

		{#if data.directory.granted.length}
			<p class="flex flex-wrap items-center gap-2">
				<Badge color="lime">Granted</Badge>
				<span class="font-mono text-[13px]">{data.directory.granted.join(' ')}</span>
			</p>
		{:else if data.directory.requested.length && data.directory.decided}
			<Notice>An admin did not grant the access you asked for.</Notice>
		{:else if data.directory.requested.length}
			<p class="flex items-center gap-2">
				<Badge color="yellow">Waiting</Badge> for an admin to approve.
			</p>
		{/if}

		<form method="post" action="?/requestAccess" class="flex flex-col gap-3">
			{#each data.directory.scopes as { scope, description } (scope)}
				<Checkbox name="scope" value={scope} checked={data.directory.requested.includes(scope)}>
					<span class="font-mono font-semibold">{scope}</span>
					{description}
				</Checkbox>
			{/each}
			<Button type="submit" class="mt-2">
				{data.directory.requested.length ? 'Change request' : 'Ask for access'}
			</Button>
		</form>

		{#if data.directory.granted.length}
			<p>Get a token as the app itself (it lasts five minutes), then call the API with it:</p>
			<Code code={curl} />
			<p>
				Page with <span class="font-mono">cursor=next_cursor</span> until it is null. Filter by role
				with <span class="font-mono">role=organizer,alumni</span> or look someone up with
				<span class="font-mono">discord_id=…</span>.
			</p>
		{/if}
	</Section>
{/if}
