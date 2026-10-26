<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const pretty = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

	$effect(() => {
		if (!data.code || data.approvedAs) return;
		const timer = setInterval(async () => {
			const { status } = await fetch(resolve('/passport/status')).then((r) => r.json());
			if (status !== 'pending') {
				clearInterval(timer);
				await invalidateAll();
			}
		}, 2000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head><title>Sign in with your passport - Purdue Hackers ID</title></svelte:head>

<main class="mx-auto max-w-sm px-4 py-16 font-serif text-gray-900">
	<h1 class="text-2xl">Sign in with your passport</h1>

	{#if form?.message ?? data.error}
		<p class="mt-4 text-red-700">{form?.message ?? data.error}</p>
	{/if}

	{#if data.approvedAs}
		<p class="mt-1 text-gray-600">Your phone approved this sign-in.</p>
		<form method="post" action="?/complete" class="mt-6">
			<input type="hidden" name="next" value={data.next} />
			<button class="border border-gray-900 bg-gray-900 px-3 py-1 text-white">
				Continue as @{data.approvedAs.username}
			</button>
		</form>
		<form method="post" action="?/cancel" class="mt-4 text-sm text-gray-600">
			<input type="hidden" name="next" value={data.next} />
			Not you? <button class="underline">Start over</button>
		</form>
	{:else if data.code}
		<p class="mt-1 text-gray-600">Tap your passport with your phone, then type this code there:</p>
		<p class="mt-6 font-mono text-5xl tracking-widest">{pretty(data.code)}</p>
		<p class="mt-6 text-sm text-gray-500">This page updates by itself once you approve it.</p>
		<form method="post" action="?/cancel" class="mt-4 text-sm text-gray-600">
			<input type="hidden" name="next" value={data.next} />
			<button class="underline">Get a new code</button>
		</form>
	{/if}

	<p class="mt-8 text-sm text-gray-500">
		<a href="{resolve('/login')}?next={encodeURIComponent(data.next)}" class="underline"
			>Sign in another way</a
		>
	</p>
</main>
