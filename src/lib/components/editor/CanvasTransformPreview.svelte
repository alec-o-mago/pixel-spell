<script lang="ts">
	import { drawScaled } from "$lib/editor/render.js";

	let {
		pixels,
		width,
		height,
		stageHeight = 160,
		maxWidth = 560,
		label = "Canvas preview",
	}: {
		pixels: Uint32Array | null;
		width: number;
		height: number;
		stageHeight?: number;
		maxWidth?: number;
		label?: string;
	} = $props();

	let canvas = $state<HTMLCanvasElement>();

	$effect(() => {
		const target = canvas;
		const source = pixels;
		const sourceWidth = width;
		const sourceHeight = height;
		if (!target) return;

		if (
			!source ||
			!Number.isFinite(sourceWidth) ||
			!Number.isFinite(sourceHeight) ||
			sourceWidth <= 0 ||
			sourceHeight <= 0
		) {
			const context = target.getContext("2d");
			context?.clearRect(0, 0, target.width, target.height);
			return;
		}

		const scale = Math.min(
			maxWidth / sourceWidth,
			stageHeight / sourceHeight,
		);
		const cssWidth = Math.max(1, Math.round(sourceWidth * scale));
		const cssHeight = Math.max(1, Math.round(sourceHeight * scale));
		target.style.width = `${cssWidth}px`;
		target.style.height = `${cssHeight}px`;
		drawScaled(target, source, sourceWidth, sourceHeight, cssWidth, cssHeight);
	});
</script>

<div
	class="checkerboard flex h-44 items-center justify-center overflow-hidden rounded-lg ring-1 ring-border"
>
	<canvas
		bind:this={canvas}
		class="block ring-1 ring-border/60"
		aria-label={label}
	></canvas>
</div>
