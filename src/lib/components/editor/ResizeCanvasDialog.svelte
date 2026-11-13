<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import CanvasTransformPreview from "$lib/components/editor/CanvasTransformPreview.svelte";
	import { resizePixels } from "$lib/editor/canvas.js";
	import { compositeFrameCached } from "$lib/editor/doc.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import { cn } from "$lib/utils.js";

	let { open = $bindable(false) } = $props();

	const MIN_SIZE = 1;
	const MAX_SIZE = 1024;
	const ANCHORS = [
		{ id: "top-left", label: "Top left", x: 0, y: 0 },
		{ id: "top", label: "Top center", x: 0.5, y: 0 },
		{ id: "top-right", label: "Top right", x: 1, y: 0 },
		{ id: "left", label: "Middle left", x: 0, y: 0.5 },
		{ id: "center", label: "Center", x: 0.5, y: 0.5 },
		{ id: "right", label: "Middle right", x: 1, y: 0.5 },
		{ id: "bottom-left", label: "Bottom left", x: 0, y: 1 },
		{ id: "bottom", label: "Bottom center", x: 0.5, y: 1 },
		{ id: "bottom-right", label: "Bottom right", x: 1, y: 1 },
	];

	let widthText = $state("32");
	let heightText = $state("32");
	let anchorX = $state(0.5);
	let anchorY = $state(0.5);
	let wasOpen = false;

	let width = $derived(Number(widthText));
	let height = $derived(Number(heightText));
	let valid = $derived(
		Number.isInteger(width) &&
			width >= MIN_SIZE &&
			width <= MAX_SIZE &&
			Number.isInteger(height) &&
			height >= MIN_SIZE &&
			height <= MAX_SIZE,
	);
	let unchanged = $derived(
		valid && width === editor.doc.width && height === editor.doc.height,
	);
	let canApply = $derived(valid && !unchanged);

	let previewPixels = $derived.by(() => {
		if (!open || !valid) return null;
		const doc = editor.doc;
		const source = compositeFrameCached(
			doc,
			editor.activeFrame,
			editor.revision,
			true,
		);
		const offsetX = Math.round((width - doc.width) * anchorX);
		const offsetY = Math.round((height - doc.height) * anchorY);
		return resizePixels(
			source,
			doc.width,
			doc.height,
			width,
			height,
			offsetX,
			offsetY,
		);
	});

	let anchorLabel = $derived(
		ANCHORS.find(
			(anchor) => anchor.x === anchorX && anchor.y === anchorY,
		)?.label ?? "Custom",
	);

	$effect(() => {
		if (open && !wasOpen) {
			widthText = String(editor.doc.width);
			heightText = String(editor.doc.height);
			anchorX = 0.5;
			anchorY = 0.5;
		}
		wasOpen = open;
	});

	function apply(): void {
		if (!canApply) return;
		if (editor.resizeCanvas(width, height, anchorX, anchorY)) open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Resize Canvas</Dialog.Title>
			<Dialog.Description>
				Crop or extend the canvas. Existing pixels stay anchored, and any new
				area is transparent.
			</Dialog.Description>
		</Dialog.Header>

		<CanvasTransformPreview
			pixels={previewPixels}
			width={valid ? width : 1}
			height={valid ? height : 1}
			label="Resized canvas preview"
		/>

		<div class="flex items-center justify-between gap-3 text-[10px]">
			<span class="font-mono tabular-nums text-muted-foreground">
				{editor.doc.width} × {editor.doc.height} → {valid
					? `${width} × ${height}`
					: "— × —"}
			</span>
			<span class="text-muted-foreground">Anchored {anchorLabel.toLowerCase()}</span>
		</div>

		<div class="grid gap-5 sm:grid-cols-[1fr_auto]">
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="grid gap-1.5">
					<Label for="resize-width">Width</Label>
					<Input
						id="resize-width"
						type="number"
						min={MIN_SIZE}
						max={MAX_SIZE}
						step={1}
						value={widthText}
						oninput={(event) => (widthText = event.currentTarget.value)}
						class="tabular-nums"
					/>
				</div>
				<div class="grid gap-1.5">
					<Label for="resize-height">Height</Label>
					<Input
						id="resize-height"
						type="number"
						min={MIN_SIZE}
						max={MAX_SIZE}
						step={1}
						value={heightText}
						oninput={(event) => (heightText = event.currentTarget.value)}
						class="tabular-nums"
					/>
				</div>
			</div>

			<div class="grid gap-2 justify-self-start">
				<span class="text-xs font-medium">Anchor</span>
				<div class="grid w-28 grid-cols-3 gap-1" role="group" aria-label="Canvas anchor">
					{#each ANCHORS as anchor (anchor.id)}
						{@const selected = anchor.x === anchorX && anchor.y === anchorY}
						<button
							type="button"
							class={cn(
								"grid size-8 place-items-center rounded border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
								selected
									? "border-primary bg-primary/10"
									: "border-border/60 hover:bg-muted/50",
							)}
							onclick={() => {
								anchorX = anchor.x;
								anchorY = anchor.y;
							}}
							aria-pressed={selected}
							aria-label={anchor.label}
							title={anchor.label}
						>
							<span
								class={cn(
									"size-1.5 rounded-full",
									selected ? "bg-primary" : "bg-muted-foreground/40",
								)}
							></span>
						</button>
					{/each}
				</div>
			</div>
		</div>

		{#if !valid}
			<p class="text-xs text-destructive">
				Width and height must be whole numbers from {MIN_SIZE} to {MAX_SIZE}.
			</p>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button onclick={apply} disabled={!canApply}>Resize canvas</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
