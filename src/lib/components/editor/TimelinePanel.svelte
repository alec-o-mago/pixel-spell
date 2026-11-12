<script lang="ts">
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import ChevronUp from "@lucide/svelte/icons/chevron-up";
	import Copy from "@lucide/svelte/icons/copy";
	import Film from "@lucide/svelte/icons/film";
	import Pause from "@lucide/svelte/icons/pause";
	import Play from "@lucide/svelte/icons/play";
	import Plus from "@lucide/svelte/icons/plus";
	import ScanEye from "@lucide/svelte/icons/scan-eye";
	import SkipBack from "@lucide/svelte/icons/skip-back";
	import SkipForward from "@lucide/svelte/icons/skip-forward";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { Slider } from "$lib/components/ui/slider/index.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import {
		IMAGE_IMPORT_ACCEPT,
		analyzeImportFile,
	} from "$lib/editor/import.js";
	import { cn } from "$lib/utils.js";
	import TimelineLayerRow from "./TimelineLayerRow.svelte";

	let opacity = $state(100);
	let referenceInput = $state<HTMLInputElement>();
	let referenceLoading = $state(false);

	async function addReferenceLayer(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = "";
		if (!file) return;

		referenceLoading = true;
		try {
			const result = await analyzeImportFile(file);
			if (result.reference) {
				const image = {
					name: result.reference.name,
					width: result.reference.pixelWidth,
					height: result.reference.pixelHeight,
					pixels: result.reference.pixels,
				};
				// Replacing the current cel makes it easy to build a per-frame
				// reference sequence without creating a layer per image.
				if (!editor.setReferenceLayerImage(image)) {
					editor.importReferenceLayer(image, { allFrames: true });
				}
			} else {
				window.alert(
					result.error ?? "This file can't be used as a reference layer.",
				);
			}
			if (result.project) URL.revokeObjectURL(result.project.previewUrl);
		} catch {
			window.alert("This image could not be read.");
		} finally {
			referenceLoading = false;
		}
	}

	$effect(() => {
		opacity = Math.round(editor.activeLayer.opacity * 100);
	});

	function changeOpacity(value: number): void {
		editor.setLayerOpacity(editor.activeLayerId, value / 100);
	}

	$effect(() => {
		if (!editor.playing) return;
		const fps = Math.max(1, Math.min(60, editor.doc.fps || 12));
		const frameCount = editor.doc.frames.length;
		if (frameCount <= 1) return;

		const interval = window.setInterval(() => {
			editor.selectFrame((editor.activeFrame + 1) % frameCount);
		}, 1000 / fps);

		return () => window.clearInterval(interval);
	});
</script>

<section class="flex h-full min-h-0 flex-col bg-background">
	<header class="flex h-11 shrink-0 items-center gap-1.5 border-b px-3">
		<Film class="size-4 text-muted-foreground" />
		<span class="text-xs font-medium">Timeline</span>
		<Badge
			variant="secondary"
			class="h-5 px-1.5 text-[10px] tabular-nums"
			title={`${editor.doc.layers.length} layers, ${editor.frameCount} frames`}
		>
			{editor.doc.layers.length} × {editor.frameCount}
		</Badge>
		{#if editor.referenceLayerCount > 0}
			<Badge
				variant="outline"
				class="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground"
				title={`${editor.referenceLayerCount} reference layers`}
			>
				<ScanEye class="size-3" />
				{editor.referenceLayerCount}
			</Badge>
		{/if}

		<Separator orientation="vertical" class="mx-1.5 h-5" />
		<Button
			variant="ghost"
			size="icon-xs"
			class="text-muted-foreground"
			onclick={() => editor.addLayer()}
			title="Add layer"
			aria-label="Add layer"
		>
			<Plus class="size-3.5" />
		</Button>
		<Button
			variant="ghost"
			size="icon-xs"
			class="text-muted-foreground"
			onclick={() => referenceInput?.click()}
			disabled={referenceLoading}
			title="Add or replace reference layer from image"
			aria-label="Add or replace reference layer from image"
		>
			<ScanEye class="size-3.5" />
		</Button>
		<Button
			variant="ghost"
			size="icon-xs"
			class="text-muted-foreground"
			onclick={() => editor.duplicateLayer()}
			title="Duplicate layer"
			aria-label="Duplicate layer"
		>
			<Copy class="size-3.5" />
		</Button>
		<Button
			variant="ghost"
			size="icon-xs"
			class="text-muted-foreground"
			onclick={() => editor.moveLayerUp()}
			title="Move layer up"
			aria-label="Move layer up"
		>
			<ChevronUp class="size-3.5" />
		</Button>
		<Button
			variant="ghost"
			size="icon-xs"
			class="text-muted-foreground"
			onclick={() => editor.moveLayerDown()}
			title="Move layer down"
			aria-label="Move layer down"
		>
			<ChevronDown class="size-3.5" />
		</Button>
		<Button
			variant="ghost"
			size="icon-xs"
			class="text-muted-foreground hover:text-destructive"
			onclick={() => editor.deleteLayer()}
			disabled={editor.doc.layers.length <= 1}
			title="Delete layer"
			aria-label="Delete layer"
		>
			<Trash2 class="size-3.5" />
		</Button>

		<Separator orientation="vertical" class="mx-1.5 h-5" />
		<Button
			variant="ghost"
			size="icon-xs"
			class="text-muted-foreground"
			onclick={() => editor.addFrame()}
			title="Add frame"
			aria-label="Add frame"
		>
			<Plus class="size-3.5" />
		</Button>
		<Button
			variant="ghost"
			size="icon-xs"
			class="text-muted-foreground"
			onclick={() => editor.duplicateFrame()}
			title="Duplicate frame"
			aria-label="Duplicate frame"
		>
			<Copy class="size-3.5" />
		</Button>
		<Button
			variant="ghost"
			size="icon-xs"
			class="text-muted-foreground hover:text-destructive"
			onclick={() => editor.deleteFrame()}
			disabled={editor.frameCount <= 1}
			title="Delete frame"
			aria-label="Delete frame"
		>
			<Trash2 class="size-3.5" />
		</Button>

		<div class="ml-auto flex items-center gap-0.5">
			<Button
				variant="ghost"
				size="icon-xs"
				class="text-muted-foreground"
				onclick={() => editor.previousFrame()}
				title="Previous frame"
				aria-label="Previous frame"
			>
				<SkipBack class="size-3.5" />
			</Button>
			<Button
				variant={editor.playing ? "secondary" : "ghost"}
				size="icon-xs"
				class="text-muted-foreground"
				onclick={() => editor.togglePlayback()}
				title={editor.playing ? "Pause" : "Play"}
				aria-label={editor.playing ? "Pause animation" : "Play animation"}
			>
				{#if editor.playing}
					<Pause class="size-3.5" />
				{:else}
					<Play class="size-3.5" />
				{/if}
			</Button>
			<Button
				variant="ghost"
				size="icon-xs"
				class="text-muted-foreground"
				onclick={() => editor.nextFrame()}
				title="Next frame"
				aria-label="Next frame"
			>
				<SkipForward class="size-3.5" />
			</Button>

			<div class="ml-1 flex items-center gap-1 text-[10px] text-muted-foreground">
				<Input
					type="number"
					min={1}
					max={60}
					value={editor.doc.fps}
					onchange={(event) => editor.setFps(Number(event.currentTarget.value))}
					aria-label="Frames per second"
					class="h-6 w-12 px-1 text-center font-mono text-[11px]"
				/>
				<span>fps</span>
			</div>
		</div>
	</header>

	<input
		bind:this={referenceInput}
		type="file"
		accept={IMAGE_IMPORT_ACCEPT}
		class="hidden"
		onchange={addReferenceLayer}
	/>

	<div class="min-h-0 flex-1 overflow-auto">
		<table class="w-full border-separate border-spacing-0">
			<caption class="sr-only">Timeline: layers as rows, animation frames as columns</caption>
			<thead>
				<tr>
					<th
						scope="col"
						class="sticky left-0 top-0 z-30 h-8 w-60 min-w-60 max-w-60 border-b border-r bg-background px-3 text-left align-middle"
					>
						<span
							class="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"
						>
							Layers
						</span>
					</th>

					{#each editor.doc.frames as frame, index (frame.id)}
						<th
							scope="col"
							class="sticky top-0 z-20 h-8 w-14 min-w-14 border-b border-r bg-background p-0 align-middle"
						>
							<button
								type="button"
								class={cn(
									"flex h-8 w-full items-center justify-center gap-1 font-mono text-[10px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
									index === editor.activeFrame
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:bg-accent hover:text-foreground",
								)}
								onclick={() => editor.selectFrame(index)}
								aria-label={`Select frame ${index + 1}`}
								aria-pressed={index === editor.activeFrame}
							>
								{index + 1}
								{#if index === editor.activeFrame && editor.playing}
									<span class="size-1 rounded-full bg-primary-foreground/80"></span>
								{/if}
							</button>
						</th>
					{/each}

					<th
						scope="col"
						class="sticky top-0 z-20 h-8 w-10 min-w-10 border-b bg-background p-0 align-middle"
					>
						<Button
							variant="ghost"
							size="icon-xs"
							class="mx-auto flex size-7 text-muted-foreground"
							onclick={() => editor.addFrame()}
							title="Add frame"
							aria-label="Add frame"
						>
							<Plus class="size-3.5" />
						</Button>
					</th>
					<th scope="col" class="sticky top-0 z-20 h-8 border-b bg-background"></th>
				</tr>
			</thead>
			<tbody>
				{#each [...editor.doc.layers].reverse() as layer (layer.id)}
					<TimelineLayerRow {layer} />
				{/each}
			</tbody>
		</table>
	</div>

	<footer class="flex h-10 shrink-0 items-center gap-3 border-t px-3">
		<span class="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
			Opacity
		</span>
		<Slider
			type="single"
			min={0}
			max={100}
			step={1}
			bind:value={opacity}
			onValueChange={changeOpacity}
			class="max-w-64 flex-1"
		/>
		<span class="w-9 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
			{Math.round(editor.activeLayer.opacity * 100)}%
		</span>
	</footer>
</section>
