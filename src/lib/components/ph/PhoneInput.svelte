<script lang="ts" module>
	import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
	import { primaryPhoneCountry } from '$lib/profile';

	const FLAG_PATH = '/node_modules/country-flag-icons/3x2';
	const flags = import.meta.glob<string>('/node_modules/country-flag-icons/3x2/*.svg', {
		query: '?url&no-inline',
		import: 'default',
		eager: true
	});

	const ALIASES: Partial<Record<CountryCode, string>> = {
		AE: 'uae emirates',
		CZ: 'czech republic',
		GB: 'uk britain england scotland wales',
		KR: 'korea',
		KP: 'korea',
		NL: 'holland',
		TR: 'turkey',
		US: 'usa america'
	};

	const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

	const names = new Intl.DisplayNames(['en'], { type: 'region' });

	const COUNTRIES = getCountries()
		.map((code) => {
			const name = names.of(code) ?? code;
			return {
				code,
				name,
				dial: getCountryCallingCode(code) as string,
				flag: flags[`${FLAG_PATH}/${code}.svg`],
				folded: fold(name),
				aliases: ALIASES[code] ?? ''
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name, 'en'));

	type Country = (typeof COUNTRIES)[number];

	function rank(country: Country, query: string): number {
		const digits = query.replace(/^\+/, '');
		if (/^\d+$/.test(digits)) {
			if (country.dial === digits) return primaryPhoneCountry(digits) === country.code ? 0 : 1;
			return country.dial.startsWith(digits) ? 2 : -1;
		}
		if (query.startsWith('+')) return -1;
		const aliases = country.aliases.split(' ');
		if (country.code.toLowerCase() === query || aliases.includes(query)) return 0;
		if (country.folded.startsWith(query)) return 1;
		if (country.folded.includes(` ${query}`)) return 2;
		if (aliases.some((alias) => alias.startsWith(query))) return 2;
		return country.folded.includes(query) ? 3 : -1;
	}

	function search(rawQuery: string): Country[] {
		const query = fold(rawQuery.trim());
		if (!query) return COUNTRIES;
		return COUNTRIES.map((country) => ({ country, score: rank(country, query) }))
			.filter(({ score }) => score >= 0)
			.sort((a, b) => a.score - b.score)
			.map(({ country }) => country);
	}

	function caretAfterDigits(text: string, digits: number): number {
		if (digits === 0) return 0;
		let seen = 0;
		for (let i = 0; i < text.length; i++) {
			if (/\d/.test(text[i]) && ++seen === digits) return i + 1;
		}
		return text.length;
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { getExampleNumber } from 'libphonenumber-js';
	import examples from 'libphonenumber-js/mobile/examples';
	import { DEFAULT_PHONE_COUNTRY, formatNationalPhone, parsePhoneInput } from '$lib/profile';
	import Icon from './Icon.svelte';
	import Input from './Input.svelte';

	type Props = {
		id: string;
		name: string;
		countryName: string;
		country: string;
		value: string;
	};

	let { id, name, countryName, country = $bindable(), value = $bindable() }: Props = $props();

	let open = $state(false);
	let query = $state('');
	let active = $state(0);
	let root = $state<HTMLElement>();
	let trigger = $state<HTMLButtonElement>();
	let searchInput = $state<HTMLInputElement>();

	const selected = $derived(
		COUNTRIES.find((entry) => entry.code === country) ??
			COUNTRIES.find((entry) => entry.code === DEFAULT_PHONE_COUNTRY)!
	);
	const placeholder = $derived(
		getExampleNumber(selected.code, examples)?.formatNational() ?? undefined
	);
	const results = $derived(search(query));
	const listId = $derived(`${id}-countries`);
	const optionId = (code: string) => `${id}-country-${code}`;

	$effect(() => {
		if (!open) return;
		const code = results[active]?.code;
		if (code) document.getElementById(optionId(code))?.scrollIntoView({ block: 'nearest' });
	});

	async function openPicker(initialQuery = '') {
		query = initialQuery;
		active = initialQuery ? 0 : Math.max(0, COUNTRIES.indexOf(selected));
		open = true;
		await tick();
		searchInput?.focus();
	}

	function choose(entry: Country) {
		country = entry.code;
		value = formatNationalPhone(value, entry.code);
		open = false;
		document.getElementById(id)?.focus();
	}

	function onTriggerKeydown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
			event.preventDefault();
			openPicker();
		} else if (event.key.length === 1 && event.key !== ' ') {
			event.preventDefault();
			openPicker(event.key);
		}
	}

	function onSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (results.length === 0) return;
			const step = event.key === 'ArrowDown' ? 1 : -1;
			active = (active + step + results.length) % results.length;
		} else if (event.key === 'Enter') {
			event.preventDefault();
			if (results[active]) choose(results[active]);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			open = false;
			trigger?.focus();
		}
	}

	function onFocusOut(event: FocusEvent) {
		if (!root?.contains(event.relatedTarget as Node | null)) open = false;
	}

	function onPhoneInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const caret = input.selectionStart ?? input.value.length;
		const atEnd = caret === input.value.length;
		const digitsBeforeCaret = input.value.slice(0, caret).replace(/\D/g, '').length;

		const parsed = parsePhoneInput(input.value, country);
		country = parsed.country;
		value = parsed.national;
		input.value = parsed.national;

		const next = atEnd
			? parsed.national.length
			: caretAfterDigits(parsed.national, digitsBeforeCaret);
		input.setSelectionRange(next, next);
	}
</script>

<div class="flex items-end gap-3">
	<div bind:this={root} class="relative shrink-0" onfocusout={onFocusOut}>
		<input type="hidden" name={countryName} value={selected.code} />
		<button
			bind:this={trigger}
			type="button"
			aria-haspopup="listbox"
			aria-expanded={open}
			aria-label="Country: {selected.name}, +{selected.dial}"
			onclick={() => (open ? (open = false) : openPicker())}
			onkeydown={onTriggerKeydown}
			class="flex h-12 cursor-pointer items-center gap-2 border-0 border-b border-input bg-transparent font-mono text-lg text-foreground transition-[border-color,box-shadow] duration-150 outline-none hover:border-foreground/60 focus:border-foreground focus:shadow-[0_1px_0_0_var(--foreground)] focus-visible:outline-none"
		>
			<img src={selected.flag} alt="" width="24" height="16" class="h-4 w-6 shrink-0" />
			<span>+{selected.dial}</span>
			<Icon name="chevron-down" />
		</button>

		{#if open}
			<div
				class="absolute top-full left-0 z-50 mt-1 flex w-[min(20rem,calc(100vw-2rem))] flex-col border border-input bg-background shadow-lg"
			>
				<div class="flex items-center gap-2 border-b border-input px-3">
					<Icon name="search" class="text-foreground/60" />
					<input
						bind:this={searchInput}
						bind:value={query}
						oninput={() => (active = 0)}
						onkeydown={onSearchKeydown}
						type="text"
						role="combobox"
						aria-label="Search countries"
						aria-expanded="true"
						aria-autocomplete="list"
						aria-controls={listId}
						aria-activedescendant={results[active] ? optionId(results[active].code) : undefined}
						autocomplete="off"
						spellcheck="false"
						placeholder="Country or code"
						class="h-10 w-full min-w-0 border-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-foreground/35 focus-visible:outline-none"
					/>
				</div>
				<div
					id={listId}
					role="listbox"
					tabindex="-1"
					aria-label="Countries"
					onmousedown={(event) => event.preventDefault()}
					class="max-h-64 overflow-y-auto overscroll-contain"
				>
					{#each results as entry, index (entry.code)}
						<button
							id={optionId(entry.code)}
							type="button"
							role="option"
							tabindex="-1"
							aria-selected={entry.code === selected.code}
							onclick={() => choose(entry)}
							onpointermove={() => (active = index)}
							class={[
								'flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[15px]',
								index === active && 'bg-foreground/10'
							]}
						>
							<img
								src={entry.flag}
								alt=""
								loading="lazy"
								width="24"
								height="16"
								class="h-4 w-6 shrink-0"
							/>
							<span class="min-w-0 flex-1 truncate">{entry.name}</span>
							<span class="shrink-0 font-mono text-[13px] text-foreground/60">+{entry.dial}</span>
							{#if entry.code === selected.code}
								<Icon name="check" class="size-3.5" />
							{/if}
						</button>
					{:else}
						<p class="px-3 py-3 text-[13px] text-foreground/60">No countries match.</p>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<Input
		{id}
		{name}
		type="tel"
		autocomplete="tel-national"
		{placeholder}
		{value}
		oninput={onPhoneInput}
		class="flex-1 font-mono"
	/>
</div>
