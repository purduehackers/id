<script lang="ts">
	import PassportCover from '../src/lib/components/PassportCover.svelte';
	import Button from '../src/lib/components/ph/Button.svelte';
	import Notice from '../src/lib/components/ph/Notice.svelte';
	import Scan from '../src/routes/scan/+page.svelte';
	const key = 'passport-flip-9907-a6e81d3b';
	const params = new URLSearchParams(location.search);
	const allowed = params.get('secret') === key;
	const coverOnly = params.get('view') === 'cover';
	let message = $state('');
</script>

{#if allowed && coverOnly}
	<main
		class="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col justify-center gap-8 px-6 py-12"
	>
		<h1 class="ph-headline text-3xl">Passport cover</h1>
		<div class="aspect-[85.6/53.98] w-full"><PassportCover /></div>
		<Button href={`/?secret=${key}`} variant="outline" class="self-start">Play the opening</Button>
	</main>
{:else if allowed}
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
					returning: null,
					card: {
						id: 'preview-holder',
						name: 'Purdue Hacker',
						givenName: 'Purdue',
						familyName: 'Hacker',
						username: 'hacker',
						email: 'hacker@example.invalid',
						image: null,
						phone: '+17655550107',
						roles: [],
						graduationYear: 2028,
						since: '2024-08-23T12:00:00Z',
						passports: [9907],
						linked: ['Discord', 'GitHub']
					}
				},
				me: null,
				error: null
			}}
			form={null}
		/>
	</div>
	{#if message}<div
			class="fixed inset-x-4 bottom-4 z-[70] bg-ph-black p-4 text-center text-ph-cream"
		>
			<Notice tone="info">{message}</Notice>
		</div>{/if}
{:else}
	<main class="grid min-h-dvh place-content-center gap-4 p-8">
		<h1 class="ph-headline text-3xl">Passport animation preview</h1>
		<p>Open the secret preview URL from your NFC tag.</p>
	</main>
{/if}
