<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const when = (value: string | Date | null) => (value ? new Date(value).toLocaleDateString() : '');
</script>

<svelte:head><title>Account - Purdue Hackers ID</title></svelte:head>

{#if form?.message ?? data.error}
	<p class="mt-4 text-red-700">{form?.message ?? data.error}</p>
{:else if (form && 'notice' in form && form.notice) || data.notice}
	<p class="mt-4 text-green-700">{(form && 'notice' in form && form.notice) || data.notice}</p>
{/if}

<h2 class="mt-8 text-lg">Email addresses</h2>
<p class="mt-2 text-gray-600">
	You can sign in with any verified address and apps you authorize only see your primary one.
</p>

<ul class="mt-2">
	<li class="flex items-baseline justify-between gap-4 border-b border-gray-200 py-3">
		<span>
			{data.user.email}
			<span class="text-sm text-gray-500">primary</span>
		</span>
	</li>
	{#each data.emails as email (email.id)}
		<li class="border-b border-gray-200 py-3">
			<div class="flex items-baseline justify-between gap-4">
				<span>
					{email.email}
					{#if email.verifiedAt}
						<span class="text-sm text-gray-500">added {when(email.verifiedAt)}</span>
					{:else}
						<span class="text-sm text-amber-700">not verified</span>
					{/if}
				</span>

				<span class="flex gap-2">
					{#if email.verifiedAt}
						<form method="post" action="?/makePrimary">
							<input type="hidden" name="id" value={email.id} />
							<button class="border border-gray-900 px-3 py-1">Make primary</button>
						</form>
					{/if}
					<form method="post" action="?/removeEmail">
						<input type="hidden" name="id" value={email.id} />
						<button class="border border-gray-900 px-3 py-1">Remove</button>
					</form>
				</span>
			</div>

			{#if !email.verifiedAt}
				<div class="mt-2 flex items-baseline gap-2">
					<form method="post" action="?/verifyEmail" class="flex items-baseline gap-2">
						<input type="hidden" name="id" value={email.id} />
						<input
							name="otp"
							inputmode="numeric"
							autocomplete="one-time-code"
							pattern="[0-9 ]*"
							maxlength="7"
							required
							placeholder="Code"
							aria-label="Code for {email.email}"
							class="w-28 border border-gray-400 px-2 py-1 font-mono tracking-widest"
						/>
						<button class="border border-gray-900 bg-gray-900 px-3 py-1 text-white">Verify</button>
					</form>
					<form method="post" action="?/resendEmail">
						<input type="hidden" name="id" value={email.id} />
						<button class="text-gray-500 underline">Send a new code</button>
					</form>
				</div>
			{/if}
		</li>
	{/each}
</ul>

<form method="post" action="?/addEmail" class="mt-3 flex items-baseline gap-2">
	<input
		name="email"
		type="email"
		required
		autocomplete="email"
		placeholder="another@example.com"
		aria-label="Another email address"
		value={form && 'email' in form ? (form.email ?? '') : ''}
		class="min-w-0 flex-1 border border-gray-400 px-2 py-1 font-sans"
	/>
	<button class="border border-gray-900 bg-gray-900 px-3 py-1 text-white">Add</button>
</form>

{#if data.passports.length}
	<h2 class="mt-8 text-lg">Passports</h2>
	<p class="mt-2 text-gray-600">
		{data.passports.map((id) => `#${id}`).join(', ')}: tapping {data.passports.length === 1
			? 'it'
			: 'one'} signs you in.
	</p>
{/if}

<h2 class="mt-8 text-lg">Connected accounts</h2>

<ul class="mt-2">
	{#each data.connections as connection (connection.id)}
		<li class="flex items-baseline justify-between gap-4 border-b border-gray-200 py-3">
			<span>
				{connection.label}
				{#if connection.accountId}
					<span class="text-sm text-gray-500">connected {when(connection.connectedAt)}</span>
				{:else}
					<span class="text-sm text-gray-500">not connected</span>
				{/if}
			</span>

			{#if connection.accountId}
				<form method="post" action="?/unlink">
					<input type="hidden" name="accountId" value={connection.accountId} />
					<button class="border border-gray-900 px-3 py-1">Disconnect</button>
				</form>
			{:else}
				<form method="post" action="?/link">
					<input type="hidden" name="provider" value={connection.id} />
					<button class="border border-gray-900 bg-gray-900 px-3 py-1 text-white">Connect</button>
				</form>
			{/if}
		</li>
	{/each}
</ul>
