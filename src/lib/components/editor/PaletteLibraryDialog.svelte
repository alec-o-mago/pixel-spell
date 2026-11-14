<script lang="ts">
	import Plus from "@lucide/svelte/icons/plus";
	import Search from "@lucide/svelte/icons/search";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import {
		PALETTE_LIBRARY,
		type PaletteLibraryEntry,
	} from "$lib/editor/palette-library.js";

	let { open = $bindable(false) } = $props();

	const PREVIEW_LIMIT = 64;

	let query = $state("");
	let wasOpen = false;

	let filtered = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return PALETTE_LIBRARY;
		return PALETTE_LIBRARY.filter((entry) =>
			[entry.name, entry.author ?? "", entry.legal ?? ""].some((value) =>
				value.toLowerCase().includes(needle),
			),
		);
	});

	$effect(() => {
		if (!open) {
			wasOpen = false;
			return;
		}
		if (wasOpen) return;
		wasOpen = true;
		query = "";
	});

	function previewColors(colors: string[]): string[] {
		if (colors.length <= PREVIEW_LIMIT) return colors;
		const step = colors.length / PREVIEW_LIMIT;
		return Array.from(
			{ length: PREVIEW_LIMIT },
			(_, index) => colors[Math.floor(index * step)]!,
		);
	}

	function addPalette(entry: PaletteLibraryEntry): void {
		editor.importPalette(entry.name, entry.colors);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Palette library</Dialog.Title>
			<Dialog.Description>
				Add a palette to your workspace. Each Add creates an independent editable copy.
			</Dialog.Description>
		</Dialog.Header>

		<div class="grid gap-3">
			<div class="relative">
				<Search
					class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					bind:value={query}
					placeholder="Search palettes…"
					autocomplete="off"
					class="h-8 pl-8"
					aria-label="Search palettes"
				/>
			</div>

			<div class="flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
				<span>{filtered.length} palettes</span>
				<span>Hardware palettes are compatibility references.</span>
			</div>

			<div class="-mr-1 max-h-[55vh] overflow-y-auto pr-1">
				{#if filtered.length === 0}
					<p
						class="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground"
					>
						No palettes match “{query}”.
					</p>
				{:else}
					<ul class="grid gap-2">
						{#each filtered as entry (entry.id)}
							<li class="flex items-center gap-3 rounded-lg border p-3">
								<div class="min-w-0 flex-1 space-y-2">
									<div class="flex items-baseline justify-between gap-3">
										<span class="truncate text-sm font-medium">{entry.name}</span>
										<span
											class="shrink-0 text-[10px] tabular-nums text-muted-foreground"
										>
											{entry.colors.length} colors
										</span>
									</div>

									<div class="flex flex-wrap gap-0.5" aria-hidden="true">
										{#each previewColors(entry.colors) as color, index (color + index)}
											<span
												class="size-2.5 rounded-[2px] ring-1 ring-black/10"
												style:background={color}
											></span>
										{/each}
									</div>

									{#if entry.colors.length > PREVIEW_LIMIT}
										<p class="text-[10px] text-muted-foreground">
											+{entry.colors.length - PREVIEW_LIMIT} more colors
										</p>
									{/if}

									{#if entry.author || entry.legal}
										<p class="text-[10px] text-muted-foreground">
											{#if entry.author}By {entry.author}{/if}
											{#if entry.author && entry.legal} · {/if}
											{#if entry.legal}{entry.legal}{/if}
										</p>
									{/if}
								</div>

								<Button
									size="sm"
									variant="outline"
									class="shrink-0"
									aria-label={`Add ${entry.name} palette`}
									onclick={() => addPalette(entry)}
								>
									<Plus class="size-3.5" />
									Add
								</Button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Close</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
