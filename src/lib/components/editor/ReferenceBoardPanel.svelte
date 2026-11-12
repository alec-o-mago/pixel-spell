<script lang="ts">
	import Eye from "@lucide/svelte/icons/eye";
	import EyeOff from "@lucide/svelte/icons/eye-off";
	import ImagePlus from "@lucide/svelte/icons/image-plus";
	import Images from "@lucide/svelte/icons/images";
	import LoaderCircle from "@lucide/svelte/icons/loader-circle";
	import Lock from "@lucide/svelte/icons/lock";
	import LockOpen from "@lucide/svelte/icons/lock-open";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import X from "@lucide/svelte/icons/x";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Slider } from "$lib/components/ui/slider/index.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import {
		IMAGE_IMPORT_ACCEPT,
		analyzeImportFile,
	} from "$lib/editor/import.js";
	import { cn } from "$lib/utils.js";
	import ReferenceThumb from "./ReferenceThumb.svelte";

	let fileInput = $state<HTMLInputElement>();
	let loading = $state(false);
	let error = $state("");
	let opacity = $state(100);
	let width = $state(64);
	let nameDraft = $state("");

	let active = $derived(editor.activeReference);

	$effect(() => {
		if (!editor.showReferenceBoard) editor.clearReferenceSelection();
	});

	$effect(() => {
		const reference = active;
		opacity = reference ? Math.round(reference.opacity * 100) : 100;
		width = reference ? Math.round(reference.width) : 64;
		nameDraft = reference?.name ?? "";
	});

	async function handleFile(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = "";
		if (!file) return;

		loading = true;
		error = "";
		try {
			const result = await analyzeImportFile(file);
			if (result.reference) {
				editor.addReferenceImage({
					name: result.reference.name,
					bytes: result.reference.bytes,
					mime: result.reference.mime,
					imageWidth: result.reference.width,
					imageHeight: result.reference.height,
				});
			} else {
				error = result.error ?? "This file can't be used as a reference image.";
			}
			if (result.project) URL.revokeObjectURL(result.project.previewUrl);
		} catch {
			error = "This image could not be read.";
		} finally {
			loading = false;
		}
	}

	function commitName(): void {
		if (active) editor.renameReference(active.id, nameDraft);
	}

	function changeOpacity(value: number): void {
		if (active) editor.setReferenceOpacity(active.id, value / 100);
	}

	function changeWidth(): void {
		if (active) editor.setReferenceSize(active.id, width);
	}

	function close(): void {
		editor.clearReferenceSelection();
		editor.showReferenceBoard = false;
	}
</script>

{#if editor.showReferenceBoard}
	<div
		class="absolute left-3 top-3 z-20 w-80 max-w-[calc(100%_-_1.5rem)] overflow-hidden rounded-lg border bg-background/95 shadow-lg backdrop-blur"
	>
		<header class="flex h-9 items-center gap-2 border-b px-2.5">
			<Images class="size-4 text-muted-foreground" />
			<span class="text-[11px] font-medium">Reference Board</span>
			<span class="text-[10px] tabular-nums text-muted-foreground">
				{editor.doc.references.length}
			</span>
			<div class="ml-auto flex items-center gap-0.5">
				<Button
					variant="ghost"
					size="icon-xs"
					class="text-muted-foreground"
					onclick={() => fileInput?.click()}
					disabled={loading}
					title="Add reference image"
					aria-label="Add reference image"
				>
					{#if loading}
						<LoaderCircle class="size-3.5 animate-spin" />
					{:else}
						<ImagePlus class="size-3.5" />
					{/if}
				</Button>
				<button
					type="button"
					class="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					onclick={close}
					title="Close reference board"
					aria-label="Close reference board"
				>
					<X class="size-3.5" />
				</button>
			</div>
		</header>

		{#if editor.doc.references.length === 0}
			<div class="grid gap-2 p-3">
				<p class="text-xs text-muted-foreground">
					Add images to use as a mood board. Board references are independent of
					layers and frames, can sit outside the canvas, and are never exported.
				</p>
				<Button
					variant="outline"
					size="sm"
					class="h-7 w-fit text-xs"
					onclick={() => fileInput?.click()}
					disabled={loading}
				>
					<ImagePlus class="size-3.5" />
					Add image
				</Button>
			</div>
		{:else}
			<div class="max-h-64 overflow-auto">
				{#each editor.doc.references as reference (reference.id)}
					{@const isActive = reference.id === editor.activeReferenceId}
					<div
						class={cn(
							"flex items-center gap-1 border-b px-2 py-1.5 last:border-b-0",
							isActive && "bg-accent/60",
						)}
					>
						<button
							type="button"
							class="flex min-w-0 flex-1 items-center gap-2 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onclick={() => editor.selectReferenceImage(reference.id)}
							aria-pressed={isActive}
						>
							<span
								class="checkerboard size-9 shrink-0 overflow-hidden rounded border border-border/60"
							>
								<ReferenceThumb {reference} />
							</span>
							<span class="min-w-0">
								<span class="block truncate text-[11px] font-medium">
									{reference.name}
								</span>
								<span class="block truncate text-[10px] text-muted-foreground">
									{Math.round(reference.width)} × {Math.round(reference.height)} px ·
									{Math.round(reference.opacity * 100)}%
								</span>
							</span>
						</button>
						<Button
							variant="ghost"
							size="icon-xs"
							class={cn(
								"size-6 shrink-0",
								reference.visible ? "text-foreground" : "text-muted-foreground/50",
							)}
							onclick={() => editor.toggleReferenceVisibility(reference.id)}
							title={reference.visible ? `Hide ${reference.name}` : `Show ${reference.name}`}
							aria-label={reference.visible ? `Hide ${reference.name}` : `Show ${reference.name}`}
						>
							{#if reference.visible}
								<Eye class="size-3.5" />
							{:else}
								<EyeOff class="size-3.5" />
							{/if}
						</Button>
						<Button
							variant="ghost"
							size="icon-xs"
							class={cn(
								"size-6 shrink-0",
								reference.locked ? "text-foreground" : "text-muted-foreground",
							)}
							onclick={() => editor.toggleReferenceLock(reference.id)}
							title={reference.locked ? `Unlock ${reference.name}` : `Lock ${reference.name}`}
							aria-label={reference.locked ? `Unlock ${reference.name}` : `Lock ${reference.name}`}
							aria-pressed={reference.locked}
						>
							{#if reference.locked}
								<Lock class="size-3.5" />
							{:else}
								<LockOpen class="size-3.5" />
							{/if}
						</Button>
						<Button
							variant="ghost"
							size="icon-xs"
							class="size-6 shrink-0 text-muted-foreground hover:text-destructive"
							onclick={() => editor.removeReferenceImage(reference.id)}
							title={`Remove ${reference.name}`}
							aria-label={`Remove ${reference.name}`}
						>
							<Trash2 class="size-3.5" />
						</Button>
					</div>
				{/each}
			</div>
		{/if}

		{#if error}
			<p class="border-t px-3 py-2 text-[11px] text-destructive">{error}</p>
		{/if}

		{#if active}
			<footer class="grid gap-2 border-t p-2.5">
				<Input
					bind:value={nameDraft}
					maxlength={60}
					class="h-7 text-xs"
					aria-label="Reference name"
					onblur={commitName}
					onkeydown={(event) => {
						if (event.key === "Enter") event.currentTarget.blur();
					}}
				/>
				<div class="flex items-center gap-2">
					<span class="w-14 text-[10px] text-muted-foreground">Opacity</span>
					<Slider
						type="single"
						min={0}
						max={100}
						step={1}
						bind:value={opacity}
						onValueChange={changeOpacity}
						class="flex-1"
					/>
					<span class="w-8 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
						{opacity}%
					</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="w-14 text-[10px] text-muted-foreground">Width</span>
					<Input
						type="number"
						min={1}
						max={8192}
						bind:value={width}
						class="h-7 w-20 font-mono text-[11px]"
						aria-label="Reference width in document pixels"
						onchange={changeWidth}
						onkeydown={(event) => {
							if (event.key === "Enter") event.currentTarget.blur();
						}}
					/>
					<span class="text-[10px] text-muted-foreground">document px</span>
				</div>
			</footer>
		{/if}
	</div>
{:else}
	<button
		type="button"
		class="absolute left-3 top-3 z-10 grid size-8 place-items-center rounded-full border bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
		onclick={() => (editor.showReferenceBoard = true)}
		title="Show reference board"
		aria-label="Show reference board"
	>
		<Images class="size-4" />
	</button>
{/if}

<input
	bind:this={fileInput}
	type="file"
	accept={IMAGE_IMPORT_ACCEPT}
	class="hidden"
	onchange={handleFile}
/>
