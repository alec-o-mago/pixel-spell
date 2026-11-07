<script lang="ts">
	import Copy from "@lucide/svelte/icons/copy";
	import Film from "@lucide/svelte/icons/film";
	import Pause from "@lucide/svelte/icons/pause";
	import Play from "@lucide/svelte/icons/play";
	import Plus from "@lucide/svelte/icons/plus";
	import SkipBack from "@lucide/svelte/icons/skip-back";
	import SkipForward from "@lucide/svelte/icons/skip-forward";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import { cn } from "$lib/utils.js";
	import FrameThumb from "./FrameThumb.svelte";

	$effect(() => {
		if (!editor.playing) return;
		const fps = Math.max(1, Math.min(60, editor.doc.fps || 12));
		const frameCount = editor.doc.frames.length;
		if (frameCount <= 1) return;

		const interval = window.setInterval(() => {
			editor.activeFrame = (editor.activeFrame + 1) % frameCount;
		}, 1000 / fps);

		return () => window.clearInterval(interval);
	});
</script>

<section class="flex min-w-0 flex-1 flex-col">
	<header class="flex h-11 shrink-0 items-center gap-2 border-b px-3">
		<Film class="size-4 text-muted-foreground" />
		<span class="text-xs font-medium">Frames</span>
		<Badge variant="secondary" class="h-5 px-1.5 text-[10px] tabular-nums">
			{editor.frameCount}
		</Badge>

		<div class="ml-2 flex items-center gap-0.5">
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
		</div>

		<div class="ml-2 flex items-center gap-1 text-[10px] text-muted-foreground">
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

		<div class="ml-auto flex items-center gap-0.5">
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
		</div>
	</header>

	<div class="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-3">
		<div class="flex w-max items-start gap-2">
			{#each editor.doc.frames as frame, index (frame.id)}
				<button
					type="button"
					class="group flex w-32 shrink-0 flex-col gap-1 text-left"
					onclick={() => editor.selectFrame(index)}
					aria-label={`Select frame ${index + 1}`}
					aria-pressed={editor.activeFrame === index}
				>
					<div
						class={cn(
							"checkerboard relative aspect-square w-32 overflow-hidden rounded-lg border-2 bg-muted/30 transition-all",
							editor.activeFrame === index
								? "border-primary ring-2 ring-primary/20"
								: "border-border/60 hover:border-muted-foreground/40",
						)}
					>
						<FrameThumb index={index} />
						<span
							class="absolute left-1 top-1 rounded bg-background/85 px-1 font-mono text-[9px] tabular-nums text-muted-foreground backdrop-blur"
						>
							{index + 1}
						</span>
						{#if editor.activeFrame === index && editor.playing}
							<span class="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary"></span>
						{/if}
					</div>
				</button>
			{/each}

			<button
				type="button"
				class="grid h-32 w-32 shrink-0 place-items-center rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40 hover:text-foreground"
				onclick={() => editor.addFrame()}
				title="Add frame"
				aria-label="Add frame"
			>
				<Plus class="size-5" />
			</button>
		</div>
	</div>
</section>
