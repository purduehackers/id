<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let completeForm = $state<HTMLFormElement>();
	let expired = $state(false);

	$effect(() => {
		if (!data.code) return;
		const timer = setInterval(async () => {
			const { status } = await fetch(resolve('/passport/status')).then((r) => r.json());
			if (status === 'approved') {
				clearInterval(timer);
				completeForm?.requestSubmit();
			} else if (status === 'expired') {
				clearInterval(timer);
				expired = true;
			}
		}, 2000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head><title>Sign in with your passport - Purdue Hackers ID</title></svelte:head>

<main class="mx-auto max-w-sm px-4 py-16 font-serif text-gray-900">
	<h1 class="text-2xl">Sign in with your passport</h1>

	{#if form?.message}
		<p class="mt-4 text-red-700">{form.message}</p>
	{/if}

	{#if data.code && !expired}
		<p class="mt-1 text-gray-600">
			Tap your passport with your phone, then type this code on the phone:
		</p>
		<p class="mt-6 font-mono text-5xl tracking-widest">{data.code}</p>
		<p class="mt-6 text-sm text-gray-500">This page continues by itself once you approve it.</p>

		<div class="mt-6 flex gap-2">
			<form method="post" action="?/complete" bind:this={completeForm}>
				<input type="hidden" name="next" value={data.next} />
				<button class="border border-gray-900 bg-gray-900 px-3 py-1 text-white"
					>I approved it</button
				>
			</form>
			<form method="post" action="?/cancel">
				<input type="hidden" name="next" value={data.next} />
				<button class="border border-gray-900 px-3 py-1">Cancel</button>
			</form>
		</div>
	{:else}
		{#if expired}
			<p class="mt-4 text-red-700">That code expired. Start again.</p>
		{/if}
		<p class="mt-1 text-gray-600">Enter the number printed in your passport.</p>
		<form method="post" action="?/start" class="mt-6">
			<input type="hidden" name="next" value={data.next} />
			<label class="block">
				Passport number
				<input
					name="number"
					inputmode="numeric"
					pattern="[0-9]*"
					required
					value={form && 'number' in form ? form.number : ''}
					class="mt-1 block w-full border border-gray-400 px-2 py-1 font-mono text-lg"
				/>
			</label>
			<button class="mt-4 border border-gray-900 bg-gray-900 px-3 py-1 text-white">Continue</button>
		</form>
	{/if}

	<p class="mt-8 text-sm text-gray-500">
		<a href="{resolve('/login')}?next={encodeURIComponent(data.next)}" class="underline"
			>Sign in another way</a
		>
	</p>
</main>
