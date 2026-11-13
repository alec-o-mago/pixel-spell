<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Switch } from "$lib/components/ui/switch/index.js";
	import CanvasTransformPreview from "$lib/components/editor/CanvasTransformPreview.svelte";
	import { scalePixelsNearest } from "$lib/editor/canvas.js";
	import { compositeFrameCached } from "$lib/editor/doc.js";
	import { editor } from "$lib/editor/editor.svelte.js";

	let { open = $bindable(false) } = $props();

	const MIN_SIZE = 1;
	const MAX_SIZE = 1024;
	const PRESETS = [
		{ label: "½×", factor: 0.5 },
		{ label: "1×", factor: 1 },
		{ label: "2×", factor: 2 },
		{ label: "3×", factor: 3 },
	];

	let widthText = $state("32");
	let heightText = $state("32");
	let lockAspect = $state(true);
	let aspect = $state(1);
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
		return scalePixelsNearest(source, doc.width, doc.height, width, height);
	});

	$effect(() => {
		if (open && !wasOpen) {
			widthText = String(editor.doc.width);
			heightText = String(editor.doc.height);
			aspect = editor.doc.width / Math.max(1, editor.doc.height);
			lockAspect = true;
		}
		wasOpen = open;
	});

	function clampDimension(value: number): number {
		return Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(value)));
	}

	function setWidth(value: string): void {
		widthText = value;
		if (!lockAspect) return;
		const parsed = Number(value);
		if (!Number.isFinite(parsed) || parsed <= 0) return;
		heightText = String(clampDimension(parsed / aspect));
	}

	function setHeight(value: string): void {
		heightText = value;
		if (!lockAspect) return;
		const parsed = Number(value);
		if (!Number.isFinite(parsed) || parsed <= 0) return;
		widthText = String(clampDimension(parsed * aspect));
	}

	function applyPreset(factor: number): void {
		const nextWidth = clampDimension(editor.doc.width * factor);
		widthText = String(nextWidth);
		heightText = String(
			clampDimension(
				lockAspect
					? nextWidth / aspect
					: editor.doc.height * factor,
			),
		);
	}

	function changeLock(checked: boolean): void {
		lockAspect = checked;
		if (!checked) return;
		const parsed = Number(widthText);
		if (Number.isFinite(parsed) && parsed > 0) {
			heightText = String(clampDimension(parsed / aspect));
		}
	}

	function apply(): void {
		if (!canApply) return;
		if (editor.scaleCanvas(width, height)) open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Scale Canvas</Dialog.Title>
			<Dialog.Description>
				Resample every layer and frame to new dimensions. Pixels are scaled with
				nearest-neighbor, so stretching and squeezing keep hard edges.
			</Dialog.Description>
		</Dialog.Header>

		<CanvasTransformPreview
			pixels={previewPixels}
			width={valid ? width : 1}
			height={valid ? height : 1}
			label="Scaled canvas preview"
		/>

		<div class="flex items-center justify-between gap-3 text-[10px]">
			<span class="font-mono tabular-nums text-muted-foreground">
				{editor.doc.width} × {editor.doc.height} → {valid
					? `${width} × ${height}`
					: "— × —"}
			</span>
			<span class="text-muted-foreground">
				{valid && lockAspect ? "Aspect ratio locked" : "Independent width and height"}
			</span>
		</div>

		<div class="flex flex-wrap items-center gap-1.5">
			{#each PRESETS as preset (preset.label)}
				<Button
					variant="outline"
					size="sm"
					onclick={() => applyPreset(preset.factor)}
				>
					{preset.label}
				</Button>
			{/each}
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<div class="grid gap-1.5">
				<Label for="scale-width">Width</Label>
				<Input
					id="scale-width"
					type="number"
					min={MIN_SIZE}
					max={MAX_SIZE}
					step={1}
					value={widthText}
					oninput={(event) => setWidth(event.currentTarget.value)}
					class="tabular-nums"
				/>
			</div>
			<div class="grid gap-1.5">
				<Label for="scale-height">Height</Label>
				<Input
					id="scale-height"
					type="number"
					min={MIN_SIZE}
					max={MAX_SIZE}
					step={1}
					value={heightText}
					oninput={(event) => setHeight(event.currentTarget.value)}
					class="tabular-nums"
				/>
			</div>
		</div>

		<label class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
			<span class="grid gap-0.5">
				<span class="text-xs font-medium">Lock aspect ratio</span>
				<span class="text-[10px] text-muted-foreground">
					Change one dimension and the other follows.
				</span>
			</span>
			<Switch checked={lockAspect} onCheckedChange={changeLock} />
		</label>

		{#if !valid}
			<p class="text-xs text-destructive">
				Width and height must be whole numbers from {MIN_SIZE} to {MAX_SIZE}.
			</p>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button onclick={apply} disabled={!canApply}>Scale canvas</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
