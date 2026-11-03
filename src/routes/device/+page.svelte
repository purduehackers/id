<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import DitherButton from '$lib/components/ph/DitherButton.svelte';
	import Field from '$lib/components/ph/Field.svelte';
	import Icon from '$lib/components/ph/Icon.svelte';
	import Input from '$lib/components/ph/Input.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Connect a device - Purdue Hackers ID</title></svelte:head>

<AuthShell>
	{#if form?.answered}
		<PageTitle title={form.answered === 'allowed' ? 'Device connected' : 'Request denied'}>
			You can close this page and go back to your device.
		</PageTitle>
	{:else if data.request}
		<PageTitle title="Authorize {data.request.clientName}">
			Only continue if your device shows the code
			<span class="bg-ph-yellow px-1 font-mono font-semibold text-ph-black"
				>{data.request.userCode}</span
			>. It is asking to:
		</PageTitle>

		<ul class="flex enter flex-col gap-1" style="--i: 1">
			{#each data.request.scopes as { scope, description } (scope)}
				<li class="flex items-start gap-3 py-1.5 text-[17px]">
					<Icon name="check" class="mt-1 text-primary" />
					{description}
				</li>
			{/each}
		</ul>

		{#if form?.message}
			<Notice>{form.message}</Notice>
		{/if}

		<form method="post" class="flex enter flex-wrap items-center gap-3" style="--i: 2">
			<input type="hidden" name="userCode" value={data.request.userCode} />
			<DitherButton type="submit" formaction="?/allow">Allow</DitherButton>
			<Button type="submit" variant="outline" size="lg" formaction="?/deny">Deny</Button>
		</form>
	{:else}
		<PageTitle title="Connect a device">Enter the code shown on your device.</PageTitle>

		{#if data.message}
			<Notice>{data.message}</Notice>
		{/if}

		<form method="get" class="flex enter flex-col gap-4" style="--i: 1">
			<Field label="Device code" for="user_code">
				<Input
					id="user_code"
					name="user_code"
					required
					autocomplete="off"
					autocapitalize="characters"
					spellcheck="false"
					value={data.userCode ?? ''}
					size="code"
					class="uppercase"
				/>
			</Field>
			<DitherButton type="submit" class="mt-2">Continue</DitherButton>
		</form>
	{/if}
</AuthShell>
