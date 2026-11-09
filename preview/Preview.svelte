<script lang="ts">
	import Scan from '../src/routes/scan/+page.svelte';
	const key = 'passport-flip-9907-a6e81d3b';
	const allowed = new URLSearchParams(location.search).get('secret') === key;
	let message = $state('');
</script>

{#if allowed}
	<div
		onsubmitcapture={(event) => {
			event.preventDefault();
			message = 'Preview only — no real account is signed in. Scan the tag again to replay.';
		}}
	>
		<Scan
			data={{
				entrance: true,
				tap: {
					passportId: 9907,
					owner: { name: 'Purdue Hacker', username: 'hacker' },
					returning: null
				},
				me: null,
				error: null
			}}
			form={null}
		/>
	</div>
	{#if message}<div
			class="rounded-lg fixed inset-x-4 bottom-4 z-[70] bg-ph-black p-4 text-center text-ph-cream"
			role="status"
		>
			{message}
		</div>{/if}
{:else}
	<main class="grid min-h-dvh place-content-center gap-4 p-8">
		<h1 class="ph-headline text-3xl">Passport animation preview</h1>
		<p>Open the secret preview URL from your NFC tag.</p>
	</main>
{/if}
