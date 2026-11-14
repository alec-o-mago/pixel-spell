<script lang="ts">
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import {
		Button,
		buttonVariants,
	} from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import {
		MAX_CANVAS_SIZE,
		MIN_CANVAS_SIZE,
	} from "$lib/editor/canvas.js";
	import {
		CANVAS_SIZE_PRESETS,
		RETRO_CANVAS_PRESETS,
		SQUARE_CANVAS_PRESETS,
		type CanvasSizePreset,
	} from "$lib/editor/canvas-presets.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import type { BackgroundKind } from "$lib/editor/types.js";
	import { cn } from "$lib/utils.js";

	let { open = $bindable(false) } = $props();

	const backgrounds: { id: BackgroundKind; label: string; swatch: string }[] = [
		{ id: "transparent", label: "Transparent", swatch: "alpha-checker" },
		{ id: "white", label: "White", swatch: "bg-white" },
		{ id: "black", label: "Black", swatch: "bg-black" },
	];
	let name = $state("");
	let width = $state(32);
	let height = $state(32);
	let background = $state<BackgroundKind>("transparent");
	let wasOpen = false;

	let selectedPreset = $derived(
		CANVAS_SIZE_PRESETS.find(
			(preset) => preset.width === width && preset.height === height,
		) ?? null,
	);
	let sizeLabel = $derived(
		selectedPreset
			? `${selectedPreset.width}×${selectedPreset.height}`
			: Number.isFinite(width) && Number.isFinite(height)
				? `${width}×${height}`
				: "Custom",
	);
	let nameLabel = $derived(selectedPreset?.name ?? "Custom size");

	$effect(() => {
		if (!open) {
			wasOpen = false;
			return;
		}
		if (wasOpen) return;
		wasOpen = true;
		name = "";
		width = editor.doc.width;
		height = editor.doc.height;
		background = "transparent";
	});

	function applyPreset(preset: CanvasSizePreset): void {
		width = preset.width;
		height = preset.height;
	}

	function create(): void {
		const w = Number.isFinite(width) ? width : 32;
		const h = Number.isFinite(height) ? height : 32;
		editor.newProject(w, h, { name, background });
		open = false;
	}
</script>

{#snippet sizeItem(preset: CanvasSizePreset)}
	<DropdownMenu.Item
		class={cn(
			"justify-between gap-4",
			selectedPreset?.id === preset.id && "bg-accent text-accent-foreground",
		)}
		onSelect={() => applyPreset(preset)}
	>
		<span class="tabular-nums">{preset.width}×{preset.height}</span>
		<span
			class="min-w-0 truncate text-right text-xs text-muted-foreground"
			title={preset.name}
		>
			{preset.name}
		</span>
	</DropdownMenu.Item>
{/snippet}

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>New project</Dialog.Title>
			<Dialog.Description>
				Name your project, pick a canvas size, and choose how the canvas starts. Small sizes
				are your friend.
			</Dialog.Description>
		</Dialog.Header>

		<div class="grid gap-4 py-1">
			<div class="grid gap-1.5">
				<Label for="new-name">Name</Label>
				<Input
					id="new-name"
					bind:value={name}
					maxlength={60}
					placeholder="Untitled"
					autocomplete="off"
				/>
			</div>

			<div class="grid gap-1.5">
				<Label for="new-canvas-size">Canvas size</Label>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						id="new-canvas-size"
						class={cn(
							buttonVariants({ variant: "outline", size: "default" }),
							"w-full justify-between font-normal",
						)}
						aria-label={`Canvas size: ${sizeLabel} ${nameLabel}`}
					>
						<span class="tabular-nums">{sizeLabel}</span>
						<span class="flex min-w-0 items-center gap-2">
							<span class="truncate text-xs text-muted-foreground">{nameLabel}</span>
							<ChevronDown class="size-4 shrink-0 text-muted-foreground" />
						</span>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content class="max-h-80" align="start">
						<DropdownMenu.Label>Square sizes</DropdownMenu.Label>
						{#each SQUARE_CANVAS_PRESETS as preset (preset.id)}
							{@render sizeItem(preset)}
						{/each}
						<DropdownMenu.Separator />
						<DropdownMenu.Label>Retro hardware</DropdownMenu.Label>
						{#each RETRO_CANVAS_PRESETS as preset (preset.id)}
							{@render sizeItem(preset)}
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="grid gap-1.5">
					<Label for="new-width">Width</Label>
					<Input
						id="new-width"
						type="number"
						min={MIN_CANVAS_SIZE}
						max={MAX_CANVAS_SIZE}
						bind:value={width}
						class="tabular-nums"
					/>
				</div>
				<div class="grid gap-1.5">
					<Label for="new-height">Height</Label>
					<Input
						id="new-height"
						type="number"
						min={MIN_CANVAS_SIZE}
						max={MAX_CANVAS_SIZE}
						bind:value={height}
						class="tabular-nums"
					/>
				</div>
			</div>

			<div class="grid gap-2">
				<span class="text-xs font-medium">Background</span>
				<div class="grid grid-cols-3 gap-2" role="group" aria-label="Background">
					{#each backgrounds as option (option.id)}
						<Button
							variant={background === option.id ? "default" : "outline"}
							size="sm"
							class="h-auto flex-col gap-1.5 py-2"
							onclick={() => (background = option.id)}
							aria-pressed={background === option.id}
						>
							<span
								class="size-5 rounded-sm border {option.swatch}"
								style={option.id === "transparent"
									? "background-size: 6px 6px"
									: undefined}
								aria-hidden="true"
							></span>
							<span class="text-[10px]">{option.label}</span>
						</Button>
					{/each}
				</div>
			</div>

			<p class="text-xs text-muted-foreground">
				Canvas size can be between {MIN_CANVAS_SIZE} and {MAX_CANVAS_SIZE} pixels. This opens
				a new project tab and keeps the current project open. Leave the name blank to use the
				next Untitled name.
			</p>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button onclick={create}>Create project</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
