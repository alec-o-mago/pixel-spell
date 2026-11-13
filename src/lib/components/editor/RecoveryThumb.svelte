<script lang="ts">
	import { compositeFrame } from "$lib/editor/doc.js";
	import type { LoadedProject } from "$lib/editor/file.js";
	import { drawThumbnail } from "$lib/editor/render.js";

	let {
		project,
		size = 48,
	}: {
		project: LoadedProject;
		size?: number;
	} = $props();

	let canvas = $state<HTMLCanvasElement>();

	$effect(() => {
		if (!canvas) return;
		const { doc, activeFrame } = project;
		drawThumbnail(
			canvas,
			compositeFrame(doc, activeFrame, true),
			doc.width,
			doc.height,
			size,
		);
	});
</script>

<canvas
	bind:this={canvas}
	style={`width:${size}px;height:${size}px`}
	aria-hidden="true"
></canvas>
