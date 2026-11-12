<script lang="ts">
	import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
	import Film from "@lucide/svelte/icons/film";
	import ImageIcon from "@lucide/svelte/icons/image";
	import Images from "@lucide/svelte/icons/images";
	import Layers from "@lucide/svelte/icons/layers";
	import LoaderCircle from "@lucide/svelte/icons/loader-circle";
	import PaletteIcon from "@lucide/svelte/icons/palette";
	import ScanEye from "@lucide/svelte/icons/scan-eye";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import {
		MAX_IMPORT_DIMENSION,
		analyzeImportFile,
		type ImportAnalysis,
		type ImportTabId,
	} from "$lib/editor/import.js";
	import { cn } from "$lib/utils.js";

	let { open = $bindable(false), file = null }: { open?: boolean; file?: File | null } = $props();

	let analysis = $state<ImportAnalysis | null>(null);
	let loading = $state(false);
	let activeTab = $state<ImportTabId>("project");
	let projectName = $state("");
	let paletteName = $state("");
	let layerName = $state("");
	let referenceName = $state("");
	let referenceAllFrames = $state(true);
	let loadToken = 0;

	const TAB_LABELS: Record<ImportTabId, string> = {
		project: "Project",
		layer: "Layer",
		frames: "Frames",
		"reference-layer": "Reference Layer",
		"reference-board": "Reference Board",
		palette: "Palette",
	};

	const ACTION_LABELS: Record<ImportTabId, string> = {
		project: "Import Project",
		layer: "Add Layer",
		frames: "Add Frame",
		"reference-layer": "Add Reference Layer",
		"reference-board": "Add to Reference Board",
		palette: "Import Palette",
	};

	const PALETTE_SOURCE_LABELS = {
		png: "PNG image",
		pal: "JASC palette",
		gpl: "GIMP palette",
		hex: "HEX palette",
	};

	function tabAvailable(tab: ImportTabId): boolean {
		if (tab === "project" || tab === "layer" || tab === "frames") {
			return Boolean(analysis?.project);
		}
		if (tab === "reference-layer" || tab === "reference-board") {
			return Boolean(analysis?.reference);
		}
		return Boolean(analysis?.palette);
	}

	let availableTabs = $derived.by((): ImportTabId[] => {
		const tabs: ImportTabId[] = [];
		if (analysis?.project) tabs.push("project", "layer", "frames");
		if (analysis?.reference) tabs.push("reference-layer", "reference-board");
		if (analysis?.palette) tabs.push("palette");
		return tabs;
	});

	let canImport = $derived(!loading && Boolean(analysis) && tabAvailable(activeTab));
	let actionLabel = $derived(ACTION_LABELS[activeTab]);

	$effect(() => {
		const selectedFile = file;
		if (!open || !selectedFile) return;

		const token = ++loadToken;
		analysis = null;
		loading = true;
		activeTab = "project";
		projectName = "";
		paletteName = "";
		layerName = "";
		referenceName = "";
		referenceAllFrames = true;

		analyzeImportFile(selectedFile)
			.then((result) => {
				if (token !== loadToken) {
					// The dialog was closed or another file replaced this one.
					if (result.project) URL.revokeObjectURL(result.project.previewUrl);
					return;
				}

				analysis = result;
				loading = false;
				activeTab = result.project ? "project" : result.palette ? "palette" : "project";
				projectName = result.project?.name ?? "";
				paletteName = result.palette?.name ?? "";
				layerName = result.project?.name ?? "";
				referenceName = result.reference?.name ?? "";
			})
			.catch(() => {
				if (token !== loadToken) return;
				analysis = {
					fileName: selectedFile.name,
					project: null,
					reference: null,
					palette: null,
					error: "This file could not be read.",
				};
				loading = false;
			});
	});

	// Revoke the preview object URL when the analysis is replaced or cleared.
	$effect(() => {
		const previewUrl = analysis?.project?.previewUrl;
		return () => {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		};
	});

	$effect(() => {
		if (open) return;
		loadToken++;
		analysis = null;
		loading = false;
	});

	function importNow(): void {
		if (!analysis) return;

		if (activeTab === "project" && analysis.project) {
			editor.importImageProject({
				name: projectName,
				width: analysis.project.width,
				height: analysis.project.height,
				pixels: analysis.project.pixels,
			});
		} else if (activeTab === "layer" && analysis.project) {
			editor.importImageLayer({
				name: layerName,
				width: analysis.project.width,
				height: analysis.project.height,
				pixels: analysis.project.pixels,
			});
		} else if (activeTab === "frames" && analysis.project) {
			editor.importImageFrame({
				name: layerName,
				width: analysis.project.width,
				height: analysis.project.height,
				pixels: analysis.project.pixels,
			});
		} else if (activeTab === "reference-layer" && analysis.reference) {
			editor.importReferenceLayer(
				{
					name: layerName,
					width: analysis.reference.pixelWidth,
					height: analysis.reference.pixelHeight,
					pixels: analysis.reference.pixels,
				},
				{ allFrames: referenceAllFrames },
			);
		} else if (activeTab === "reference-board" && analysis.reference) {
			editor.addReferenceImage({
				name: referenceName,
				bytes: analysis.reference.bytes,
				mime: analysis.reference.mime,
				imageWidth: analysis.reference.width,
				imageHeight: analysis.reference.height,
			});
		} else if (activeTab === "palette" && analysis.palette) {
			editor.importPalette(paletteName, analysis.palette.colors);
		}

		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Import file</Dialog.Title>
			<Dialog.Description>
				{#if file}
					<span class="font-medium break-all text-foreground">{file.name}</span>
					—
				{/if}
				Choose how you want to use this file.
			</Dialog.Description>
		</Dialog.Header>

		{#if loading}
			<div class="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
				<LoaderCircle class="size-4 animate-spin" />
				Reading {file?.name ?? "file"}…
			</div>
		{:else if analysis}
			{#if availableTabs.length === 0}
				<div class="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
					<AlertTriangle class="mt-0.5 size-4 shrink-0 text-destructive" />
					<div class="grid gap-1">
						<p class="text-sm font-medium">This file can't be imported</p>
						<p class="text-xs text-muted-foreground">
							{analysis.error ?? "The file is not a supported image or palette."}
						</p>
					</div>
				</div>
			{:else}
				<div
					role="tablist"
					aria-label="Import type"
					class="grid grid-cols-3 gap-0.5 rounded-lg border bg-muted/40 p-0.5"
				>
					{#each availableTabs as tab (tab)}
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === tab}
							class={cn(
								"flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
								activeTab === tab
									? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
									: "text-muted-foreground hover:text-foreground",
							)}
							onclick={() => (activeTab = tab)}
						>
							{#if tab === "project"}
								<ImageIcon class="size-3.5 shrink-0" />
							{:else if tab === "layer"}
								<Layers class="size-3.5 shrink-0" />
							{:else if tab === "frames"}
								<Film class="size-3.5 shrink-0" />
							{:else if tab === "reference-layer"}
								<ScanEye class="size-3.5 shrink-0" />
							{:else if tab === "reference-board"}
								<Images class="size-3.5 shrink-0" />
							{:else}
								<PaletteIcon class="size-3.5 shrink-0" />
							{/if}
							<span class="truncate">{TAB_LABELS[tab]}</span>
						</button>
					{/each}
				</div>

				{#if activeTab === "project" && analysis.project}
					{@const project = analysis.project}
					<div role="tabpanel" aria-label="Project import" class="grid gap-4">
						<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
							<div class="grid content-start gap-1.5">
								<Label for="import-project-name">Name</Label>
								<Input
									id="import-project-name"
									bind:value={projectName}
									maxlength={60}
									placeholder="Imported"
									autocomplete="off"
								/>
								<p class="text-xs text-muted-foreground">
									Creates a new project tab with the image on a single layer.
								</p>
							</div>

							<div
								class="checkerboard relative flex h-24 items-center justify-center overflow-hidden rounded-lg ring-1 ring-border"
							>
								<img
									src={project.previewUrl}
									alt="Preview of the file"
									class="h-full w-full object-contain [image-rendering:pixelated]"
								/>
							</div>
						</div>

						<div
							class="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground"
						>
							<span class="font-mono tabular-nums">
								{project.originalWidth} × {project.originalHeight} px
							</span>
							<span>
								{project.width} × {project.height} px import
							</span>
						</div>

						{#if project.originalWidth > MAX_IMPORT_DIMENSION || project.originalHeight > MAX_IMPORT_DIMENSION}
							<div class="flex gap-2.5 rounded-lg border bg-muted/40 p-3 text-xs">
								<AlertTriangle class="mt-0.5 size-4 shrink-0 text-primary" />
								<p>
									This image is larger than {MAX_IMPORT_DIMENSION} × {MAX_IMPORT_DIMENSION}px.
									Only the top-left {MAX_IMPORT_DIMENSION} × {MAX_IMPORT_DIMENSION} pixels will
									be imported; the extra pixels will be cut.
								</p>
							</div>
						{/if}
					</div>
				{:else if activeTab === "layer" && analysis.project}
					{@const project = analysis.project}
					<div role="tabpanel" aria-label="Layer import" class="grid gap-4">
						<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
							<div class="grid content-start gap-1.5">
								<Label for="import-layer-name">Layer name</Label>
								<Input
									id="import-layer-name"
									bind:value={layerName}
									maxlength={60}
									placeholder="Imported layer"
									autocomplete="off"
								/>
								<p class="text-xs text-muted-foreground">
									Adds a normal layer to the active project on frame
									{editor.activeFrame + 1}. The image is placed at the top-left and
									cropped to the canvas.
								</p>
							</div>
							<div
								class="checkerboard relative flex h-24 items-center justify-center overflow-hidden rounded-lg ring-1 ring-border"
							>
								<img
									src={project.previewUrl}
									alt="Preview of the file"
									class="h-full w-full object-contain [image-rendering:pixelated]"
								/>
							</div>
						</div>
						<div
							class="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground"
						>
							<span class="font-mono tabular-nums">
								{project.width} × {project.height} px image
							</span>
							<span class="font-mono tabular-nums">
								{editor.doc.width} × {editor.doc.height} px canvas
							</span>
						</div>
					</div>
				{:else if activeTab === "frames" && analysis.project}
					{@const project = analysis.project}
					<div role="tabpanel" aria-label="Frame import" class="grid gap-4">
						<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
							<div class="grid content-start gap-1.5">
								<Label for="import-frame-layer-name">Layer name if needed</Label>
								<Input
									id="import-frame-layer-name"
									bind:value={layerName}
									maxlength={60}
									placeholder="Imported frame"
									autocomplete="off"
								/>
								<p class="text-xs text-muted-foreground">
									Adds a new frame after frame {editor.activeFrame + 1} and places the
									image on the active normal layer. If no normal layer is available, a
									new layer is created.
								</p>
							</div>
							<div
								class="checkerboard relative flex h-24 items-center justify-center overflow-hidden rounded-lg ring-1 ring-border"
							>
								<img
									src={project.previewUrl}
									alt="Preview of the file"
									class="h-full w-full object-contain [image-rendering:pixelated]"
								/>
							</div>
						</div>
						<div
							class="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground"
						>
							<span class="font-mono tabular-nums">
								{project.width} × {project.height} px image
							</span>
							<span>
								{editor.frameCount} {editor.frameCount === 1 ? "frame" : "frames"} now
							</span>
						</div>
					</div>
				{:else if activeTab === "reference-layer" && analysis.project && analysis.reference}
					{@const project = analysis.project}
					{@const reference = analysis.reference}
					<div role="tabpanel" aria-label="Reference layer import" class="grid gap-4">
						<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
							<div class="grid content-start gap-1.5">
								<Label for="import-reference-layer-name">Reference name</Label>
								<Input
									id="import-reference-layer-name"
									bind:value={layerName}
									maxlength={60}
									placeholder="Reference"
									autocomplete="off"
								/>
								<p class="text-xs text-muted-foreground">
									Adds a locked reference layer to the timeline. The image is fitted to
									the canvas, cannot be drawn on, and is never exported.
								</p>
								<label class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
									<input
										type="checkbox"
										bind:checked={referenceAllFrames}
										class="size-3.5 rounded border-input accent-primary"
									/>
									Apply to all frames
								</label>
							</div>
							<div
								class="checkerboard relative flex h-24 items-center justify-center overflow-hidden rounded-lg ring-1 ring-border"
							>
								<img
									src={project.previewUrl}
									alt="Preview of the file"
									class="h-full w-full object-contain [image-rendering:pixelated]"
								/>
							</div>
						</div>
						<div
							class="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground"
						>
							<span class="font-mono tabular-nums">
								{reference.width} × {reference.height} px source
							</span>
							<span class="font-mono tabular-nums">
								fits {editor.doc.width} × {editor.doc.height} px canvas
							</span>
						</div>
					</div>
				{:else if activeTab === "reference-board" && analysis.reference}
					{@const reference = analysis.reference}
					<div role="tabpanel" aria-label="Reference board import" class="grid gap-4">
						<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
							<div class="grid content-start gap-1.5">
								<Label for="import-reference-name">Reference name</Label>
								<Input
									id="import-reference-name"
									bind:value={referenceName}
									maxlength={60}
									placeholder="Reference"
									autocomplete="off"
								/>
								<p class="text-xs text-muted-foreground">
									Adds an image to the project-level reference board. It is independent
									of layers and frames, can be moved outside the canvas, and is never
									exported.
								</p>
							</div>
							{#if analysis.project}
								<div
									class="checkerboard relative flex h-24 items-center justify-center overflow-hidden rounded-lg ring-1 ring-border"
								>
									<img
										src={analysis.project.previewUrl}
										alt="Preview of the file"
										class="h-full w-full object-contain [image-rendering:auto]"
									/>
								</div>
							{/if}
						</div>
						<div
							class="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground"
						>
							<span class="font-mono tabular-nums">
								{reference.width} × {reference.height} px source
							</span>
							<span>Full resolution is embedded in the project</span>
						</div>
					</div>
				{:else if activeTab === "palette" && analysis.palette}
					{@const palette = analysis.palette}
					<div role="tabpanel" aria-label="Palette import" class="grid gap-4">
						<div class="grid gap-1.5">
							<Label for="import-palette-name">Name</Label>
							<Input
								id="import-palette-name"
								bind:value={paletteName}
								maxlength={40}
								placeholder="Imported palette"
								autocomplete="off"
							/>
							<p class="text-xs text-muted-foreground">
								{palette.colors.length}
								{palette.colors.length === 1 ? " color" : " colors"} from
								{PALETTE_SOURCE_LABELS[palette.source]}.
							</p>
						</div>

						<div class="max-h-52 overflow-y-auto rounded-lg border bg-muted/20 p-2">
							<div class="grid grid-cols-8 gap-1.5">
								{#each palette.colors as color (color)}
									<span
										class="relative aspect-square rounded-[5px] ring-1 ring-black/10"
										style={`background-color: ${color}`}
										title={color}
									></span>
								{/each}
							</div>
						</div>

						{#if palette.truncated}
							<div class="flex gap-2.5 rounded-lg border bg-muted/40 p-3 text-xs">
								<AlertTriangle class="mt-0.5 size-4 shrink-0 text-primary" />
								<p>
									This palette has more than 256 colors. Only the first 256 colors will be
									imported; the extra colors will be cut.
								</p>
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			{#if availableTabs.length > 0}
				<Button onclick={importNow} disabled={!canImport}>{actionLabel}</Button>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
