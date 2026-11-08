<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { ActionData, PageData } from './$types';
	import IdCard from '$lib/components/IdCard.svelte';
	import Identicon from '$lib/components/Identicon.svelte';
	import Row from '$lib/components/Row.svelte';
	import Section from '$lib/components/Section.svelte';
	import VisitDirectory from '$lib/components/VisitDirectory.svelte';
	import Badge from '$lib/components/ph/Badge.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import Field from '$lib/components/ph/Field.svelte';
	import Icon from '$lib/components/ph/Icon.svelte';
	import Input from '$lib/components/ph/Input.svelte';
	import Select from '$lib/components/ph/Select.svelte';
	import NameInput from '$lib/components/ph/NameInput.svelte';
	import LinkButton from '$lib/components/ph/LinkButton.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';
	import PhoneInput from '$lib/components/ph/PhoneInput.svelte';
	import { swatch } from '$lib/components/pixel';
	import { AVATAR_MAX_BYTES, PART_NAME_MAX_LENGTH, splitPhone } from '$lib/profile';
	import { SEMESTERS, SEMESTER_LABELS, termSemester, termYear } from '$lib/graduation';
	import { rolesOf } from '$lib/roles';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const when = (value: string | Date | null) => (value ? new Date(value).toLocaleDateString() : '');
	const notice = $derived((form && 'notice' in form && form.notice) || data.notice);
	const profileValue = (
		field:
			'firstName' | 'lastName' | 'phoneCountry' | 'phone' | 'graduationSemester' | 'graduationYear',
		fallback: string
	) => (form && 'profile' in form && form.profile ? form.profile[field] : fallback);

	const initialPhone = $derived(splitPhone(data.user.phone));

	let phoneCountry = $derived(profileValue('phoneCountry', initialPhone.country));
	let phoneNational = $derived(profileValue('phone', initialPhone.national));

	const tile = $derived(swatch(data.user.id));
	let pictureError = $state('');
	let uploadingPicture = $state(false);
	let pictureInput = $state<HTMLInputElement>();

	let passkeysSupported = $state<boolean | null>(null);
	let addingPasskey = $state(false);
	let passkeyAdded = $state(false);
	let passkeyError = $state('');
	let renaming = $state<string | null>(null);

	onMount(() => {
		passkeysSupported = 'PublicKeyCredential' in window;
		// The change event is lost if the file was chosen before hydration.
		if (pictureInput?.files?.length) uploadPicture();
	});

	async function shrinkPicture(file: File): Promise<File | null> {
		const bitmap = await createImageBitmap(file).catch(() => null);
		if (!bitmap) return null;
		const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(bitmap.width * scale);
		canvas.height = Math.round(bitmap.height * scale);
		canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		bitmap.close();
		const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/webp', 0.9));
		return blob && new File([blob], 'picture', { type: blob.type });
	}

	async function uploadPicture() {
		const input = pictureInput;
		const file = input?.files?.[0];
		if (!input || !file) return;

		pictureError = '';
		uploadingPicture = true;
		if (file.size > AVATAR_MAX_BYTES) {
			const smaller = await shrinkPicture(file);
			if (!smaller) {
				pictureError = 'We could not read that picture. Try a different one.';
				uploadingPicture = false;
				input.value = '';
				return;
			}
			const files = new DataTransfer();
			files.items.add(smaller);
			input.files = files.files;
		}
		input.form?.submit();
	}

	function restorePicture(event: PageTransitionEvent) {
		if (!event.persisted) return;
		uploadingPicture = false;
		if (pictureInput) pictureInput.value = '';
	}

	async function addPasskey() {
		addingPasskey = true;
		passkeyAdded = false;
		passkeyError = '';
		const { authClient, passkeyProblem } = await import('$lib/auth-client');
		const { error } = await authClient.passkey.addPasskey();
		if (error) {
			passkeyError = passkeyProblem(error) ?? '';
		} else {
			await invalidateAll();
			passkeyAdded = true;
		}
		addingPasskey = false;
	}

	function confirmRemovePasskey(event: SubmitEvent, name: string) {
		if (
			!confirm(
				`Remove ${name}? You will not be able to sign in with it, but your device may keep offering it until you delete it there too.`
			)
		) {
			event.preventDefault();
		}
	}
</script>

<svelte:head><title>Account - Purdue Hackers ID</title></svelte:head>
<svelte:window onpageshow={restorePicture} />

<h1 class="sr-only">Your account</h1>

<IdCard
	id={data.user.id}
	name={data.user.name}
	givenName={data.user.givenName}
	familyName={data.user.familyName}
	username={data.user.username ?? ''}
	image={data.user.image}
	email={data.user.email}
	phone={data.user.phone}
	roles={rolesOf(data.user)}
	graduationYear={data.user.graduationTerm === null ? null : termYear(data.user.graduationTerm)}
	since={data.user.createdAt}
	passports={data.passports}
	linked={data.connections.filter((c) => c.accountId).map((c) => c.label)}
/>

{#if form?.message ?? data.error}
	<Notice>{form?.message ?? data.error}</Notice>
{:else if notice}
	<Notice tone="success">{notice}</Notice>
{/if}

<Section title="Profile">
	{#snippet description()}
		Keep your details up to date. Apps you authorize and the Purdue Hackers directory only see what
		they have permission for.
	{/snippet}

	<div class="flex items-center gap-5">
		<span class={['grid size-16 shrink-0 place-items-center overflow-hidden', tile.bg, tile.fg]}>
			{#if data.user.image}
				<img src={data.user.image} alt="" class="size-full object-cover" />
			{:else}
				<Identicon seed={data.user.id} class="size-10" />
			{/if}
		</span>
		<form
			method="post"
			action="?/setPicture"
			enctype="multipart/form-data"
			class="flex items-center gap-2"
		>
			<label
				class={[
					'inline-flex h-8 cursor-pointer items-center bg-foreground px-3 font-mono text-[13px] font-semibold tracking-wide whitespace-nowrap text-background uppercase transition-colors duration-150 ease-quint focus-within:outline-2 focus-within:outline-offset-2 hover:bg-primary hover:text-primary-foreground',
					uploadingPicture && 'pointer-events-none opacity-40'
				]}
			>
				<input
					bind:this={pictureInput}
					id="profile-picture"
					name="picture"
					type="file"
					autocomplete="off"
					accept="image/jpeg,image/png,image/webp"
					onchange={uploadPicture}
					class="sr-only"
				/>
				{data.user.image ? 'Change picture' : 'Add picture'}
			</label>
			<noscript><Button type="submit" size="sm">Upload</Button></noscript>
		</form>
		{#if data.user.image}
			<form method="post" action="?/removePicture">
				<Button type="submit" variant="ghost" size="sm" icon="trash" aria-label="Remove picture" />
			</form>
		{/if}
	</div>
	{#if pictureError}<Notice>{pictureError}</Notice>{/if}

	<form method="post" action="?/updateProfile" class="flex flex-col gap-7">
		<div class="grid gap-7 sm:grid-cols-2">
			<Field label="First name" for="profile-first-name">
				<NameInput
					id="profile-first-name"
					name="firstName"
					required
					maxlength={PART_NAME_MAX_LENGTH}
					autocomplete="given-name"
					value={profileValue('firstName', data.user.givenName ?? '')}
				/>
			</Field>

			<Field label="Last name" for="profile-last-name">
				<NameInput
					id="profile-last-name"
					name="lastName"
					required
					maxlength={PART_NAME_MAX_LENGTH}
					autocomplete="family-name"
					value={profileValue('lastName', data.user.familyName ?? '')}
				/>
			</Field>
		</div>

		<div class="grid gap-7 sm:grid-cols-2">
			<Field label="Phone number" for="profile-phone" optional>
				<PhoneInput
					id="profile-phone"
					name="phone"
					countryName="phoneCountry"
					bind:country={phoneCountry}
					bind:value={phoneNational}
				/>
			</Field>

			<Field label="Graduation" for="profile-graduation-semester" optional>
				<div class="flex items-end gap-3">
					<Select
						id="profile-graduation-semester"
						name="graduationSemester"
						aria-label="Graduation semester"
						value={profileValue(
							'graduationSemester',
							data.user.graduationTerm === null ? '' : termSemester(data.user.graduationTerm)
						)}
						class="w-32"
					>
						<option value="">Semester</option>
						{#each SEMESTERS as semester (semester)}
							<option value={semester}>{SEMESTER_LABELS[semester]}</option>
						{/each}
					</Select>
					<Input
						name="graduationYear"
						aria-label="Graduation year"
						inputmode="numeric"
						pattern="[0-9][0-9][0-9][0-9]"
						maxlength={4}
						placeholder="2027"
						value={profileValue(
							'graduationYear',
							data.user.graduationTerm === null ? '' : String(termYear(data.user.graduationTerm))
						)}
						class="font-mono"
					/>
				</div>
			</Field>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<Button type="submit">Save profile</Button>
			<VisitDirectory />
		</div>
	</form>
</Section>

<Section title="Email addresses">
	<ul class="flex flex-col">
		<Row icon="envelope">
			{#snippet title()}
				{data.user.email}
				<Badge>Primary</Badge>
				{#if !data.user.emailVerified}<Badge color="orange">Not verified</Badge>{/if}
			{/snippet}
			{#snippet meta()}Apps you authorize see this one{/snippet}
		</Row>
		{#each data.emails as email (email.id)}
			<Row icon="envelope">
				{#snippet title()}
					{email.email}
					{#if !email.verifiedAt}<Badge color="orange">Not verified</Badge>{/if}
				{/snippet}
				{#snippet meta()}
					{email.verifiedAt ? `Added ${when(email.verifiedAt)}` : 'Check your inbox for a code'}
				{/snippet}
				{#snippet actions()}
					{#if email.verifiedAt}
						<form method="post" action="?/makePrimary">
							<input type="hidden" name="id" value={email.id} />
							<Button type="submit" variant="ghost" size="sm" icon="star">Make primary</Button>
						</form>
					{/if}
					<form method="post" action="?/removeEmail">
						<input type="hidden" name="id" value={email.id} />
						<Button
							type="submit"
							variant="ghost"
							size="sm"
							icon="trash"
							aria-label="Remove {email.email}"
						/>
					</form>
				{/snippet}
				{#if !email.verifiedAt}
					<div class="flex flex-wrap items-end gap-x-5 gap-y-2">
						<form method="post" action="?/verifyEmail" class="flex items-end gap-3">
							<input type="hidden" name="id" value={email.id} />
							<Input
								name="otp"
								size="sm"
								inputmode="numeric"
								autocomplete="one-time-code"
								pattern="[0-9 ]*"
								maxlength={7}
								required
								placeholder="000000"
								aria-label="Code for {email.email}"
								class="w-32 font-mono tracking-[0.3em]"
							/>
							<Button type="submit" size="sm">Verify</Button>
						</form>
						<form method="post" action="?/resendEmail" class="pb-1.5">
							<input type="hidden" name="id" value={email.id} />
							<LinkButton>Send a new code</LinkButton>
						</form>
					</div>
				{/if}
			</Row>
		{/each}
	</ul>

	<form method="post" action="?/addEmail" class="flex items-end gap-3 pl-15">
		<Input
			name="email"
			type="email"
			required
			autocomplete="email"
			placeholder="Add another address"
			aria-label="Another email address"
			value={form && 'email' in form ? (form.email ?? '') : ''}
			class="flex-1"
		/>
		<Button type="submit" icon="plus">Add</Button>
	</form>
</Section>

<Section title="Passkeys">
	{#snippet description()}
		Sign in with your fingerprint, face or screen lock instead of your password.
	{/snippet}

	{#if data.passkeys.length}
		<ul class="flex flex-col">
			{#each data.passkeys as passkey (passkey.id)}
				{@const name = passkey.name || 'Passkey'}
				<Row icon="lock">
					{#snippet title()}{name}{/snippet}
					{#snippet meta()}
						{[
							passkey.createdAt && `Added ${when(passkey.createdAt)}`,
							passkey.backedUp ? 'Synced' : 'On one device'
						]
							.filter(Boolean)
							.join(' · ')}
					{/snippet}
					{#snippet actions()}
						<Button
							variant="ghost"
							size="sm"
							icon="edit"
							aria-label="Rename {name}"
							onclick={() => (renaming = renaming === passkey.id ? null : passkey.id)}
						/>
						<form
							method="post"
							action="?/removePasskey"
							onsubmit={(event) => confirmRemovePasskey(event, name)}
						>
							<input type="hidden" name="id" value={passkey.id} />
							<Button
								type="submit"
								variant="ghost"
								size="sm"
								icon="trash"
								aria-label="Remove {name}"
							/>
						</form>
					{/snippet}
					{#if renaming === passkey.id}
						<form method="post" action="?/renamePasskey" class="flex items-end gap-3">
							<input type="hidden" name="id" value={passkey.id} />
							<Input
								name="name"
								size="sm"
								required
								maxlength={64}
								value={passkey.name ?? ''}
								aria-label="New name for {name}"
								class="flex-1"
							/>
							<Button type="submit" size="sm">Save</Button>
						</form>
					{/if}
				</Row>
			{/each}
		</ul>
	{/if}

	{#if passkeyError}
		<Notice>{passkeyError}</Notice>
	{:else if passkeyAdded}
		<Notice tone="success">Passkey added. You can use it next time you sign in.</Notice>
	{/if}

	{#if passkeysSupported}
		<Button icon="plus" disabled={addingPasskey} onclick={addPasskey}>Add a passkey</Button>
	{:else if passkeysSupported === false}
		<p>This browser cannot use passkeys.</p>
	{/if}
</Section>

<Section title="Security emails">
	{#snippet description()}
		We email you when your account signs in from a new place or an app gets new access to it.
	{/snippet}

	<form method="post" action="?/setSecurityEmails">
		<input type="hidden" name="enabled" value={data.securityEmails ? 'false' : 'true'} />
		<Button type="submit">{data.securityEmails ? 'Turn off' : 'Turn on'}</Button>
	</form>
</Section>

{#if data.passports.length}
	<Section title="Passports">
		{#snippet description()}
			Tap {data.passports.length === 1 ? 'it' : 'one'} with your phone to sign in anywhere.
		{/snippet}
		<ul class="flex flex-wrap gap-3">
			{#each data.passports as id, i (id)}
				<li
					class="flex h-24 w-40 enter flex-col justify-between bg-foreground p-3 text-background"
					style="--i: {i}"
				>
					<Icon name="credit-card" class="size-5" />
					<span class="ph-headline text-4xl">#{id}</span>
				</li>
			{/each}
		</ul>
	</Section>
{/if}

<Section title="Connected accounts">
	<ul class="flex flex-col">
		{#each data.connections as connection (connection.id)}
			<Row icon={connection.id}>
				{#snippet title()}
					{connection.label}
				{/snippet}
				{#snippet meta()}
					{connection.accountId ? `Connected ${when(connection.connectedAt)}` : 'Not connected'}
				{/snippet}
				{#snippet actions()}
					{#if connection.accountId}
						<form method="post" action="?/unlink">
							<input type="hidden" name="accountId" value={connection.accountId} />
							<Button type="submit" variant="ghost" size="sm">Disconnect</Button>
						</form>
					{:else}
						<form method="post" action="?/link">
							<input type="hidden" name="provider" value={connection.id} />
							<Button type="submit" size="sm" iconEnd="arrow-right">Connect</Button>
						</form>
					{/if}
				{/snippet}
			</Row>
		{/each}
	</ul>
</Section>
