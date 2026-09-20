<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// A failed action re-runs `load` with the action URL, so the identifying
	// params have to ride along on it or the page loses track of who you are.
	const keep = $derived(
		`email=${encodeURIComponent(data.email)}&next=${encodeURIComponent(data.next)}`
	);
</script>

<svelte:head><title>Verify your email - Purdue Hackers ID</title></svelte:head>

<main class="mx-auto max-w-sm px-4 py-16 font-serif text-gray-900">
	<h1 class="text-2xl">Check your email</h1>
	<p class="mt-1 text-gray-600">
		We sent a six-digit code to <span class="text-gray-900">{data.email}</span>. It is good for ten
		minutes.
	</p>

	{#if form?.message}
		<p class="mt-4 text-red-700">{form.message}</p>
	{:else if form?.notice}
		<p class="mt-4 text-green-700">{form.notice}</p>
	{/if}

	<form method="post" action="?/verify&{keep}" class="mt-6">
		<input type="hidden" name="email" value={data.email} />
		<input type="hidden" name="next" value={data.next} />

		<label class="block">
			Code
			<input
				name="otp"
				inputmode="numeric"
				autocomplete="one-time-code"
				pattern="[0-9 ]*"
				maxlength="7"
				required
				class="mt-1 block w-full border border-gray-400 px-2 py-1 font-mono text-lg tracking-widest"
			/>
		</label>

		<button class="mt-4 border border-gray-900 bg-gray-900 px-3 py-1 text-white">Verify</button>
	</form>

	<form method="post" action="?/resend&{keep}" class="mt-8 text-gray-600">
		<input type="hidden" name="email" value={data.email} />
		Nothing arrived?
		<button class="underline">Send another code</button>
	</form>

	<p class="mt-8 text-sm text-gray-500">
		Wrong address? <a href="/login" class="underline">Start over</a>.
	</p>
</main>
