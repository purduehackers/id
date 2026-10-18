<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import Section from '$lib/components/Section.svelte';
	import Badge from '$lib/components/ph/Badge.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import Icon from '$lib/components/ph/Icon.svelte';
	import Input from '$lib/components/ph/Input.svelte';
	import LinkButton from '$lib/components/ph/LinkButton.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const when = (value: string | Date | null) => (value ? new Date(value).toLocaleDateString() : '');
	const notice = $derived((form && 'notice' in form && form.notice) || data.notice);
</script>

<svelte:head><title>Account - Purdue Hackers ID</title></svelte:head>

{#if form?.message ?? data.error}
	<Notice>{form?.message ?? data.error}</Notice>
{:else if notice}
	<Notice tone="success">{notice}</Notice>
{/if}

<Section title="Email addresses">
	<ul class="border-t border-border">
		<li class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-3">
			<Icon name="envelope" />
			<span class="font-medium break-all">{data.user.email}</span>
			<Badge>Primary</Badge>
		</li>
		{#each data.emails as email (email.id)}
			<li class="flex flex-col gap-3 border-b border-border py-3">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<span class="flex flex-wrap items-center gap-x-3 gap-y-1">
						<Icon name="envelope" />
						<span class="font-medium break-all">{email.email}</span>
						{#if email.verifiedAt}
							<span class="font-mono text-[13px]">added {when(email.verifiedAt)}</span>
						{:else}
							<Badge color="orange">Not verified</Badge>
						{/if}
					</span>

					<span class="flex gap-2">
						{#if email.verifiedAt}
							<form method="post" action="?/makePrimary">
								<input type="hidden" name="id" value={email.id} />
								<Button type="submit" variant="outline" size="sm">Make primary</Button>
							</form>
						{/if}
						<form method="post" action="?/removeEmail">
							<input type="hidden" name="id" value={email.id} />
							<Button type="submit" variant="ghost" size="sm" icon="trash">Remove</Button>
						</form>
					</span>
				</div>

				{#if !email.verifiedAt}
					<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
						<form method="post" action="?/verifyEmail" class="flex gap-2">
							<input type="hidden" name="id" value={email.id} />
							<Input
								name="otp"
								inputmode="numeric"
								autocomplete="one-time-code"
								pattern="[0-9 ]*"
								maxlength={7}
								required
								placeholder="Code"
								aria-label="Code for {email.email}"
								class="w-32 font-mono tracking-[0.2em]"
							/>
							<Button type="submit">Verify</Button>
						</form>
						<form method="post" action="?/resendEmail">
							<input type="hidden" name="id" value={email.id} />
							<LinkButton>Send a new code</LinkButton>
						</form>
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	<form method="post" action="?/addEmail" class="flex gap-2">
		<Input
			name="email"
			type="email"
			required
			autocomplete="email"
			placeholder="another@example.com"
			aria-label="Another email address"
			value={form && 'email' in form ? (form.email ?? '') : ''}
			class="flex-1"
		/>
		<Button type="submit" icon="plus">Add</Button>
	</form>
</Section>

{#if data.passports.length}
	<Section title="Passports">
		{#snippet description()}
			Tapping {data.passports.length === 1 ? 'it' : 'one'} signs you in.
		{/snippet}
		<div class="flex flex-wrap gap-2">
			{#each data.passports as id (id)}
				<span
					class="flex items-center gap-2 border border-foreground px-3 py-2 font-mono text-[15px] font-semibold"
				>
					<Icon name="credit-card" />#{id}
				</span>
			{/each}
		</div>
	</Section>
{/if}

<Section title="Connected accounts">
	<ul class="border-t border-border">
		{#each data.connections as connection (connection.id)}
			<li class="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3">
				<span class="flex flex-wrap items-center gap-x-3 gap-y-1">
					{#if connection.id === 'discord' || connection.id === 'github'}
						<Icon name={connection.id} />
					{/if}
					<span class="font-medium">{connection.label}</span>
					{#if connection.accountId}
						<span class="font-mono text-[13px]">connected {when(connection.connectedAt)}</span>
					{:else}
						<span class="font-mono text-[13px]">not connected</span>
					{/if}
				</span>

				{#if connection.accountId}
					<form method="post" action="?/unlink">
						<input type="hidden" name="accountId" value={connection.accountId} />
						<Button type="submit" variant="outline" size="sm">Disconnect</Button>
					</form>
				{:else}
					<form method="post" action="?/link">
						<input type="hidden" name="provider" value={connection.id} />
						<Button type="submit" size="sm" icon="link">Connect</Button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
</Section>
