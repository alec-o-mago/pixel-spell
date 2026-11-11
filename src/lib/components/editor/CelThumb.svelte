<script lang="ts">
	import { editor } from "$lib/editor/editor.svelte.js";
	import { drawThumbnail } from "$lib/editor/render.js";
	import type { Layer } from "$lib/editor/types.js";

	let { layer, frame }: { layer: Layer; frame: number } = $props();
	let canvas: HTMLCanvasElement;
	let drawnStructure = -1;
	let drawnRevision = -1;
	let pending = 0;

	$effect(() => {
		const doc = editor.doc;
		// Structural changes (add/remove/reorder frames or layers, undo/redo,
		// project switches) can change what this cell displays.
		const structure = editor.structureRevision;
		const isActiveCel =
			editor.activeLayerId === layer.id && editor.activeFrame === frame;
		// Only the cel being painted needs a thumbnail refresh on pixel edits.
		// Inactive cells reuse their last drawn revision, so selecting a
		// different layer or frame does not redraw every thumbnail.
		const revision = isActiveCel ? editor.revision : drawnRevision;

		if (!canvas) return;
		const cel = layer.cels[frame];
		if (!cel) return;
		if (structure === drawnStructure && revision === drawnRevision) return;

		pending = requestAnimationFrame(() => {
			pending = 0;
			drawnStructure = structure;
			drawnRevision = revision;
			if (canvas) drawThumbnail(canvas, cel, doc.width, doc.height, 40);
		});
		return () => {
			if (pending) {
				cancelAnimationFrame(pending);
				pending = 0;
			}
		};
	});
</script>

<canvas bind:this={canvas} class="size-full"></canvas>
