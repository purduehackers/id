<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const keep = $derived(
		`email=${encodeURIComponent(data.email)}&next=${encodeURIComponent(data.next)}`
	);
</script>

<svelte:head><title>Reset your password - Purdue Hackers ID</title></svelte:head>

<main class="mx-auto max-w-sm px-4 py-16 font-serif text-gray-900">
	<h1 class="text-2xl">Reset your password</h1>

	{#if data.email}
		<p class="mt-1 text-gray-600">
			If <span class="text-gray-900">{data.email}</span> has a Purdue Hackers ID, we sent it a six-digit
			code. It is good for ten minutes.
		</p>
	{:else}
		<p class="mt-1 text-gray-600">We will email you a code to set a new one.</p>
	{/if}

	{#if form?.message}
		<p class="mt-4 text-red-700">{form.message}</p>
	{:else if form && 'notice' in form}
		<p class="mt-4 text-green-700">{form.notice}</p>
	{/if}

	{#if data.email}
		<form method="post" action="?/reset&{keep}" class="mt-6">
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

			<label class="mt-3 block">
				New password
				<input
					name="password"
					type="password"
					required
					minlength="10"
					autocomplete="new-password"
					class="mt-1 block w-full border border-gray-400 px-2 py-1 font-sans"
				/>
			</label>

			<button class="mt-4 border border-gray-900 bg-gray-900 px-3 py-1 text-white">
				Set new password
			</button>
		</form>

		<form method="post" action="?/resend&{keep}" class="mt-8 text-gray-600">
			<input type="hidden" name="email" value={data.email} />
			Nothing arrived?
			<button class="underline">Send another code</button>
		</form>

		<p class="mt-8 text-sm text-gray-500">
			Wrong address? <a
				href="{resolve('/forgot')}?next={encodeURIComponent(data.next)}"
				class="underline">Start over</a
			>.
		</p>
	{:else}
		<form method="post" action="?/request&next={encodeURIComponent(data.next)}" class="mt-6">
			<input type="hidden" name="next" value={data.next} />

			<label class="block">
				Email
				<input
					name="email"
					type="email"
					required
					autocomplete="email"
					class="mt-1 block w-full border border-gray-400 px-2 py-1 font-sans"
				/>
			</label>

			<button class="mt-4 border border-gray-900 bg-gray-900 px-3 py-1 text-white">
				Send code
			</button>
		</form>

		<p class="mt-8 text-sm text-gray-500">
			Remembered it? <a
				href="{resolve('/login')}?next={encodeURIComponent(data.next)}"
				class="underline">Sign in</a
			>.
		</p>
	{/if}
</main>
