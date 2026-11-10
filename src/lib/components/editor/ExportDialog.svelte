<script lang="ts">
	import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
	import Download from "@lucide/svelte/icons/download";
	import Film from "@lucide/svelte/icons/film";
	import ImageIcon from "@lucide/svelte/icons/image";
	import LayoutGrid from "@lucide/svelte/icons/layout-grid";
	import LoaderCircle from "@lucide/svelte/icons/loader-circle";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Slider } from "$lib/components/ui/slider/index.js";
	import { Switch } from "$lib/components/ui/switch/index.js";
	import { compositeFrame } from "$lib/editor/doc.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import {
		EXPORT_FORMATS,
		EXPORT_TAB_LABELS,
		FORMAT_EXTENSION,
		downloadBlob,
		exportBaseName,
		exportFileName,
		exportFrameImage,
		exportGif,
		exportSpriteSheet,
		flattenPixels,
		getSheetGeometry,
		validateExportSize,
		type ExportBackground,
		type ExportFormat,
		type ExportTabId,
		type SheetLayout,
	} from "$lib/editor/export.js";
	import { drawScaled, pixelsToImageData } from "$lib/editor/render.js";
	import { cn } from "$lib/utils.js";

	let { open = $bindable(false) } = $props();

	const TABS: ExportTabId[] = ["image", "spritesheet", "gif"];
	const BACKGROUNDS: { id: ExportBackground; label: string; swatch: string }[] = [
		{ id: "transparent", label: "Transparent", swatch: "checkerboard" },
		{ id: "white", label: "White", swatch: "bg-white" },
		{ id: "black", label: "Black", swatch: "bg-black" },
	];
	const LAYOUTS: { id: SheetLayout; label: string }[] = [
		{ id: "horizontal", label: "Horizontal" },
		{ id: "vertical", label: "Vertical" },
		{ id: "grid", label: "Grid" },
	];
	const PREVIEW_MAX_WIDTH = 600;
	const PREVIEW_MAX_HEIGHT = 132;

	let activeTab = $state<ExportTabId>("image");
	let exporting = $state(false);
	let error = $state<string | null>(null);
	let previewCanvas = $state<HTMLCanvasElement>();
	let previewTimer: number | undefined;
	let wasOpen = false;

	let imageFrame = $state(0);
	let imageScale = $state(1);
	let imageFormat = $state<ExportFormat>("png");
	let imageBackground = $state<ExportBackground>("transparent");
	let imageQuality = $state(90);
	let imageFileName = $state("");

	let sheetScale = $state(1);
	let sheetLayout = $state<SheetLayout>("horizontal");
	let sheetColumns = $state(1);
	let sheetSpacing = $state(0);
	let sheetFormat = $state<ExportFormat>("png");
	let sheetBackground = $state<ExportBackground>("transparent");
	let sheetQuality = $state(90);
	let sheetFileName = $state("");

	let gifScale = $state(1);
	let gifFps = $state(12);
	let gifLoop = $state(true);
	let gifBackground = $state<ExportBackground>("transparent");
	let gifFileName = $state("");

	let imageWidth = $derived(editor.doc.width * imageScale);
	let imageHeight = $derived(editor.doc.height * imageScale);
	let imageSizeError = $derived(validateExportSize(imageWidth, imageHeight));

	let sheetGeometry = $derived(
		getSheetGeometry(
			editor.doc.width * sheetScale,
			editor.doc.height * sheetScale,
			editor.doc.frames.length,
			sheetLayout,
			sheetColumns,
			sheetSpacing,
		),
	);
	let sheetSizeError = $derived(
		validateExportSize(sheetGeometry.width, sheetGeometry.height),
	);

	let gifWidth = $derived(editor.doc.width * gifScale);
	let gifHeight = $derived(editor.doc.height * gifScale);
	let gifSizeError = $derived(
		validateExportSize(gifWidth, gifHeight, editor.doc.frames.length, true),
	);

	let sizeError = $derived(
		activeTab === "image"
			? imageSizeError
			: activeTab === "spritesheet"
				? sheetSizeError
				: gifSizeError,
	);

	let outputLabel = $derived.by(() => {
		if (activeTab === "image") return `${imageWidth} × ${imageHeight} px`;
		if (activeTab === "spritesheet") {
			return `${sheetGeometry.width} × ${sheetGeometry.height} px · ${sheetGeometry.columns} × ${sheetGeometry.rows}`;
		}
		const frames = editor.doc.frames.length;
		return `${gifWidth} × ${gifHeight} px · ${frames} ${frames === 1 ? "frame" : "frames"}`;
	});

	let formatLabel = $derived.by(() => {
		const format = (id: ExportFormat): string =>
			EXPORT_FORMATS.find((entry) => entry.id === id)?.label ?? id.toUpperCase();

		if (activeTab === "image") {
			return `${format(imageFormat)} · ${imageBackground}`;
		}
		if (activeTab === "spritesheet") {
			return `${format(sheetFormat)} · ${sheetBackground}`;
		}
		return `GIF · ${Math.round(gifFps)} fps${gifLoop ? " · loop" : ""}`;
	});

	$effect(() => {
		if (open && !wasOpen) {
			activeTab = "image";
			imageFrame = editor.activeFrame;
			imageScale = 1;
			imageFormat = "png";
			imageBackground = "transparent";
			imageQuality = 90;
			imageFileName = `${exportBaseName(editor.name)}-frame-${editor.activeFrame + 1}.png`;

			sheetScale = 1;
			sheetLayout = "horizontal";
			sheetColumns = Math.max(
				1,
				Math.min(
					editor.doc.frames.length,
					Math.round(Math.sqrt(editor.doc.frames.length)),
				),
			);
			sheetSpacing = 0;
			sheetFormat = "png";
			sheetBackground = "transparent";
			sheetQuality = 90;
			sheetFileName = `${exportBaseName(editor.name)}-spritesheet.png`;

			gifScale = 1;
			gifFps = editor.doc.fps;
			gifLoop = true;
			gifBackground = "transparent";
			gifFileName = `${exportBaseName(editor.name)}.gif`;

			error = null;
			exporting = false;
		}
		wasOpen = open;
	});

	function fitPreview(
		sourceWidth: number,
		sourceHeight: number,
	): { width: number; height: number } {
		if (
			!Number.isFinite(sourceWidth) ||
			!Number.isFinite(sourceHeight) ||
			sourceWidth <= 0 ||
			sourceHeight <= 0
		) {
			return { width: 1, height: 1 };
		}
		const scale = Math.min(
			PREVIEW_MAX_WIDTH / sourceWidth,
			PREVIEW_MAX_HEIGHT / sourceHeight,
		);
		return {
			width: Math.max(1, Math.round(sourceWidth * scale)),
			height: Math.max(1, Math.round(sourceHeight * scale)),
		};
	}

	function drawPixelPreview(
		canvas: HTMLCanvasElement,
		pixels: Uint32Array,
		width: number,
		height: number,
	): void {
		const fit = fitPreview(width, height);
		canvas.style.width = `${fit.width}px`;
		canvas.style.height = `${fit.height}px`;
		drawScaled(canvas, pixels, width, height, fit.width, fit.height);
	}

	function drawSheetPreview(
		canvas: HTMLCanvasElement,
		doc: typeof editor.doc,
		layout: SheetLayout,
		columns: number,
		scale: number,
		spacing: number,
		background: ExportBackground,
	): void {
		const geometry = getSheetGeometry(
			doc.width * scale,
			doc.height * scale,
			doc.frames.length,
			layout,
			columns,
			spacing,
		);
		const fit = fitPreview(geometry.width, geometry.height);
		const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
		const backingWidth = Math.max(1, Math.round(fit.width * dpr));
		const backingHeight = Math.max(1, Math.round(fit.height * dpr));

		if (canvas.width !== backingWidth) canvas.width = backingWidth;
		if (canvas.height !== backingHeight) canvas.height = backingHeight;
		canvas.style.width = `${fit.width}px`;
		canvas.style.height = `${fit.height}px`;

		const context = canvas.getContext("2d");
		if (!context) return;
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, backingWidth, backingHeight);
		if (background !== "transparent") {
			context.fillStyle = background === "white" ? "#ffffff" : "#000000";
			context.fillRect(0, 0, backingWidth, backingHeight);
		}
		context.scale(backingWidth / geometry.width, backingHeight / geometry.height);
		context.imageSmoothingEnabled = false;

		const source = document.createElement("canvas");
		source.width = doc.width;
		source.height = doc.height;
		const sourceContext = source.getContext("2d");
		if (!sourceContext) return;

		for (let frameIndex = 0; frameIndex < doc.frames.length; frameIndex++) {
			sourceContext.putImageData(
				pixelsToImageData(compositeFrame(doc, frameIndex), doc.width, doc.height),
				0,
				0,
			);
			const column = frameIndex % geometry.columns;
			const row = Math.floor(frameIndex / geometry.columns);
			context.drawImage(
				source,
				column * (geometry.frameWidth + geometry.spacing),
				row * (geometry.frameHeight + geometry.spacing),
				geometry.frameWidth,
				geometry.frameHeight,
			);
		}
	}

	$effect(() => {
		if (!open || !previewCanvas) return;
		const canvas = previewCanvas;
		const doc = editor.doc;
		editor.revision;
		const tab = activeTab;

		if (previewTimer !== undefined) {
			window.clearInterval(previewTimer);
			previewTimer = undefined;
		}

		if (tab === "image") {
			const frame = Math.max(0, Math.min(imageFrame, doc.frames.length - 1));
			const pixels = flattenPixels(compositeFrame(doc, frame), imageBackground);
			drawPixelPreview(canvas, pixels, doc.width, doc.height);
			return;
		}

		if (tab === "spritesheet") {
			drawSheetPreview(
				canvas,
				doc,
				sheetLayout,
				sheetColumns,
				sheetScale,
				sheetSpacing,
				sheetBackground,
			);
			return;
		}

		const frameCount = Math.max(1, doc.frames.length);
		let frameIndex = 0;
		const draw = (): void => {
			const frame = frameIndex % frameCount;
			const pixels = flattenPixels(compositeFrame(doc, frame), gifBackground);
			drawPixelPreview(canvas, pixels, doc.width, doc.height);
			frameIndex = (frameIndex + 1) % frameCount;
		};
		draw();

		if (frameCount > 1) {
			const fps = Math.max(1, Math.min(60, Math.round(gifFps)));
			previewTimer = window.setInterval(draw, 1000 / fps);
		}

		return () => {
			if (previewTimer !== undefined) {
				window.clearInterval(previewTimer);
				previewTimer = undefined;
			}
		};
	});

	function changeImageFrame(event: Event): void {
		const next = Number((event.currentTarget as HTMLSelectElement).value);
		imageFrame = next;
		const match = /^(.*-frame-)\d+(\.(?:png|jpe?g|webp))$/i.exec(imageFileName.trim());
		if (match) {
			imageFileName = `${match[1]}${next + 1}${match[2]}`;
		}
	}

	function changeImageFormat(event: Event): void {
		const next = (event.currentTarget as HTMLSelectElement).value as ExportFormat;
		imageFormat = next;
		if (imageFileName.trim()) {
			imageFileName = exportFileName(imageFileName, FORMAT_EXTENSION[next]);
		}
		if (next === "jpeg" && imageBackground === "transparent") {
			imageBackground = "white";
		}
	}

	function changeSheetFormat(event: Event): void {
		const next = (event.currentTarget as HTMLSelectElement).value as ExportFormat;
		sheetFormat = next;
		if (sheetFileName.trim()) {
			sheetFileName = exportFileName(sheetFileName, FORMAT_EXTENSION[next]);
		}
		if (next === "jpeg" && sheetBackground === "transparent") {
			sheetBackground = "white";
		}
	}

	async function exportNow(): Promise<void> {
		if (exporting || sizeError) return;

		error = null;
		exporting = true;
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

		const doc = editor.doc;
		try {
			if (activeTab === "image") {
				const blob = await exportFrameImage(doc, {
					frame: imageFrame,
					scale: imageScale,
					format: imageFormat,
					background: imageBackground,
					quality: imageQuality,
				});
				downloadBlob(exportFileName(imageFileName, FORMAT_EXTENSION[imageFormat]), blob);
			} else if (activeTab === "spritesheet") {
				const blob = await exportSpriteSheet(doc, {
					scale: sheetScale,
					layout: sheetLayout,
					columns: sheetColumns,
					spacing: sheetSpacing,
					format: sheetFormat,
					background: sheetBackground,
					quality: sheetQuality,
				});
				downloadBlob(exportFileName(sheetFileName, FORMAT_EXTENSION[sheetFormat]), blob);
			} else {
				const blob = exportGif(doc, {
					scale: gifScale,
					fps: gifFps,
					loop: gifLoop,
					background: gifBackground,
				});
				downloadBlob(exportFileName(gifFileName, "gif"), blob);
			}
			open = false;
		} catch (exportError) {
			error =
				exportError instanceof Error
					? exportError.message
					: "The file could not be exported.";
		} finally {
			exporting = false;
		}
	}
</script>

{#snippet backgroundPicker(
	value: ExportBackground,
	allowTransparent: boolean,
	onchange: (next: ExportBackground) => void,
)}
	<div class="grid grid-cols-3 gap-2" role="group" aria-label="Background">
		{#each BACKGROUNDS as option (option.id)}
			<Button
				variant={value === option.id ? "default" : "outline"}
				size="sm"
				class="h-auto flex-col gap-1.5 py-2"
				onclick={() => onchange(option.id)}
				disabled={option.id === "transparent" && !allowTransparent}
				aria-pressed={value === option.id}
			>
				<span
					class="size-5 rounded-sm border {option.swatch}"
					style={option.id === "transparent" ? "background-size: 6px 6px" : undefined}
					aria-hidden="true"
				></span>
				<span class="text-[10px]">{option.label}</span>
			</Button>
		{/each}
	</div>
{/snippet}

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Export file</Dialog.Title>
			<Dialog.Description>
				Export “{editor.name}” as a single image, a sprite sheet, or an animated GIF.
			</Dialog.Description>
		</Dialog.Header>

		<div
			role="tablist"
			aria-label="Export type"
			class="inline-flex w-fit items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5"
		>
			{#each TABS as tab (tab)}
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === tab}
					class={cn(
						"flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
						activeTab === tab
							? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
							: "text-muted-foreground hover:text-foreground",
					)}
					onclick={() => {
						activeTab = tab;
						error = null;
					}}
				>
					{#if tab === "image"}
						<ImageIcon class="size-3.5" />
					{:else if tab === "spritesheet"}
						<LayoutGrid class="size-3.5" />
					{:else}
						<Film class="size-3.5" />
					{/if}
					{EXPORT_TAB_LABELS[tab]}
				</button>
			{/each}
		</div>

		<div class="grid gap-2">
			<div
				class="checkerboard relative flex h-36 items-center justify-center overflow-hidden rounded-lg ring-1 ring-border"
			>
				<canvas bind:this={previewCanvas} class="block" aria-label="Export preview"></canvas>
			</div>
			<div class="flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
				<span class="font-mono tabular-nums">{outputLabel}</span>
				<span class="truncate">{formatLabel}</span>
			</div>
		</div>

		{#if activeTab === "image"}
			<div class="grid gap-4">
				<div class="grid gap-1.5">
					<Label for="export-image-name">File name</Label>
					<Input
						id="export-image-name"
						bind:value={imageFileName}
						maxlength={120}
						placeholder="sprite-frame-1.png"
						autocomplete="off"
					/>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div class="grid gap-1.5">
						<Label for="export-image-frame">Frame</Label>
						<select
							id="export-image-frame"
							class="h-8 w-full cursor-pointer rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
							value={imageFrame}
							onchange={changeImageFrame}
						>
							{#each editor.doc.frames as _frame, index (index)}
								<option value={index}>Frame {index + 1}</option>
							{/each}
						</select>
					</div>

					<div class="grid gap-1.5">
						<Label for="export-image-format">Format</Label>
						<select
							id="export-image-format"
							class="h-8 w-full cursor-pointer rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
							value={imageFormat}
							onchange={changeImageFormat}
						>
							{#each EXPORT_FORMATS as option (option.id)}
								<option value={option.id}>{option.label}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="grid gap-2">
					<div class="flex items-center justify-between">
						<span class="text-xs font-medium">Scale</span>
						<span
							class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground"
						>
							{imageScale}×
						</span>
					</div>
					<Slider type="single" min={1} max={10} step={1} bind:value={imageScale} />
				</div>

				<div class="grid gap-2">
					<span class="text-xs font-medium">Background</span>
					{@render backgroundPicker(
						imageBackground,
						imageFormat !== "jpeg",
						(next) => (imageBackground = next),
					)}
					{#if imageFormat === "jpeg"}
						<p class="text-[10px] text-muted-foreground">
							JPEG does not support transparency, so the background is always solid.
						</p>
					{/if}
				</div>

				{#if imageFormat !== "png"}
					<div class="grid gap-2">
						<div class="flex items-center justify-between">
							<span class="text-xs font-medium">Quality</span>
							<span
								class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground"
							>
								{imageQuality}%
							</span>
						</div>
						<Slider type="single" min={1} max={100} step={1} bind:value={imageQuality} />
					</div>
				{/if}
			</div>
		{:else if activeTab === "spritesheet"}
			<div class="grid gap-4">
				<div class="grid gap-1.5">
					<Label for="export-sheet-name">File name</Label>
					<Input
						id="export-sheet-name"
						bind:value={sheetFileName}
						maxlength={120}
						placeholder="sprite-spritesheet.png"
						autocomplete="off"
					/>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div class="grid gap-1.5">
						<Label for="export-sheet-layout">Layout</Label>
						<select
							id="export-sheet-layout"
							class="h-8 w-full cursor-pointer rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
							value={sheetLayout}
							onchange={(event) =>
								(sheetLayout = (event.currentTarget as HTMLSelectElement)
									.value as SheetLayout)}
						>
							{#each LAYOUTS as option (option.id)}
								<option value={option.id}>{option.label}</option>
							{/each}
						</select>
					</div>

					<div class="grid gap-1.5">
						<Label for="export-sheet-format">Format</Label>
						<select
							id="export-sheet-format"
							class="h-8 w-full cursor-pointer rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
							value={sheetFormat}
							onchange={changeSheetFormat}
						>
							{#each EXPORT_FORMATS as option (option.id)}
								<option value={option.id}>{option.label}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					{#if sheetLayout === "grid"}
						<div class="grid gap-1.5">
							<Label for="export-sheet-columns">Columns</Label>
							<Input
								id="export-sheet-columns"
								type="number"
								min={1}
								max={Math.max(1, editor.doc.frames.length)}
								bind:value={sheetColumns}
								class="tabular-nums"
							/>
						</div>
					{/if}

					<div class="grid gap-2">
						<div class="flex items-center justify-between">
							<span class="text-xs font-medium">Spacing</span>
							<span
								class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground"
							>
								{sheetSpacing}px
							</span>
						</div>
						<Slider type="single" min={0} max={32} step={1} bind:value={sheetSpacing} />
					</div>
				</div>

				<div class="grid gap-2">
					<div class="flex items-center justify-between">
						<span class="text-xs font-medium">Scale</span>
						<span
							class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground"
						>
							{sheetScale}×
						</span>
					</div>
					<Slider type="single" min={1} max={10} step={1} bind:value={sheetScale} />
				</div>

				<div class="grid gap-2">
					<span class="text-xs font-medium">Background</span>
					{@render backgroundPicker(
						sheetBackground,
						sheetFormat !== "jpeg",
						(next) => (sheetBackground = next),
					)}
					{#if sheetFormat === "jpeg"}
						<p class="text-[10px] text-muted-foreground">
							JPEG does not support transparency, so the background is always solid.
						</p>
					{/if}
				</div>

				{#if sheetFormat !== "png"}
					<div class="grid gap-2">
						<div class="flex items-center justify-between">
							<span class="text-xs font-medium">Quality</span>
							<span
								class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground"
							>
								{sheetQuality}%
							</span>
						</div>
						<Slider type="single" min={1} max={100} step={1} bind:value={sheetQuality} />
					</div>
				{/if}
			</div>
		{:else}
			<div class="grid gap-4">
				<div class="grid gap-1.5">
					<Label for="export-gif-name">File name</Label>
					<Input
						id="export-gif-name"
						bind:value={gifFileName}
						maxlength={120}
						placeholder="sprite.gif"
						autocomplete="off"
					/>
				</div>

				<div class="grid gap-2">
					<div class="flex items-center justify-between">
						<span class="text-xs font-medium">Scale</span>
						<span
							class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground"
						>
							{gifScale}×
						</span>
					</div>
					<Slider type="single" min={1} max={10} step={1} bind:value={gifScale} />
				</div>

				<div class="grid gap-2">
					<div class="flex items-center justify-between">
						<span class="text-xs font-medium">Frame rate</span>
						<span
							class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground"
						>
							{Math.round(gifFps)} fps
						</span>
					</div>
					<Slider type="single" min={1} max={60} step={1} bind:value={gifFps} />
				</div>

				<label
					class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
				>
					<span class="grid gap-0.5">
						<span class="text-xs font-medium">Loop animation</span>
						<span class="text-[10px] text-muted-foreground">
							Repeat forever when the GIF player allows it.
						</span>
					</span>
					<Switch bind:checked={gifLoop} />
				</label>

				<div class="grid gap-2">
					<span class="text-xs font-medium">Background</span>
					{@render backgroundPicker(
						gifBackground,
						true,
						(next) => (gifBackground = next),
					)}
					<p class="text-[10px] text-muted-foreground">
						Transparent GIFs use a 50% alpha cutoff because GIF supports only binary
						transparency.
					</p>
				</div>
			</div>
		{/if}

		{#if sizeError || error}
			<div class="flex gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
				<AlertTriangle class="mt-0.5 size-4 shrink-0 text-destructive" />
				<p>{sizeError ?? error}</p>
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)} disabled={exporting}>
				Cancel
			</Button>
			<Button onclick={exportNow} disabled={exporting || Boolean(sizeError)}>
				{#if exporting}
					<LoaderCircle class="size-4 animate-spin" />
					Exporting…
				{:else}
					<Download class="size-4" />
					Export {EXPORT_TAB_LABELS[activeTab]}
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
