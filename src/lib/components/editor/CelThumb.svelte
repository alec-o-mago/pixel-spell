<script lang="ts">
	import { editor } from "$lib/editor/editor.svelte.js";
	import { drawThumbnail } from "$lib/editor/render.js";
	import type { Layer } from "$lib/editor/types.js";

	let { layer, frame }: { layer: Layer; frame: number } = $props();
	let canvas: HTMLCanvasElement;

	$effect(() => {
		const doc = editor.doc;
		editor.revision;

		if (!canvas) return;
		const cel = layer.cels[frame];
		if (!cel) return;
		drawThumbnail(canvas, cel, doc.width, doc.height, 40);
	});
</script>

<canvas bind:this={canvas} class="size-full"></canvas>
