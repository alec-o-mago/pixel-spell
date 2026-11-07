<script lang="ts">
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import ChevronUp from "@lucide/svelte/icons/chevron-up";
	import Copy from "@lucide/svelte/icons/copy";
	import LayersIcon from "@lucide/svelte/icons/layers";
	import Plus from "@lucide/svelte/icons/plus";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Slider } from "$lib/components/ui/slider/index.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import LayerRow from "./LayerRow.svelte";

	let opacity = $state(100);

	$effect(() => {
		opacity = Math.round(editor.activeLayer.opacity * 100);
	});

	function changeOpacity(value: number): void {
		editor.setLayerOpacity(editor.activeLayerId, value / 100);
	}
</script>

<section class="flex w-80 shrink-0 flex-col border-r">
	<header class="flex h-11 shrink-0 items-center gap-2 border-b px-3">
		<LayersIcon class="size-4 text-muted-foreground" />
		<span class="text-xs font-medium">Layers</span>
		<Badge variant="secondary" class="h-5 px-1.5 text-[10px] tabular-nums">
			{editor.doc.layers.length}
		</Badge>

		<div class="ml-auto flex items-center gap-0.5">
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
		</div>
	</header>

	<div class="min-h-0 flex-1 overflow-y-auto p-2">
		<div class="flex flex-col gap-1">
			{#each [...editor.doc.layers].reverse() as layer (layer.id)}
				<LayerRow {layer} />
			{/each}
		</div>
	</div>

	<div class="shrink-0 border-t px-3 py-2.5">
		<div class="mb-2 flex items-center justify-between">
			<span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
				Opacity
			</span>
			<span class="font-mono text-[10px] tabular-nums text-muted-foreground">
				{Math.round(editor.activeLayer.opacity * 100)}%
			</span>
		</div>
		<Slider
			type="single"
			min={0}
			max={100}
			step={1}
			bind:value={opacity}
			onValueChange={changeOpacity}
		/>
	</div>
</section>
