<script lang="ts">
	import History from "@lucide/svelte/icons/history";
	import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import RecoveryThumb from "$lib/components/editor/RecoveryThumb.svelte";
	import type { RecoveredProject } from "$lib/editor/autosave.js";
	import { compositeFrame } from "$lib/editor/doc.js";
	import { drawScaled } from "$lib/editor/render.js";
	import { cn } from "$lib/utils.js";

	let {
		open = $bindable(false),
		projects = [],
		onRestore,
		onDiscard,
	}: {
		open?: boolean;
		projects?: RecoveredProject[];
		onRestore: () => void;
		onDiscard: () => void;
	} = $props();

	const PREVIEW_MAX_WIDTH = 560;
	const PREVIEW_MAX_HEIGHT = 160;

	let selectedId = $state<string | null>(null);
	let previewCanvas = $state<HTMLCanvasElement>();

	let selected = $derived(
		projects.find((entry) => entry.record.id === selectedId) ??
			projects[0] ??
			null,
	);

	$effect(() => {
		if (projects.length === 0) {
			selectedId = null;
			return;
		}
		if (!projects.some((entry) => entry.record.id === selectedId)) {
			selectedId = projects[0]!.record.id;
		}
	});

	$effect(() => {
		if (!open || !previewCanvas || !selected) return;
		const doc = selected.project.doc;
		const pixels = compositeFrame(doc, selected.project.activeFrame, true);
		const scale = Math.min(
			PREVIEW_MAX_WIDTH / doc.width,
			PREVIEW_MAX_HEIGHT / doc.height,
		);
		const width = Math.max(1, Math.round(doc.width * scale));
		const height = Math.max(1, Math.round(doc.height * scale));
		previewCanvas.style.width = `${width}px`;
		previewCanvas.style.height = `${height}px`;
		drawScaled(previewCanvas, pixels, doc.width, doc.height, width, height);
	});

	function savedAgo(time: number): string {
		const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
		if (seconds < 45) return "just now";
		const minutes = Math.round(seconds / 60);
		if (minutes < 60) return `${minutes} min ago`;
		const hours = Math.round(minutes / 60);
		if (hours < 24) return `${hours} hr ago`;
		const days = Math.round(hours / 24);
		return `${days} ${days === 1 ? "day" : "days"} ago`;
	}

	function projectDetails(entry: RecoveredProject): string {
		const doc = entry.project.doc;
		const layers = doc.layers.length;
		const frames = doc.frames.length;
		return `${doc.width} × ${doc.height} · ${layers} ${layers === 1 ? "layer" : "layers"} · ${frames} ${frames === 1 ? "frame" : "frames"}`;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl"
		showCloseButton={false}
		escapeKeydownBehavior="ignore"
		interactOutsideBehavior="ignore"
	>
		<Dialog.Header>
			<div class="flex items-start gap-3">
				<div
					class="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
				>
					<History class="size-5" />
				</div>
				<div class="grid gap-1">
					<Dialog.Title>Recover unsaved work?</Dialog.Title>
					<Dialog.Description>
						Pixel Spell autosaved {projects.length === 1
							? "a project"
							: `${projects.length} projects`} from your last session. Restore
						{projects.length === 1 ? " it" : " them"} to continue where you left off.
					</Dialog.Description>
				</div>
			</div>
		</Dialog.Header>

		<div class="grid gap-2">
			<div
				class="checkerboard relative flex h-44 items-center justify-center overflow-hidden rounded-lg ring-1 ring-border"
			>
				<canvas
					bind:this={previewCanvas}
					class="block ring-1 ring-border/60"
					aria-label="Recovered project preview"
				></canvas>
			</div>
			{#if selected}
				<div class="flex items-center justify-between gap-3 text-[10px]">
					<span class="min-w-0 truncate text-xs font-medium text-foreground">
						{selected.project.name}
					</span>
					<span class="shrink-0 font-mono tabular-nums text-muted-foreground">
						{projectDetails(selected)}
					</span>
					<span class="shrink-0 text-muted-foreground">
						Autosaved {savedAgo(selected.record.savedAt)}
					</span>
				</div>
			{/if}
		</div>

		{#if projects.length > 1}
			<div
				class="grid max-h-44 gap-1.5 overflow-y-auto pr-1"
				role="listbox"
				aria-label="Recovered projects"
			>
				{#each projects as entry (entry.record.id)}
					{@const active = entry.record.id === selected?.record.id}
					<button
						type="button"
						role="option"
						aria-selected={active}
						class={cn(
							"flex min-w-0 items-center gap-2.5 rounded-md border p-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
							active
								? "border-primary/50 bg-primary/5"
								: "border-border/60 hover:bg-muted/50",
						)}
						onclick={() => (selectedId = entry.record.id)}
					>
						<span
							class="checkerboard grid size-9 shrink-0 place-items-center overflow-hidden rounded-sm border"
						>
							<RecoveryThumb project={entry.project} size={36} />
						</span>
						<span class="grid min-w-0 flex-1 gap-0.5">
							<span class="truncate text-xs font-medium">{entry.project.name}</span>
							<span class="truncate text-[10px] text-muted-foreground">
								{projectDetails(entry)}
							</span>
						</span>
						<span class="shrink-0 text-[10px] text-muted-foreground">
							{savedAgo(entry.record.savedAt)}
						</span>
					</button>
				{/each}
			</div>
		{/if}

		<Dialog.Footer class="sm:justify-between">
			<Button variant="outline" onclick={onDiscard}>
				<Trash2 class="size-4" />
				Discard
			</Button>
			<Button onclick={onRestore}>
				<RotateCcw class="size-4" />
				{projects.length === 1 ? "Restore project" : `Restore ${projects.length} projects`}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
