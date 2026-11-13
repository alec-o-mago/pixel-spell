<script lang="ts">
	import Plus from "@lucide/svelte/icons/plus";
	import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
	import Search from "@lucide/svelte/icons/search";
	import X from "@lucide/svelte/icons/x";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { COMMANDS, type CommandDef } from "$lib/editor/commands.js";
	import {
		comboFromEvent,
		formatCombo,
		keybindings,
	} from "$lib/editor/keybindings.svelte.js";

	let { open = $bindable(false) } = $props();

	let query = $state("");
	let capture = $state<{ commandId: string; index: number | null } | null>(null);
	let captureError = $state<string | null>(null);

	const MAX_BINDINGS = 3;

	const rows = $derived.by(() => {
		const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
		const matches = COMMANDS.filter((command) => {
			if (tokens.length === 0) return true;
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

		let previousGroup = "";
		return matches.map((command) => {
			const showGroup = command.group !== previousGroup;
			previousGroup = command.group;
			return { command, showGroup };
		});
	});

	$effect(() => {
		if (!open) {
			capture = null;
			captureError = null;
		}
	});

	function startCapture(commandId: string, index: number | null): void {
		const count = keybindings.bindings[commandId]?.length ?? 0;
		if (index === null && count >= MAX_BINDINGS) {
			capture = null;
			captureError = `Each action supports up to ${MAX_BINDINGS} shortcuts. Remove one first.`;
			return;
		}
		capture = { commandId, index };
		captureError = null;
	}

	function cancelCapture(): void {
		capture = null;
		captureError = null;
	}

	function removeBinding(commandId: string, index: number): void {
		keybindings.removeBinding(commandId, index);
		if (
			capture?.commandId === commandId &&
			(capture.index === index || capture.index === null)
		) {
			cancelCapture();
		}
	}

	function handleCaptureKeydown(event: KeyboardEvent): void {
		if (!capture) return;

		if (event.key === "Escape") {
			event.preventDefault();
			event.stopImmediatePropagation();
			cancelCapture();
			return;
		}

		const plainDelete =
			(event.key === "Backspace" || event.key === "Delete") &&
			!event.ctrlKey &&
			!event.metaKey &&
			!event.altKey &&
			!event.shiftKey;

		if (plainDelete) {
			event.preventDefault();
			event.stopImmediatePropagation();
			if (capture.index !== null) {
				keybindings.removeBinding(capture.commandId, capture.index);
			}
			cancelCapture();
			return;
		}

		const combo = comboFromEvent(event);
		if (!combo) {
			// Modifier-only key presses keep the capture open.
			event.preventDefault();
			event.stopImmediatePropagation();
			return;
		}

		event.preventDefault();
		event.stopImmediatePropagation();
		const conflict = keybindings.assign(
			capture.commandId,
			capture.index,
			combo,
		);
		if (conflict) {
			captureError = conflict;
			return;
		}
		cancelCapture();
	}

	function resetAll(): void {
		keybindings.resetAll();
		cancelCapture();
	}

	function bindingsFor(command: CommandDef): string[] {
		return keybindings.bindings[command.id] ?? [];
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-xl">
		<Dialog.Header>
			<Dialog.Title>Keyboard shortcuts</Dialog.Title>
			<Dialog.Description>
				Click a shortcut to rebind it, or use
				<kbd class="rounded border bg-muted px-1 font-mono text-[10px]">+</kbd>
				to add another. Changes are saved in this browser.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex items-center gap-2">
			<Search class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<Input
				bind:value={query}
				class="h-8"
				placeholder="Filter actions…"
				aria-label="Filter actions"
				onfocus={() => cancelCapture()}
			/>
		</div>

		{#if captureError}
			<p
				class="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
				role="alert"
			>
				{captureError}
			</p>
		{/if}

		<div class="-mr-1 max-h-[52vh] overflow-y-auto pr-1">
			{#each rows as row (row.command.id)}
				{#if row.showGroup}
					<h3
						class="mt-4 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:mt-0"
					>
						{row.command.group}
					</h3>
				{/if}
				<div
					class="flex min-h-8 items-center justify-between gap-3 rounded-md py-0.5 pl-1 pr-0.5 transition-colors"
					class:bg-accent={capture?.commandId === row.command.id}
				>
					<span class="min-w-0 truncate text-sm text-muted-foreground">
						{row.command.label}
					</span>

					<div class="flex shrink-0 flex-wrap items-center justify-end gap-1">
						{#each bindingsFor(row.command) as combo, index (combo)}
							<span
								class="inline-flex items-center overflow-hidden rounded border bg-muted"
							>
								<button
									type="button"
									class="px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
									title="Click, then press a new shortcut"
									onclick={() =>
										startCapture(row.command.id, index)}
								>
									{formatCombo(combo)}
								</button>
								<button
									type="button"
									class="grid h-5 w-4 place-items-center border-l text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
									title="Remove shortcut"
									aria-label={`Remove ${formatCombo(combo)} from ${row.command.label}`}
									onclick={() =>
										removeBinding(row.command.id, index)}
								>
									<X class="size-2.5" />
								</button>
							</span>
						{/each}

						{#if capture?.commandId === row.command.id}
							<kbd
								class="animate-pulse rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary"
							>
								Press keys…
							</kbd>
						{:else if bindingsFor(row.command).length < MAX_BINDINGS}
							<Button
								variant="ghost"
								size="icon-xs"
								class="text-muted-foreground"
								aria-label={`Add shortcut for ${row.command.label}`}
								title="Add shortcut"
								onclick={() => startCapture(row.command.id, null)}
							>
								<Plus class="size-3" />
							</Button>
						{/if}
					</div>
				</div>
			{/each}

			{#if rows.length === 0}
				<p class="py-6 text-center text-sm text-muted-foreground">
					No matching actions.
				</p>
			{/if}
		</div>

		<Dialog.Footer class="justify-between sm:justify-between">
			<Button variant="outline" onclick={resetAll}>
				<RotateCcw class="size-3.5" />
				Restore defaults
			</Button>
			<Button onclick={() => (open = false)}>Done</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<svelte:window onkeydowncapture={handleCaptureKeydown} />
