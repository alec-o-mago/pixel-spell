<script lang="ts">
	import { compositeFrame } from "$lib/editor/doc.js";
	import { drawThumbnail } from "$lib/editor/render.js";
	import { editor } from "$lib/editor/editor.svelte.js";

	let { index }: { index: number } = $props();
	let canvas: HTMLCanvasElement;

	$effect(() => {
		const doc = editor.doc;
		editor.revision;

		if (!canvas) return;
		const pixels = compositeFrame(doc, index);
		drawThumbnail(canvas, pixels, doc.width, doc.height, 128);
	});
</script>

<canvas bind:this={canvas} class="size-full"></canvas>
