<script lang="ts">
	import Grid3x3 from "@lucide/svelte/icons/grid-3x3";
	import Maximize2 from "@lucide/svelte/icons/maximize-2";
	import ZoomIn from "@lucide/svelte/icons/zoom-in";
	import ZoomOut from "@lucide/svelte/icons/zoom-out";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { compositeFrame } from "$lib/editor/doc.js";
	import {
		fillPixels,
		paintBrush,
		paintPixel,
		plotEllipse,
		plotLine,
		plotRectangle,
	} from "$lib/editor/draw.js";
	import { drawScaled } from "$lib/editor/render.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import type { Point } from "$lib/editor/types.js";
	import { cn } from "$lib/utils.js";

	let stage: HTMLDivElement | undefined;
	let canvas: HTMLCanvasElement | undefined;

	let drawing = false;
	let start: Point | null = null;
	let last: Point | null = null;
	let backup: Uint32Array | null = null;

	let zoom = $derived(editor.effectiveZoom);
	let canvasWidth = $derived(editor.doc.width * zoom);
	let canvasHeight = $derived(editor.doc.height * zoom);
	let isDrawable = $derived(
		!!editor.activeLayer && !editor.activeLayer.locked && editor.activeLayer.visible,
	);

	let brushCursorSize = $derived(
		editor.tool === "pencil" ||
			editor.tool === "eraser" ||
			editor.tool === "line" ||
			((editor.tool === "rectangle" || editor.tool === "ellipse") && !editor.shapeFilled)
			? editor.brushSize
			: 1,
	);
	let cursorOffset = $derived(Math.floor((brushCursorSize - 1) / 2));

	let canvasCursor = $derived(
		!isDrawable
			? "cursor-not-allowed"
			: editor.tool === "eyedropper"
				? "cursor-copy"
				: editor.tool === "fill"
					? "cursor-cell"
					: "cursor-crosshair",
	);

	$effect(() => {
		if (!stage) return;
		const observer = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (!rect) return;
			editor.viewport = { w: rect.width, h: rect.height };
		});
		observer.observe(stage);
		return () => observer.disconnect();
	});

	$effect(() => {
		const doc = editor.doc;
		const frame = editor.activeFrame;
		const currentZoom = editor.effectiveZoom;
		editor.revision;

		if (!canvas) return;
		const pixels = compositeFrame(doc, frame);
		drawScaled(
			canvas,
			pixels,
			doc.width,
			doc.height,
			doc.width * currentZoom,
			doc.height * currentZoom,
		);
	});

	function pixelFromEvent(event: PointerEvent): Point | null {
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return null;

		const relativeX = (event.clientX - rect.left) / rect.width;
		const relativeY = (event.clientY - rect.top) / rect.height;
		if (relativeX < 0 || relativeX >= 1 || relativeY < 0 || relativeY >= 1) return null;

		return {
			x: Math.min(editor.doc.width - 1, Math.floor(relativeX * editor.doc.width)),
			y: Math.min(editor.doc.height - 1, Math.floor(relativeY * editor.doc.height)),
		};
	}

	function paintAt(cel: Uint32Array, x: number, y: number): void {
		const color = editor.tool === "eraser" ? 0 : editor.currentColor;
		paintBrush(
			cel,
			editor.doc.width,
			editor.doc.height,
			x,
			y,
			editor.brushSize,
			color,
			editor.mirrorX,
			editor.mirrorY,
		);
	}

	function drawShape(cel: Uint32Array, end: Point): void {
		if (!backup || !start) return;
		cel.set(backup);

		const color = editor.currentColor;
		const stroke = (x: number, y: number) =>
			paintBrush(
				cel,
				editor.doc.width,
				editor.doc.height,
				x,
				y,
				editor.brushSize,
				color,
				editor.mirrorX,
				editor.mirrorY,
			);
		const dot = (x: number, y: number) =>
			paintPixel(
				cel,
				editor.doc.width,
				editor.doc.height,
				x,
				y,
				color,
				editor.mirrorX,
				editor.mirrorY,
			);

		if (editor.tool === "line") {
			plotLine(start.x, start.y, end.x, end.y, stroke);
		} else if (editor.tool === "rectangle") {
			plotRectangle(
				start.x,
				start.y,
				end.x,
				end.y,
				editor.shapeFilled,
				editor.shapeFilled ? dot : stroke,
			);
		} else if (editor.tool === "ellipse") {
			plotEllipse(
				start.x,
				start.y,
				end.x,
				end.y,
				editor.shapeFilled,
				editor.shapeFilled ? dot : stroke,
			);
		}
	}

	function pickColor(point: Point): void {
		const frame = editor.activeFrame;
		const source = editor.sampleAllLayers
			? compositeFrame(editor.doc, frame)
			: editor.activeLayer.cels[frame];
		if (!source) return;
		editor.setColorFromPacked(source[point.y * editor.doc.width + point.x] ?? 0);
	}

	function handlePointerDown(event: PointerEvent): void {
		if (event.button !== 0 || !isDrawable) return;
		const point = pixelFromEvent(event);
		if (!point) return;

		event.preventDefault();
		editor.playing = false;
		editor.cursor = point;
		try {
			canvas?.setPointerCapture(event.pointerId);
		} catch {
			// Synthetic pointer events may not own a capture target.
		}

		if (editor.tool === "eyedropper") {
			pickColor(point);
			return;
		}

		const layer = editor.activeLayer;
		const cel = layer.cels[editor.activeFrame];
		if (!cel) return;

		if (editor.tool === "fill") {
			editor.pushHistory();
			const tolerance = Math.round((editor.fillTolerance / 100) * 255);
			const changed = fillPixels(
				cel,
				editor.doc.width,
				editor.doc.height,
				point.x,
				point.y,
				editor.currentColor,
				tolerance,
				editor.fillContiguous,
			);
			if (changed) editor.touch();
			return;
		}

		editor.pushHistory();
		backup = new Uint32Array(cel);
		drawing = true;
		start = point;
		last = point;

		if (editor.tool === "pencil" || editor.tool === "eraser") {
			paintAt(cel, point.x, point.y);
			editor.touch();
		} else {
			drawShape(cel, point);
			editor.touch();
		}
	}

	function handlePointerMove(event: PointerEvent): void {
		const point = pixelFromEvent(event);
		editor.cursor = point;

		if (!drawing || !point) return;
		const layer = editor.activeLayer;
		const cel = layer.cels[editor.activeFrame];
		if (!cel) return;

		if (editor.tool === "pencil" || editor.tool === "eraser") {
			const from = last ?? point;
			plotLine(from.x, from.y, point.x, point.y, (x, y) => paintAt(cel, x, y));
			last = point;
		} else {
			drawShape(cel, point);
		}
		editor.touch();
	}

	function handlePointerUp(event: PointerEvent): void {
		if (drawing) {
			drawing = false;
			backup = null;
			start = null;
			last = null;
			editor.touch();
		}
		if (canvas?.hasPointerCapture(event.pointerId)) {
			canvas.releasePointerCapture(event.pointerId);
		}
		editor.cursor = pixelFromEvent(event);
	}

	function handlePointerLeave(): void {
		if (!drawing) editor.cursor = null;
	}
</script>

<section class="relative min-h-0 flex-1 overflow-hidden bg-muted/20">
	<div class="canvas-stage absolute inset-0 overflow-auto" bind:this={stage}>
		<div class="flex min-h-full w-max min-w-full items-center justify-center p-8">
			<div
				class="relative shrink-0 shadow-xl ring-1 ring-border/70"
				style:width={`${canvasWidth}px`}
				style:height={`${canvasHeight}px`}
			>
				<div class="checkerboard absolute inset-0"></div>

				<canvas
					bind:this={canvas}
					class={cn("relative block touch-none select-none", canvasCursor)}
					style:width={`${canvasWidth}px`}
					style:height={`${canvasHeight}px`}
					onpointerdown={handlePointerDown}
					onpointermove={handlePointerMove}
					onpointerup={handlePointerUp}
					onpointercancel={handlePointerUp}
					onpointerleave={handlePointerLeave}
					oncontextmenu={(event) => event.preventDefault()}
					aria-label="Pixel art canvas"
				></canvas>

				{#if editor.showGrid && zoom >= 6}
					<div
						class="pointer-events-none absolute inset-0"
						style={`background-image: linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px); background-size: ${zoom}px ${zoom}px;`}
					></div>
				{/if}

				{#if editor.cursor && isDrawable}
					<div
						class="pointer-events-none absolute border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
						style:left={`${(editor.cursor.x - cursorOffset) * zoom}px`}
						style:top={`${(editor.cursor.y - cursorOffset) * zoom}px`}
						style:width={`${brushCursorSize * zoom}px`}
						style:height={`${brushCursorSize * zoom}px`}
					></div>
				{/if}
			</div>
		</div>
	</div>

	<div class="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5">
		<span
			class="rounded-md border bg-background/90 px-2 py-1 font-mono text-[10px] font-medium tabular-nums shadow-sm backdrop-blur"
		>
			{editor.doc.width} × {editor.doc.height}
		</span>
		{#if editor.cursor}
			<span
				class="rounded-md border bg-background/90 px-2 py-1 font-mono text-[10px] tabular-nums text-muted-foreground shadow-sm backdrop-blur"
			>
				{editor.cursor.x}, {editor.cursor.y}
			</span>
		{/if}
	</div>

	<div
		class="pointer-events-none absolute right-3 top-3 rounded-md border bg-background/90 px-2 py-1 font-mono text-[10px] tabular-nums text-muted-foreground shadow-sm backdrop-blur"
	>
		Frame {editor.activeFrame + 1} / {editor.frameCount}
	</div>

	<div
		class="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border bg-background/90 p-1 shadow-sm backdrop-blur"
	>
		<Button
			variant="ghost"
			size="icon-xs"
			class="rounded-full text-muted-foreground"
			onclick={() => editor.zoomOut()}
			title="Zoom out"
			aria-label="Zoom out"
		>
			<ZoomOut class="size-3.5" />
		</Button>
		<button
			type="button"
			class="min-w-11 rounded-full px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			onclick={() => editor.fitToWindow()}
			title="Fit to window"
		>
			{zoom}×
		</button>
		<Button
			variant="ghost"
			size="icon-xs"
			class="rounded-full text-muted-foreground"
			onclick={() => editor.zoomIn()}
			title="Zoom in"
			aria-label="Zoom in"
		>
			<ZoomIn class="size-3.5" />
		</Button>
		<Separator orientation="vertical" class="mx-1 h-4" />
		<Button
			variant="ghost"
			size="icon-xs"
			class="rounded-full text-muted-foreground"
			onclick={() => editor.fitToWindow()}
			title="Fit to window"
			aria-label="Fit to window"
		>
			<Maximize2 class="size-3.5" />
		</Button>
		<Button
			variant={editor.showGrid ? "secondary" : "ghost"}
			size="icon-xs"
			class="rounded-full text-muted-foreground"
			onclick={() => (editor.showGrid = !editor.showGrid)}
			title="Toggle pixel grid"
			aria-label="Toggle pixel grid"
			aria-pressed={editor.showGrid}
		>
			<Grid3x3 class="size-3.5" />
		</Button>
	</div>
</section>
