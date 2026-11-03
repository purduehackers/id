<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons';

	type Props = Omit<HTMLAnchorAttributes & HTMLButtonAttributes, 'type'> & {
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		variant?: 'solid' | 'outline' | 'ghost' | 'plain';
		size?: 'sm' | 'md' | 'lg';
		icon?: IconName;
		iconEnd?: IconName;
		children?: Snippet;
	};

	let {
		href,
		type = 'button',
		variant = 'solid',
		size = 'md',
		icon,
		iconEnd,
		class: className,
		children,
		...rest
	}: Props = $props();

	const variants = {
		solid: 'bg-foreground text-background hover:bg-primary hover:text-primary-foreground',
		outline: 'border border-foreground text-foreground hover:bg-foreground hover:text-background',
		ghost: 'text-foreground hover:bg-foreground/[0.08]',
		// Inherits the surrounding colour, for buttons on coloured blocks.
		plain: 'hover:bg-current/[0.12]'
	};
	const sizes = {
		sm: 'h-8 gap-1.5 px-3 text-[13px]',
		md: 'h-10 gap-2 px-4 text-[15px]',
		lg: 'h-[52px] gap-2.5 px-6 text-xl'
	};
</script>

<svelte:element
	this={href ? 'a' : 'button'}
	{href}
	type={href ? undefined : type}
	class={[
		'inline-flex w-fit shrink-0 cursor-pointer items-center justify-center font-mono font-semibold tracking-wide whitespace-nowrap uppercase no-underline transition-[color,background-color,transform] duration-150 ease-quint active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
		variants[variant],
		sizes[size],
		className
	]}
	{...rest}
>
	{#if icon}<Icon name={icon} />{/if}
	{@render children?.()}
	{#if iconEnd}<Icon name={iconEnd} />{/if}
</svelte:element>
