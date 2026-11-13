<script lang="ts">
	import { tick } from "svelte";
	import Search from "@lucide/svelte/icons/search";
	import { Input } from "$lib/components/ui/input/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { COMMANDS, type CommandDef } from "$lib/editor/commands.js";
	import { keybindings } from "$lib/editor/keybindings.svelte.js";

	let { open = $bindable(false) } = $props();

	let query = $state("");
	let selectedIndex = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);
	let itemEls = $state<(HTMLButtonElement | undefined)[]>([]);

	const visibleCommands = $derived.by(() =>
		COMMANDS.filter(
			(command) =>
				command.id !== "app.command-palette" &&
				(!command.enabled || command.enabled()),
		),
	);

	const matches = $derived.by(() => {
		const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
		if (tokens.length === 0) return visibleCommands;
		return visibleCommands.filter((command) => {
			const haystack = [
				command.label,
				command.group,
				command.description ?? "",
				command.keywords ?? "",
			]
				.join(" ")
				.toLowerCase();
			return tokens.every((token) => haystack.includes(token));
		});
	});

	const rows = $derived.by(() => {
		let previousGroup = "";
		return matches.map((command) => {
			const showGroup = command.group !== previousGroup;
			previousGroup = command.group;
			return { command, showGroup };
		});
	});

	$effect(() => {
		if (!open) return;
		query = "";
		selectedIndex = 0;
		void tick().then(() => inputEl?.focus());
	});

	$effect(() => {
		if (selectedIndex >= matches.length) {
			selectedIndex = Math.max(0, matches.length - 1);
		}
	});

	$effect(() => {
		const element = itemEls[selectedIndex];
		if (open && element) element.scrollIntoView({ block: "nearest" });
	});

	function shortcutLabel(command: CommandDef): string {
		return keybindings.primaryLabel(command.id);
	}

	function extraBindings(command: CommandDef): number {
		return Math.max(0, (keybindings.bindings[command.id]?.length ?? 0) - 1);
	}

	function moveSelection(delta: number): void {
		if (matches.length === 0) return;
		selectedIndex = (selectedIndex + delta + matches.length) % matches.length;
	}

	function execute(command: CommandDef): void {
		open = false;
		// Let the palette unmount before another dialog opens.
		window.setTimeout(() => command.run(), 0);
	}

	function handleInputKeydown(event: KeyboardEvent): void {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			moveSelection(1);
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			moveSelection(-1);
			return;
		}
		if (event.key === "Home") {
			event.preventDefault();
			selectedIndex = 0;
			return;
		}
		if (event.key === "End") {
			event.preventDefault();
			selectedIndex = Math.max(0, matches.length - 1);
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			const command = matches[selectedIndex];
			if (command) execute(command);
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			open = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="top-[15%] w-full max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
		showCloseButton={false}
	>
		<Dialog.Title class="sr-only">Command palette</Dialog.Title>
		<Dialog.Description class="sr-only">
			Search and run any Pixel Spell action.
		</Dialog.Description>

		<div class="flex items-center gap-2 border-b px-3">
			<Search class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<Input
				bind:ref={inputEl}
				bind:value={query}
				class="h-11 rounded-none border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
				placeholder="Type a command or search…"
				aria-label="Search commands"
				role="combobox"
				aria-expanded={true}
				aria-controls="command-palette-list"
				aria-autocomplete="list"
				onkeydown={handleInputKeydown}
				oninput={() => (selectedIndex = 0)}
			/>
		</div>

		<div
			id="command-palette-list"
			class="max-h-[min(24rem,60vh)] overflow-y-auto p-1.5"
			role="listbox"
			aria-label="Commands"
		>
			{#each rows as row, index (row.command.id)}
				{#if row.showGroup}
					<div
						class="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-1"
					>
						{row.command.group}
					</div>
				{/if}
				<button
					type="button"
					role="option"
					aria-selected={index === selectedIndex}
					tabindex="-1"
					bind:this={itemEls[index]}
					class={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors ${
						index === selectedIndex
							? "bg-accent text-accent-foreground"
							: "text-foreground"
					}`}
					onmouseenter={() => (selectedIndex = index)}
					onclick={() => execute(row.command)}
				>
					<span class="min-w-0 truncate">{row.command.label}</span>
					{#if shortcutLabel(row.command)}
						<span class="flex shrink-0 items-center gap-1">
							<kbd
								class="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
							>
								{shortcutLabel(row.command)}
							</kbd>
							{#if extraBindings(row.command) > 0}
								<span class="text-[10px] text-muted-foreground">
									+{extraBindings(row.command)}
								</span>
							{/if}
						</span>
					{/if}
				</button>
			{/each}

			{#if rows.length === 0}
				<p class="px-2 py-6 text-center text-sm text-muted-foreground">
					No matching commands.
				</p>
			{/if}
		</div>

		<div
			class="flex items-center justify-between gap-2 border-t bg-muted/40 px-3 py-1.5 text-[10px] text-muted-foreground"
		>
			<span>↑↓ to navigate · Enter to run · Esc to close</span>
			<span class="font-mono">
				{matches.length}
				{matches.length === 1 ? "command" : "commands"}
			</span>
		</div>
	</Dialog.Content>
</Dialog.Root>
