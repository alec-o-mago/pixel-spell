<script lang="ts">
	import ArrowLeftRight from "@lucide/svelte/icons/arrow-left-right";
	import PaletteIcon from "@lucide/svelte/icons/palette";
	import Pencil from "@lucide/svelte/icons/pencil";
	import Plus from "@lucide/svelte/icons/plus";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import X from "@lucide/svelte/icons/x";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import {
		colorWithAlpha,
		hexToRgb,
		hsvToRgb,
		normalizeHex,
		rgbToHex,
		rgbToHsv,
	} from "$lib/editor/color.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import { MAX_PALETTE_COLORS } from "$lib/editor/palette.js";
	import type { ColorSlot } from "$lib/editor/types.js";
	import { cn } from "$lib/utils.js";

	const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

	const HUE_TRACK =
		"linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)";

	let svArea: HTMLDivElement | undefined;
	let draggingSv = false;

	let hexDraft = $state(editor.primaryColor);
	let hexFocused = $state(false);

	let hue = $state(0);
	let saturation = $state(0);
	let value = $state(0);
	let syncedHex = "";

	let slot = $derived(editor.activeColorSlot);
	let activeHex = $derived(slot === "primary" ? editor.primaryColor : editor.secondaryColor);
	let activeAlpha = $derived(slot === "primary" ? editor.alpha : editor.secondaryAlpha);
	let alphaPercent = $derived(Math.round((activeAlpha / 255) * 100));

	$effect(() => {
		if (activeHex === syncedHex) return;
		const hsv = rgbToHsv(hexToRgb(activeHex));
		if (hsv.s > 0) hue = Math.round(hsv.h);
		saturation = hsv.s;
		value = hsv.v;
		syncedHex = activeHex;
	});

	$effect(() => {
		if (!hexFocused) hexDraft = activeHex;
	});

	function setActiveHex(next: string): void {
		const normalized = normalizeHex(next);
		if (!normalized) return;
		editor.setColor(slot, normalized);
		const hsv = rgbToHsv(hexToRgb(normalized));
		if (hsv.s > 0) hue = Math.round(hsv.h);
		saturation = hsv.s;
		value = hsv.v;
		syncedHex = normalized;
	}

	function applyHsv(nextHue = hue, nextSaturation = saturation, nextValue = value): void {
		const h = ((nextHue % 360) + 360) % 360;
		const s = clamp01(nextSaturation);
		const v = clamp01(nextValue);
		const { r, g, b } = hsvToRgb(h, s, v);
		const next = rgbToHex(r, g, b);

		hue = h;
		saturation = s;
		value = v;
		syncedHex = next;
		editor.setColor(slot, next);
	}

	function setAlpha(next: number): void {
		editor.setColorAlpha(slot, next);
	}

	function onHexInput(event: Event): void {
		const next = (event.currentTarget as HTMLInputElement).value;
		hexDraft = next;
		setActiveHex(next);
	}

	function commitHex(): void {
		setActiveHex(hexDraft);
		hexDraft = activeHex;
		hexFocused = false;
	}

	function onHueInput(event: Event): void {
		const next = Number((event.currentTarget as HTMLInputElement).value);
		applyHsv(next, saturation, value);
	}

	function onAlphaInput(event: Event): void {
		setAlpha(Number((event.currentTarget as HTMLInputElement).value));
	}

	function updateFromPointer(event: PointerEvent): void {
		if (!svArea) return;
		const rect = svArea.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;
		const s = clamp01((event.clientX - rect.left) / rect.width);
		const v = 1 - clamp01((event.clientY - rect.top) / rect.height);
		applyHsv(hue, s, v);
	}

	function onSvPointerDown(event: PointerEvent): void {
		if (event.button !== 0) return;
		event.preventDefault();
		draggingSv = true;
		try {
			svArea?.setPointerCapture(event.pointerId);
		} catch {
			// Synthetic pointer events may not own a capture target.
		}
		updateFromPointer(event);
	}

	function onSvPointerMove(event: PointerEvent): void {
		if (!draggingSv) return;
		updateFromPointer(event);
	}

	function onSvPointerUp(event: PointerEvent): void {
		draggingSv = false;
		if (svArea?.hasPointerCapture(event.pointerId)) {
			svArea.releasePointerCapture(event.pointerId);
		}
	}

	function onSvKeydown(event: KeyboardEvent): void {
		const step = event.shiftKey ? 0.1 : 0.02;
		if (event.key === "ArrowLeft") applyHsv(hue, saturation - step, value);
		else if (event.key === "ArrowRight") applyHsv(hue, saturation + step, value);
		else if (event.key === "ArrowUp") applyHsv(hue, saturation, value + step);
		else if (event.key === "ArrowDown") applyHsv(hue, saturation, value - step);
		else return;
		event.preventDefault();
	}

	function choosePaletteColor(color: string, target: ColorSlot): void {
		editor.setColor(target, color);
		editor.setColorAlpha(target, 255);
		editor.activeColorSlot = target;
	}

	let activePalette = $derived(editor.activePalette);
	let paletteEditable = $derived(!activePalette.builtin);
	let paletteColorCount = $derived(activePalette.colors.length);
	let currentPaletteColor = $derived(
		slot === "secondary" ? editor.secondaryColor : editor.primaryColor,
	);
	let canAddPaletteColor = $derived(
		paletteEditable &&
			paletteColorCount < MAX_PALETTE_COLORS &&
			!activePalette.colors.includes(currentPaletteColor),
	);
	let addPaletteColorTitle = $derived(
		!paletteEditable
			? "The default palette cannot be modified"
			: paletteColorCount >= MAX_PALETTE_COLORS
				? `Palette is full (${MAX_PALETTE_COLORS} colors)`
				: activePalette.colors.includes(currentPaletteColor)
					? "Color is already in the palette"
					: "Add current color to palette",
	);

	let renamingPalette = $state(false);
	let renameDraft = $state("");
	let renameInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (!renamingPalette || !renameInput) return;
		renameInput.focus();
		renameInput.select();
	});

	function onPaletteSelect(event: Event): void {
		editor.selectPalette((event.currentTarget as HTMLSelectElement).value);
	}

	function startPaletteRename(): void {
		if (!paletteEditable) return;
		renameDraft = activePalette.name;
		renamingPalette = true;
	}

	function createPalette(): void {
		editor.createPalette();
		startPaletteRename();
	}

	function commitPaletteRename(): void {
		if (!renamingPalette) return;
		renamingPalette = false;
		editor.renamePalette(activePalette.id, renameDraft);
	}

	function cancelPaletteRename(): void {
		renamingPalette = false;
	}

	function deletePalette(): void {
		if (!paletteEditable) return;
		renamingPalette = false;
		editor.deletePalette(activePalette.id);
	}
</script>

<section class="shrink-0 border-t">
	<header class="flex h-11 items-center justify-between border-b px-4">
		<div class="flex items-center gap-2">
			<PaletteIcon class="size-4 text-muted-foreground" />
			<span class="text-xs font-medium">Color</span>
		</div>
		<span class="font-mono text-[10px] uppercase text-muted-foreground">
			{activeHex} · {alphaPercent}%
		</span>
	</header>

	<div class="space-y-4 p-4">
		<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
			<button
				type="button"
				class={cn(
					"flex items-center gap-2 rounded-lg border p-1.5 text-left transition-colors",
					slot === "primary"
						? "border-ring bg-accent text-foreground"
						: "text-muted-foreground hover:bg-accent/60",
				)}
				onclick={() => (editor.activeColorSlot = "primary")}
				aria-pressed={slot === "primary"}
			>
				<span
					class="checkerboard relative size-8 shrink-0 overflow-hidden rounded-md ring-1 ring-border"
				>
					<span
						class="absolute inset-0"
						style={`background-color: ${colorWithAlpha(editor.primaryColor, editor.alpha / 255)}`}
					></span>
				</span>
				<span class="grid min-w-0 gap-0.5">
					<span class="text-[10px] font-medium">Primary</span>
					<span class="truncate text-[9px] text-muted-foreground">Left mouse</span>
				</span>
			</button>

			<Button
				variant="ghost"
				size="icon-xs"
				class="rounded-full text-muted-foreground"
				onclick={() => editor.swapColors()}
				title="Swap primary and secondary colors"
				aria-label="Swap primary and secondary colors"
			>
				<ArrowLeftRight class="size-3.5" />
			</Button>

			<button
				type="button"
				class={cn(
					"flex items-center gap-2 rounded-lg border p-1.5 text-left transition-colors",
					slot === "secondary"
						? "border-ring bg-accent text-foreground"
						: "text-muted-foreground hover:bg-accent/60",
				)}
				onclick={() => (editor.activeColorSlot = "secondary")}
				aria-pressed={slot === "secondary"}
			>
				<span
					class="checkerboard relative size-8 shrink-0 overflow-hidden rounded-md ring-1 ring-border"
				>
					<span
						class="absolute inset-0"
						style={`background-color: ${colorWithAlpha(editor.secondaryColor, editor.secondaryAlpha / 255)}`}
					></span>
				</span>
				<span class="grid min-w-0 gap-0.5">
					<span class="text-[10px] font-medium">Secondary</span>
					<span class="truncate text-[9px] text-muted-foreground">Right mouse</span>
				</span>
			</button>
		</div>

		<div class="space-y-2">
			<div
				bind:this={svArea}
				role="slider"
				tabindex="0"
				aria-label="Saturation and brightness"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(value * 100)}
				aria-valuetext={`Saturation ${Math.round(saturation * 100)}%, brightness ${Math.round(value * 100)}%`}
				class="relative h-32 w-full touch-none overflow-hidden rounded-lg ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
				onpointerdown={onSvPointerDown}
				onpointermove={onSvPointerMove}
				onpointerup={onSvPointerUp}
				onpointercancel={onSvPointerUp}
				onkeydown={onSvKeydown}
			>
				<span
					class="absolute inset-0"
					style={`background-color: hsl(${hue} 100% 50%)`}
				></span>
				<span class="absolute inset-0 bg-linear-to-r from-white to-transparent"></span>
				<span class="absolute inset-0 bg-linear-to-t from-black to-transparent"></span>
				<span
					class="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
					style={`left: ${saturation * 100}%; top: ${(1 - value) * 100}%;`}
				></span>
			</div>

			<input
				type="range"
				min={0}
				max={359}
				step={1}
				value={Math.round(hue)}
				oninput={onHueInput}
				class="color-range"
				style={`background: ${HUE_TRACK}`}
				aria-label="Hue"
			/>

			<div
				class="checkerboard relative h-3 overflow-hidden rounded-full ring-1 ring-border focus-within:ring-2 focus-within:ring-ring"
			>
				<span
					class="absolute inset-0"
					style={`background: linear-gradient(to right, ${colorWithAlpha(activeHex, 0)}, ${colorWithAlpha(activeHex, 1)})`}
				></span>
				<input
					type="range"
					min={0}
					max={255}
					step={1}
					value={activeAlpha}
					oninput={onAlphaInput}
					class="color-range absolute inset-0 h-full w-full bg-transparent"
					aria-label={`${slot === "primary" ? "Primary" : "Secondary"} alpha`}
				/>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<Input
				value={hexDraft}
				oninput={onHexInput}
				onfocus={() => (hexFocused = true)}
				onblur={commitHex}
				onkeydown={(event) => {
					if (event.key === "Enter") event.currentTarget.blur();
				}}
				maxlength={7}
				spellcheck={false}
				aria-label={`${slot === "primary" ? "Primary" : "Secondary"} hex color`}
				class="h-7 px-2 font-mono text-xs uppercase"
			/>
			<span class="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
				{alphaPercent}%
			</span>
		</div>

		<div class="space-y-2 pt-1">
			<div class="flex items-center justify-between">
				<span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
					Palette
				</span>
				<div class="flex items-center gap-0.5">
					<Button
						variant="ghost"
						size="icon-xs"
						class="text-muted-foreground"
						onclick={() => editor.addPaletteColor()}
						disabled={!canAddPaletteColor}
						title={addPaletteColorTitle}
						aria-label="Add current color to palette"
					>
						<Plus class="size-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						class="text-muted-foreground"
						onclick={createPalette}
						title="New palette"
						aria-label="New palette"
					>
						<PaletteIcon class="size-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						class="text-muted-foreground"
						onclick={startPaletteRename}
						disabled={!paletteEditable}
						title={paletteEditable ? "Rename palette" : "The default palette cannot be renamed"}
						aria-label="Rename palette"
					>
						<Pencil class="size-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						class="text-muted-foreground"
						onclick={deletePalette}
						disabled={!paletteEditable}
						title={paletteEditable ? "Delete palette" : "The default palette cannot be deleted"}
						aria-label="Delete palette"
					>
						<Trash2 class="size-3.5" />
					</Button>
				</div>
			</div>

			<div class="flex items-center gap-1.5">
				{#if renamingPalette}
					<input
						bind:this={renameInput}
						bind:value={renameDraft}
						type="text"
						class="h-7 min-w-0 flex-1 rounded-lg border bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
						maxlength={40}
						onblur={commitPaletteRename}
						onkeydown={(event) => {
							if (event.key === "Enter") event.currentTarget.blur();
							else if (event.key === "Escape") {
								event.preventDefault();
								cancelPaletteRename();
							}
						}}
						aria-label="Palette name"
					/>
				{:else}
					<select
						class="h-7 min-w-0 flex-1 cursor-pointer rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
						value={editor.activePaletteId}
						onchange={onPaletteSelect}
						aria-label="Active palette"
					>
						{#each editor.palettes as palette (palette.id)}
							<option value={palette.id}>{palette.name}</option>
						{/each}
					</select>
				{/if}
				<span
					class="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground"
				>
					{paletteColorCount}/{MAX_PALETTE_COLORS}
				</span>
			</div>

			<div class="max-h-44 overflow-y-auto pr-1">
				{#if paletteColorCount === 0}
					<p
						class="rounded-md border border-dashed px-2 py-3 text-center text-[10px] text-muted-foreground"
					>
						No colors yet. Use + to add the current color.
					</p>
				{:else}
					<div class="grid grid-cols-8 gap-1.5">
						{#each activePalette.colors as color, index (color)}
							<div class="group relative aspect-square">
								<button
									type="button"
									class="relative size-full rounded-[5px] ring-1 ring-black/10 transition-transform group-hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									style={`background-color: ${color}`}
									title={`${color} — left click: primary, right click: secondary`}
									aria-label={`Use color ${color}`}
									onclick={() => choosePaletteColor(color, "primary")}
									oncontextmenu={(event) => {
										event.preventDefault();
										choosePaletteColor(color, "secondary");
									}}
								>
									{#if editor.primaryColor === color && editor.alpha === 255}
										<span
											class="pointer-events-none absolute left-0.5 top-0.5 size-1.5 rounded-full bg-background ring-1 ring-foreground"
										></span>
									{/if}
									{#if editor.secondaryColor === color && editor.secondaryAlpha === 255}
										<span
											class="pointer-events-none absolute bottom-0.5 right-0.5 size-1.5 rounded-full bg-background ring-1 ring-foreground"
										></span>
									{/if}
								</button>
								{#if paletteEditable}
									<button
										type="button"
										class="absolute right-0.5 top-0.5 grid size-3.5 place-items-center rounded-full bg-background/90 text-muted-foreground opacity-0 ring-1 ring-border transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground focus-visible:pointer-events-auto focus-visible:opacity-100"
										onclick={() => editor.removePaletteColor(index)}
										title={`Remove ${color} from palette`}
										aria-label={`Remove ${color} from palette`}
									>
										<X class="size-2.5" />
									</button>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>
