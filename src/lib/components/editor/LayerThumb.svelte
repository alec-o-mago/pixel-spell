<script lang="ts">
	import { drawThumbnail } from "$lib/editor/render.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import type { Layer } from "$lib/editor/types.js";

	let { layer }: { layer: Layer } = $props();
	let canvas: HTMLCanvasElement;

	$effect(() => {
		const doc = editor.doc;
		const frame = editor.activeFrame;
		editor.revision;

		if (!canvas) return;
		const cel = layer.cels[frame];
		if (!cel) return;
		drawThumbnail(canvas, cel, doc.width, doc.height, 40);
	});
</script>

<canvas bind:this={canvas} class="size-full"></canvas>
