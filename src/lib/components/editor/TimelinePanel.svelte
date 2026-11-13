<script lang="ts">
	import ArrowLeft from "@lucide/svelte/icons/arrow-left";
	import ArrowRight from "@lucide/svelte/icons/arrow-right";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import ChevronUp from "@lucide/svelte/icons/chevron-up";
	import ClipboardCopy from "@lucide/svelte/icons/clipboard-copy";
	import ClipboardPaste from "@lucide/svelte/icons/clipboard-paste";
	import Copy from "@lucide/svelte/icons/copy";
	import Film from "@lucide/svelte/icons/film";
	import Ghost from "@lucide/svelte/icons/ghost";
	import Pause from "@lucide/svelte/icons/pause";
	import Play from "@lucide/svelte/icons/play";
	import Plus from "@lucide/svelte/icons/plus";
	import Repeat from "@lucide/svelte/icons/repeat";
	import ScanEye from "@lucide/svelte/icons/scan-eye";
	import Settings2 from "@lucide/svelte/icons/settings-2";
	import SkipBack from "@lucide/svelte/icons/skip-back";
	import SkipForward from "@lucide/svelte/icons/skip-forward";
	import Tag from "@lucide/svelte/icons/tag";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import { untrack } from "svelte";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { Slider } from "$lib/components/ui/slider/index.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import {
		IMAGE_IMPORT_ACCEPT,
		analyzeImportFile,
	} from "$lib/editor/import.js";
	import { cn } from "$lib/utils.js";
	import DuplicateFramesDialog from "./DuplicateFramesDialog.svelte";
	import FramePropertiesDialog from "./FramePropertiesDialog.svelte";
	import TimelineLayerRow from "./TimelineLayerRow.svelte";

	let opacity = $state(100);
	let referenceInput = $state<HTMLInputElement>();
	let referenceLoading = $state(false);

	let framePropertiesOpen = $state(false);
	let duplicateFramesOpen = $state(false);

	let contextMenu = $state<{
		x: number;
		y: number;
		frameIndex: number;
	} | null>(null);

	let draggingFrames = $state(false);
	let dragOverIndex = $state<number | null>(null);
	let dragOverSide = $state<"before" | "after">("before");

	const ONION_TINT_PRESETS = [
		{ id: "red-green", label: "Red / green", previous: "#ef4444", next: "#22c55e" },
		{ id: "amber-blue", label: "Amber / blue", previous: "#f59e0b", next: "#3b82f6" },
		{ id: "violet-teal", label: "Violet / teal", previous: "#8b5cf6", next: "#14b8a6" },
		{ id: "grayscale", label: "Grayscale", previous: "#71717a", next: "#a1a1aa" },
	];

	let tagGroups = $derived.by(() => {
		const frames = editor.doc.frames;
		const groups: { start: number; end: number; tag: string }[] = [];
		let start = 0;
		while (start < frames.length) {
			const tag = frames[start]!.tag ?? "";
			let end = start;
			while (end + 1 < frames.length && (frames[end + 1]!.tag ?? "") === tag) {
				end++;
			}
			groups.push({ start, end, tag });
			start = end + 1;
		}
		return groups;
	});

	let contextTitle = $derived.by(() => {
		if (!contextMenu) return "";
		const indices = editor.selectedFrameIndices;
		if (indices.length <= 1) return `Frame ${contextMenu.frameIndex + 1}`;
		return `Frames ${indices[0]! + 1}–${indices[indices.length - 1]! + 1} · ${indices.length} selected`;
	});

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
		if (editor.doc.frames.length <= 1) return;

		// Track timing and range inputs so playback restarts when they change,
		// but not activeFrame (the timer owns that while playing).
		editor.doc.fps;
		editor.doc.loopStart;
		editor.doc.loopEnd;
		editor.doc.frames.map((frame) => frame.duration ?? 0).join(",");

		let timer: number | undefined;
		const tick = (): void => {
			const frame = editor.nextPlaybackFrame();
			editor.selectFrame(frame, { preserveSelection: true });
			timer = window.setTimeout(
				tick,
				Math.max(10, editor.frameDurationAt(frame)),
			);
		};
		timer = window.setTimeout(
			tick,
			Math.max(
				10,
				untrack(() => editor.frameDurationAt(editor.activeFrame)),
			),
		);

		return () => {
			if (timer !== undefined) window.clearTimeout(timer);
		};
	});

	function handleFrameClick(event: MouseEvent, index: number): void {
		if (event.shiftKey) {
			editor.selectFrame(index, { extend: true });
		} else if (event.ctrlKey || event.metaKey) {
			editor.toggleFrameSelection(index);
		} else {
			editor.selectFrame(index);
		}
	}

	function openFrameContextMenu(event: MouseEvent, index: number): void {
		event.preventDefault();
		const width = 224;
		contextMenu = {
			x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
			y: Math.max(8, Math.min(event.clientY, window.innerHeight - 420)),
			frameIndex: index,
		};
	}

	function handleHeaderContextMenu(event: MouseEvent, index: number): void {
		if (editor.isFrameSelected(index)) {
			editor.selectFrame(index, { preserveSelection: true });
		} else {
			editor.selectFrame(index);
		}
		openFrameContextMenu(event, index);
	}

	function handleTagContextMenu(
		event: MouseEvent,
		start: number,
		end: number,
	): void {
		editor.selectFrameRange(start, end);
		openFrameContextMenu(event, start);
	}

	function closeContextMenu(): void {
		contextMenu = null;
	}

	function runMenuAction(action: () => void): void {
		action();
		contextMenu = null;
	}

	function handleWindowPointerDown(event: PointerEvent): void {
		if (!contextMenu) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest("[data-frame-menu]")) return;
		contextMenu = null;
	}

	function handleWindowKeydown(event: KeyboardEvent): void {
		if (!contextMenu || event.key !== "Escape") return;
		event.stopImmediatePropagation();
		contextMenu = null;
	}

	function beginFrameDrag(event: DragEvent, index: number): void {
		if (!editor.isFrameSelected(index)) editor.selectFrame(index);
		draggingFrames = true;
		dragOverIndex = null;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = "move";
			event.dataTransfer.setData("text/plain", String(index));
		}
	}

	function updateFrameDrag(event: DragEvent, index: number): void {
		if (!draggingFrames) return;
		event.preventDefault();
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		dragOverIndex = index;
		dragOverSide =
			event.clientX < rect.left + rect.width / 2 ? "before" : "after";
		if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
	}

	function finishFrameDrag(event: DragEvent, index: number): void {
		if (!draggingFrames) return;
		event.preventDefault();
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const side = event.clientX < rect.left + rect.width / 2 ? "before" : "after";
		editor.moveFramesTo(index + (side === "after" ? 1 : 0));
		draggingFrames = false;
		dragOverIndex = null;
	}

	function endFrameDrag(): void {
		draggingFrames = false;
		dragOverIndex = null;
	}

	function tagHue(tag: string): number {
		let hash = 0;
		for (let index = 0; index < tag.length; index++) {
			hash = (hash * 31 + tag.charCodeAt(index)) % 360;
		}
		return hash;
	}

	function tagBackground(tag: string): string {
		return `color-mix(in oklab, hsl(${tagHue(tag)} 70% 55%) 16%, var(--background))`;
	}

	function tagDot(tag: string): string {
		return `hsl(${tagHue(tag)} 65% 55%)`;
	}

	function onionPresetId(): string {
		const preset = ONION_TINT_PRESETS.find(
			(option) =>
				option.previous === editor.onionTintPrevious &&
				option.next === editor.onionTintNext,
		);
		return preset?.id ?? "custom";
	}

	function applyOnionPreset(id: string): void {
		const preset = ONION_TINT_PRESETS.find((option) => option.id === id);
		if (!preset) return;
		editor.setOnionTint("previous", preset.previous);
		editor.setOnionTint("next", preset.next);
	}
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
		{#if editor.selectedFrameCount > 1}
			<Badge
				variant="outline"
				class="h-5 px-1.5 text-[10px] tabular-nums"
				title={`${editor.selectedFrameCount} frames selected`}
			>
				{editor.selectedFrameCount} frames
			</Badge>
		{/if}
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
			onclick={() => editor.duplicateFrames(0, 0)}
			title="Duplicate selected frames"
			aria-label="Duplicate selected frames"
		>
			<Copy class="size-3.5" />
		</Button>
		<Button
			variant="ghost"
			size="icon-xs"
			class="text-muted-foreground"
			onclick={() => editor.copyFrames()}
			title="Copy selected frames"
			aria-label="Copy selected frames"
		>
			<ClipboardCopy class="size-3.5" />
		</Button>
		<Button
			variant="ghost"
			size="icon-xs"
			class="text-muted-foreground"
			onclick={() => editor.pasteFrames()}
			disabled={!editor.hasFrameClipboard}
			title="Paste frames after selection"
			aria-label="Paste frames"
		>
			<ClipboardPaste class="size-3.5" />
		</Button>
		<Button
			variant="ghost"
			size="icon-xs"
			class="text-muted-foreground hover:text-destructive"
			onclick={() => editor.deleteSelectedFrames()}
			disabled={
				editor.frameCount <= 1 ||
				editor.selectedFrameCount >= editor.frameCount
			}
			title="Delete selected frames"
			aria-label="Delete selected frames"
		>
			<Trash2 class="size-3.5" />
		</Button>
		<Button
			variant="ghost"
			size="icon-xs"
			class="text-muted-foreground"
			onclick={() => (framePropertiesOpen = true)}
			title="Frame properties"
			aria-label="Frame properties"
		>
			<Settings2 class="size-3.5" />
		</Button>

		<Separator orientation="vertical" class="mx-1.5 h-5" />
		<Button
			variant={editor.onionEnabled ? "secondary" : "ghost"}
			size="icon-xs"
			class="text-muted-foreground"
			onclick={() => editor.toggleOnion()}
			title="Toggle onion skin (O)"
			aria-label="Toggle onion skin"
			aria-pressed={editor.onionEnabled}
		>
			<Ghost class="size-3.5" />
		</Button>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class="grid size-7 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
				aria-label="Onion skin settings"
				title="Onion skin settings"
			>
				<ChevronDown class="size-3.5" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="w-60" align="start">
				<DropdownMenu.Label>Onion skin</DropdownMenu.Label>
				<DropdownMenu.CheckboxItem bind:checked={editor.onionEnabled}>
					Enabled
					<DropdownMenu.Shortcut>O</DropdownMenu.Shortcut>
				</DropdownMenu.CheckboxItem>
				<DropdownMenu.CheckboxItem bind:checked={editor.onionShowPrevious}>
					Show previous frames
				</DropdownMenu.CheckboxItem>
				<DropdownMenu.CheckboxItem bind:checked={editor.onionShowNext}>
					Show next frames
				</DropdownMenu.CheckboxItem>
				<DropdownMenu.Separator />
				<DropdownMenu.Label>Range</DropdownMenu.Label>
				<DropdownMenu.RadioGroup
					value={String(editor.onionRange)}
					onValueChange={(value) => editor.setOnionRange(Number(value))}
				>
					{#each [1, 2, 3] as range (range)}
						<DropdownMenu.RadioItem value={String(range)} closeOnSelect>
							±{range} {range === 1 ? "frame" : "frames"}
						</DropdownMenu.RadioItem>
					{/each}
				</DropdownMenu.RadioGroup>
				<DropdownMenu.Label>Opacity</DropdownMenu.Label>
				<DropdownMenu.RadioGroup
					value={String(Math.round(editor.onionOpacity * 100))}
					onValueChange={(value) =>
						editor.setOnionOpacity(Number(value) / 100)}
				>
					{#each [15, 30, 50] as percent (percent)}
						<DropdownMenu.RadioItem value={String(percent)} closeOnSelect>
							{percent}%
						</DropdownMenu.RadioItem>
					{/each}
				</DropdownMenu.RadioGroup>
				<DropdownMenu.Label>Tint</DropdownMenu.Label>
				<DropdownMenu.RadioGroup
					value={onionPresetId()}
					onValueChange={applyOnionPreset}
				>
					{#each ONION_TINT_PRESETS as preset (preset.id)}
						<DropdownMenu.RadioItem value={preset.id} closeOnSelect>
							<span class="flex items-center gap-1.5">
								<span
									class="size-2 rounded-full"
									style:background={preset.previous}
								></span>
								<span
									class="size-2 rounded-full"
									style:background={preset.next}
								></span>
								{preset.label}
							</span>
						</DropdownMenu.RadioItem>
					{/each}
				</DropdownMenu.RadioGroup>
			</DropdownMenu.Content>
		</DropdownMenu.Root>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class={cn(
					"grid size-7 place-items-center rounded-md outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
					editor.hasLoopRange
						? "bg-secondary text-foreground"
						: "text-muted-foreground",
				)}
				aria-label="Loop range settings"
				title="Loop range"
			>
				<Repeat class="size-3.5" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="w-56" align="start">
				<DropdownMenu.Label>
					{editor.hasLoopRange
						? `Loop frames ${editor.loopRange.start + 1}–${editor.loopRange.end + 1}`
						: "Loop: whole animation"}
				</DropdownMenu.Label>
				<DropdownMenu.Item
					onSelect={() => editor.setLoopRangeToSelection()}
					disabled={editor.selectedFrameCount === 0}
				>
					Use selected frames
				</DropdownMenu.Item>
				<DropdownMenu.Item
					onSelect={() => editor.setLoopStartAt(editor.activeFrame)}
				>
					Start at active frame
				</DropdownMenu.Item>
				<DropdownMenu.Item
					onSelect={() => editor.setLoopEndAt(editor.activeFrame)}
				>
					End at active frame
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item
					onSelect={() => editor.clearLoopRange()}
					disabled={!editor.hasLoopRange}
				>
					Clear loop range
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>

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
					title="Fallback frames per second for frames without a custom duration"
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
						class="sticky left-0 top-0 z-40 h-6 w-60 min-w-60 max-w-60 border-b border-r bg-background px-3 text-left align-middle"
					>
						<span class="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
							<Tag class="size-2.5" />
							Tags
						</span>
					</th>

					{#each tagGroups as group (group.start)}
						<th
							colspan={group.end - group.start + 1}
							scope="colgroup"
							class={cn(
								"sticky top-0 z-20 h-6 border-b border-r p-0 text-left align-middle",
								group.tag && "border-border/60",
							)}
							style:background={group.tag
								? tagBackground(group.tag)
								: "var(--background)"}
						>
							{#if group.tag}
								<button
									type="button"
									class="flex h-6 w-full min-w-0 items-center gap-1 px-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
									onclick={() => editor.selectFrameRange(group.start, group.end)}
									oncontextmenu={(event) =>
										handleTagContextMenu(event, group.start, group.end)}
									ondblclick={() => {
										editor.selectFrameRange(group.start, group.end);
										framePropertiesOpen = true;
									}}
									title={`${group.tag} · frames ${group.start + 1}–${group.end + 1}. Click to select, double-click to edit.`}
								>
									<span
										class="size-1.5 shrink-0 rounded-full"
										style:background={tagDot(group.tag)}
									></span>
									<span class="truncate text-[9px] font-medium text-foreground/80">
										{group.tag}
									</span>
								</button>
							{/if}
						</th>
					{/each}

					<th
						colspan="2"
						class="sticky top-0 z-20 h-6 border-b bg-background"
					></th>
				</tr>

				<tr>
					<th
						scope="col"
						class="sticky left-0 top-6 z-30 h-8 w-60 min-w-60 max-w-60 border-b border-r bg-background px-3 text-left align-middle"
					>
						<span
							class="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"
						>
							Layers
						</span>
					</th>

					{#each editor.doc.frames as frame, index (frame.id)}
						{@const selected = editor.isFrameSelected(index)}
						{@const inLoop =
							editor.hasLoopRange &&
							index >= editor.loopRange.start &&
							index <= editor.loopRange.end}
						<th
							scope="col"
							class="sticky top-6 z-20 h-8 w-14 min-w-14 border-b border-r bg-background p-0 align-middle"
						>
							<button
								type="button"
								class={cn(
									"relative flex h-8 w-full flex-col items-center justify-center gap-0.5 font-mono text-[10px] leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
									index === editor.activeFrame
										? "bg-primary text-primary-foreground"
										: selected
											? "bg-primary/15 text-foreground hover:bg-primary/25"
											: "text-muted-foreground hover:bg-accent hover:text-foreground",
								)}
								draggable="true"
								onclick={(event) => handleFrameClick(event, index)}
								ondblclick={() => (framePropertiesOpen = true)}
								oncontextmenu={(event) => handleHeaderContextMenu(event, index)}
								ondragstart={(event) => beginFrameDrag(event, index)}
								ondragover={(event) => updateFrameDrag(event, index)}
								ondrop={(event) => finishFrameDrag(event, index)}
								ondragend={endFrameDrag}
								aria-label={`Select frame ${index + 1}${frame.tag ? `, ${frame.tag}` : ""}`}
								aria-pressed={index === editor.activeFrame}
								title={`Frame ${index + 1} · ${Math.round(editor.frameDurationAt(index))} ms${frame.tag ? ` · ${frame.tag}` : ""}. Double-click for properties.`}
							>
								<span class="flex items-center gap-1">
									{index + 1}
									{#if index === editor.activeFrame && editor.playing}
										<span class="size-1 rounded-full bg-primary-foreground/80"></span>
									{/if}
								</span>
								<span
									class={cn(
										"text-[7px] font-normal",
										frame.duration !== undefined ? "opacity-95" : "opacity-60",
									)}
								>
									{Math.round(editor.frameDurationAt(index))}
								</span>
								{#if inLoop}
									<span
										class="pointer-events-none absolute inset-x-1 bottom-0.5 h-0.5 rounded-full bg-amber-400"
										aria-hidden="true"
									></span>
								{/if}
								{#if dragOverIndex === index}
									<span
										class={cn(
											"pointer-events-none absolute inset-y-0 w-0.5 bg-primary",
											dragOverSide === "before" ? "left-0" : "right-0",
										)}
										aria-hidden="true"
									></span>
								{/if}
							</button>
						</th>
					{/each}

					<th
						scope="col"
						class="sticky top-6 z-20 h-8 w-10 min-w-10 border-b bg-background p-0 align-middle"
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
					<th scope="col" class="sticky top-6 z-20 h-8 border-b bg-background"></th>
				</tr>
			</thead>
			<tbody>
				{#each [...editor.doc.layers].reverse() as layer (layer.id)}
					<TimelineLayerRow {layer} onFrameContextMenu={openFrameContextMenu} />
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

{#if contextMenu}
	<div
		data-frame-menu
		class="fixed z-50 max-h-[calc(100svh-1rem)] w-56 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
		role="menu"
		aria-label="Frame actions"
		style:left={`${contextMenu.x}px`}
		style:top={`${contextMenu.y}px`}
	>
		<div class="px-2 py-1 text-[10px] font-medium text-muted-foreground">
			{contextTitle}
		</div>
		<button
			type="button"
			role="menuitem"
			class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40"
			onclick={() => runMenuAction(() => editor.copyFrames())}
		>
			<ClipboardCopy class="size-3.5 text-muted-foreground" />
			Copy frames
		</button>
		<button
			type="button"
			role="menuitem"
			class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40"
			onclick={() => runMenuAction(() => editor.pasteFrames())}
			disabled={!editor.hasFrameClipboard}
		>
			<ClipboardPaste class="size-3.5 text-muted-foreground" />
			Paste frames
		</button>
		<button
			type="button"
			role="menuitem"
			class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40"
			onclick={() => runMenuAction(() => (duplicateFramesOpen = true))}
		>
			<Copy class="size-3.5 text-muted-foreground" />
			Duplicate frames…
		</button>
		<button
			type="button"
			role="menuitem"
			class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40"
			onclick={() => runMenuAction(() => (framePropertiesOpen = true))}
		>
			<Settings2 class="size-3.5 text-muted-foreground" />
			Frame properties…
		</button>

		<div class="my-1 h-px bg-border"></div>

		<button
			type="button"
			role="menuitem"
			class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40"
			onclick={() => runMenuAction(() => editor.moveSelectedFrames(-1))}
		>
			<ArrowLeft class="size-3.5 text-muted-foreground" />
			Move frames left
		</button>
		<button
			type="button"
			role="menuitem"
			class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40"
			onclick={() => runMenuAction(() => editor.moveSelectedFrames(1))}
		>
			<ArrowRight class="size-3.5 text-muted-foreground" />
			Move frames right
		</button>

		<div class="my-1 h-px bg-border"></div>

		<button
			type="button"
			role="menuitem"
			class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40"
			onclick={() => runMenuAction(() => editor.setLoopRangeToSelection())}
			disabled={editor.selectedFrameCount === 0}
		>
			<Repeat class="size-3.5 text-muted-foreground" />
			Loop selected frames
		</button>
		<button
			type="button"
			role="menuitem"
			class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40"
			onclick={() =>
				runMenuAction(() =>
					editor.setLoopStartAt(contextMenu!.frameIndex),
				)}
		>
			<Repeat class="size-3.5 text-muted-foreground" />
			Loop start here
		</button>
		<button
			type="button"
			role="menuitem"
			class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40"
			onclick={() =>
				runMenuAction(() => editor.setLoopEndAt(contextMenu!.frameIndex))
			}
		>
			<Repeat class="size-3.5 text-muted-foreground" />
			Loop end here
		</button>
		<button
			type="button"
			role="menuitem"
			class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40"
			onclick={() => runMenuAction(() => editor.clearLoopRange())}
			disabled={!editor.hasLoopRange}
		>
			<Repeat class="size-3.5 text-muted-foreground" />
			Clear loop range
		</button>

		<div class="my-1 h-px bg-border"></div>

		<button
			type="button"
			role="menuitem"
			class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-destructive outline-none hover:bg-destructive/10 focus-visible:bg-destructive/10 disabled:pointer-events-none disabled:opacity-40"
			onclick={() => runMenuAction(() => editor.deleteSelectedFrames())}
			disabled={
				editor.frameCount <= 1 ||
				editor.selectedFrameCount >= editor.frameCount
			}
		>
			<Trash2 class="size-3.5" />
			Delete frames
		</button>
	</div>
{/if}

<FramePropertiesDialog bind:open={framePropertiesOpen} />
<DuplicateFramesDialog bind:open={duplicateFramesOpen} />

<svelte:window
	onpointerdown={handleWindowPointerDown}
	onkeydown={handleWindowKeydown}
/>
