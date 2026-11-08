<script lang="ts">
	import { Slider } from "$lib/components/ui/slider/index.js";
	import { Switch } from "$lib/components/ui/switch/index.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import { TOOL_BY_ID } from "$lib/editor/tools.js";
	import ToolIcon from "./ToolIcon.svelte";

	let tool = $derived(TOOL_BY_ID[editor.tool]);
	let isShape = $derived(editor.tool === "rectangle" || editor.tool === "ellipse");
	let showSize = $derived(
		editor.tool === "pencil" ||
			editor.tool === "eraser" ||
			editor.tool === "line" ||
			(isShape && !editor.shapeFilled),
	);
</script>

<section class="flex min-h-0 flex-1 flex-col">
	<header class="flex h-11 shrink-0 items-center gap-2.5 border-b px-4">
		<div class="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
			<ToolIcon tool={editor.tool} class="size-4" />
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-1.5">
				<span class="truncate text-xs font-medium">{tool.label}</span>
				<kbd
					class="rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground"
				>
					{tool.shortcut}
				</kbd>
			</div>
			<p class="truncate text-[10px] text-muted-foreground">{tool.description}</p>
		</div>
	</header>

	<div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
		<div class="space-y-5">
			{#if editor.tool === "eyedropper"}
				<label
					class="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5"
				>
					<span class="grid gap-0.5">
						<span class="text-xs font-medium">Sample all layers</span>
						<span class="text-[10px] leading-snug text-muted-foreground">
							Pick from the flattened image instead of the active layer.
						</span>
					</span>
					<Switch bind:checked={editor.sampleAllLayers} />
				</label>
			{:else if editor.tool === "fill"}
				<div class="space-y-2.5">
					<div class="flex items-center justify-between">
						<span class="text-xs font-medium">Tolerance</span>
						<span
							class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground"
						>
							{editor.fillTolerance}%
						</span>
					</div>
					<Slider type="single" min={0} max={100} step={1} bind:value={editor.fillTolerance} />
					<p class="text-[10px] leading-snug text-muted-foreground">
						Higher values fill more colors that are close to the clicked pixel.
					</p>
				</div>

				<label
					class="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5"
				>
					<span class="grid gap-0.5">
						<span class="text-xs font-medium">Contiguous</span>
						<span class="text-[10px] leading-snug text-muted-foreground">
							Only fill the connected region around the click.
						</span>
					</span>
					<Switch bind:checked={editor.fillContiguous} />
				</label>
			{:else}
				{#if showSize}
					<div class="space-y-2.5">
						<div class="flex items-center justify-between">
							<span class="text-xs font-medium">
								{isShape ? "Outline size" : "Brush size"}
							</span>
							<span
								class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground"
							>
								{editor.brushSize}px
							</span>
						</div>
						<Slider type="single" min={1} max={8} step={1} bind:value={editor.brushSize} />
					</div>
				{/if}

				{#if isShape}
					<label
						class="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5"
					>
						<span class="grid gap-0.5">
							<span class="text-xs font-medium">Filled shape</span>
							<span class="text-[10px] leading-snug text-muted-foreground">
								Fill the interior instead of drawing an outline.
							</span>
						</span>
						<Switch bind:checked={editor.shapeFilled} />
					</label>
				{/if}
			{/if}
		</div>
	</div>
</section>

