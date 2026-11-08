<script lang="ts">
	import { tick } from "svelte";
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
	import {
		colorSelectionMask,
		ellipseSelectionMask,
		isSelectionPoint,
		lassoSelectionMask,
		magicWandMask,
		rectSelectionMask,
		translateSelectionMask,
		unionSelectionMasks,
	} from "$lib/editor/selection.js";
	import { drawScaled } from "$lib/editor/render.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import { isSelectionTool, usesPixelPerfect } from "$lib/editor/tools.js";
	import type { MirrorAxis, MirrorKind, Point } from "$lib/editor/types.js";
	import { cn } from "$lib/utils.js";

	let stage: HTMLDivElement | undefined;
	let canvas: HTMLCanvasElement | undefined;

	let drawing = false;
	let start: Point | null = null;
	let last: Point | null = null;
	let backup: Uint32Array | null = null;
	/** Packed color captured on pointer down, so the whole stroke stays consistent. */
	let strokeColor = 0;
	let strokePath: Point[] = [];
	let strokePixelPerfect = false;

	let panning = $state(false);
	let panOrigin = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };

	let selecting = false;
	let selectStart: Point | null = null;
	let selectElliptical = false;
	let selectAdditive = false;
	let selectBaseMask: Uint8Array | null = null;

	let lassoPoints = $state<Point[]>([]);
	let lassoHover = $state<Point | null>(null);
	let lassoDragging = false;
	let lassoAdditive = false;
	let lassoBaseMask: Uint8Array | null = null;

	let movingSelection = false;
	let moveStart: Point | null = null;
	let moveCel: Uint32Array | null = null;
	let moveBackup: Uint32Array | null = null;
	let moveMask: Uint8Array | null = null;
	let moveApplied = false;

	let hoveringSelection = $state(false);
	let hoveringMirror = $state<MirrorKind | null>(null);
	let draggingMirror = $state<MirrorKind | null>(null);

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

	let showBrushCursor = $derived(
		!draggingMirror &&
			!hoveringMirror &&
			editor.tool !== "pan" &&
			editor.tool !== "zoom" &&
			!isSelectionTool(editor.tool),
	);

	let canvasCursor = $derived(
		draggingMirror
			? mirrorCursor(draggingMirror)
			: hoveringMirror
				? mirrorCursor(hoveringMirror)
				: editor.tool === "pan"
					? panning
						? "cursor-grabbing"
						: "cursor-grab"
					: editor.tool === "zoom"
						? "cursor-zoom-in"
						: isSelectionTool(editor.tool)
							? hoveringSelection
								? "cursor-move"
								: "cursor-crosshair"
							: !isDrawable
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
		editor.selectionRevision;
		const selection = editor.selection;
		const lasso = lassoPoints;
		const hover = lassoHover;
		const mirrors = editor.mirrorAxes;

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
		const context = canvas.getContext("2d");
		if (context) {
			drawOverlay(context, selection, lasso, hover, mirrors, doc.width, doc.height);
		}
	});

	$effect(() => {
		const tool = editor.tool;
		if (tool !== "lasso") resetLasso();
	});

	$effect(() => {
		editor.activeProjectId;
		resetLasso();
		selecting = false;
	});

	function pixelFromEvent(event: PointerEvent, clampToCanvas = false): Point | null {
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return null;

		let relativeX = (event.clientX - rect.left) / rect.width;
		let relativeY = (event.clientY - rect.top) / rect.height;

		if (clampToCanvas) {
			relativeX = Math.max(0, Math.min(0.999999, relativeX));
			relativeY = Math.max(0, Math.min(0.999999, relativeY));
		} else if (relativeX < 0 || relativeX >= 1 || relativeY < 0 || relativeY >= 1) {
			return null;
		}

		return {
			x: Math.min(editor.doc.width - 1, Math.floor(relativeX * editor.doc.width)),
			y: Math.min(editor.doc.height - 1, Math.floor(relativeY * editor.doc.height)),
		};
	}

	function isEditable(): boolean {
		return isDrawable;
	}

	function isPointSelected(point: Point | null): boolean {
		return (
			!!point && isSelectionPoint(editor.selection, editor.doc.width, point)
		);
	}

	function mirrorCursor(kind: MirrorKind): string {
		if (kind === "x") return "cursor-ns-resize";
		if (kind === "y") return "cursor-ew-resize";
		if (kind === "diagonal-down") return "cursor-nesw-resize";
		return "cursor-nwse-resize";
	}

	function mirrorAtEvent(event: PointerEvent): MirrorAxis | null {
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return null;

		const width = editor.doc.width;
		const height = editor.doc.height;
		const boundaryX = ((event.clientX - rect.left) / rect.width) * width;
		const boundaryY = ((event.clientY - rect.top) / rect.height) * height;
		if (boundaryX < 0 || boundaryX > width || boundaryY < 0 || boundaryY > height) {
			return null;
		}

		const zoomX = rect.width / width;
		const zoomY = rect.height / height;
		let best: MirrorAxis | null = null;
		let bestDistance = 6;

		for (const axis of editor.mirrorAxes) {
			let distance: number;
			if (axis.kind === "x") {
				distance = Math.abs(boundaryY - axis.position) * zoomY;
			} else if (axis.kind === "y") {
				distance = Math.abs(boundaryX - axis.position) * zoomX;
			} else if (axis.kind === "diagonal-down") {
				distance =
					(Math.abs(boundaryY - boundaryX - axis.position) / Math.SQRT2) * zoomX;
			} else {
				distance =
					(Math.abs(boundaryX + boundaryY - axis.position) / Math.SQRT2) * zoomX;
			}

			if (distance < bestDistance) {
				best = axis;
				bestDistance = distance;
			}
		}

		return best;
	}

	function updateMirrorDrag(event: PointerEvent): void {
		if (!draggingMirror || !canvas) return;
		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;

		const boundaryX = ((event.clientX - rect.left) / rect.width) * editor.doc.width;
		const boundaryY = ((event.clientY - rect.top) / rect.height) * editor.doc.height;
		const snap = (value: number) => Math.round(value * 2) / 2;

		if (draggingMirror === "x") {
			editor.setMirrorPosition("x", snap(boundaryY));
		} else if (draggingMirror === "y") {
			editor.setMirrorPosition("y", snap(boundaryX));
		} else if (draggingMirror === "diagonal-down") {
			editor.setMirrorPosition("diagonal-down", snap(boundaryY - boundaryX));
		} else {
			editor.setMirrorPosition("diagonal-up", snap(boundaryX + boundaryY));
		}
	}

	function paintAt(cel: Uint32Array, x: number, y: number): void {
		const color = editor.tool === "eraser" ? 0 : strokeColor;
		paintBrush(
			cel,
			editor.doc.width,
			editor.doc.height,
			x,
			y,
			editor.brushSize,
			color,
			editor.mirrorAxes,
			editor.selection,
			editor.lockAlpha,
		);
	}

	function drawShape(cel: Uint32Array, end: Point): void {
		if (!backup || !start) return;
		cel.set(backup);

		const color = strokeColor;
		const stroke = (x: number, y: number) =>
			paintBrush(
				cel,
				editor.doc.width,
				editor.doc.height,
				x,
				y,
				editor.brushSize,
				color,
				editor.mirrorAxes,
				editor.selection,
				editor.lockAlpha,
			);
		const dot = (x: number, y: number) =>
			paintPixel(
				cel,
				editor.doc.width,
				editor.doc.height,
				x,
				y,
				color,
				editor.mirrorAxes,
				editor.selection,
				editor.lockAlpha,
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

	function appendPixelPerfectPoint(x: number, y: number): boolean {
		const lastPoint = strokePath[strokePath.length - 1];
		if (lastPoint && lastPoint.x === x && lastPoint.y === y) return false;

		strokePath.push({ x, y });
		let removed = false;

		while (strokePath.length >= 3) {
			const length = strokePath.length;
			const a = strokePath[length - 3]!;
			const b = strokePath[length - 2]!;
			const c = strokePath[length - 1]!;

			const diagonal = Math.abs(a.x - c.x) === 1 && Math.abs(a.y - c.y) === 1;
			const bTouchesA =
				Math.abs(a.x - b.x) <= 1 &&
				Math.abs(a.y - b.y) <= 1 &&
				(a.x === b.x || a.y === b.y);
			const bTouchesC =
				Math.abs(b.x - c.x) <= 1 &&
				Math.abs(b.y - c.y) <= 1 &&
				(b.x === c.x || b.y === c.y);

			if (diagonal && bTouchesA && bTouchesC) {
				strokePath.splice(length - 2, 1);
				removed = true;
				continue;
			}
			break;
		}

		return removed;
	}

	function repaintPixelPerfectStroke(cel: Uint32Array): void {
		if (!backup) return;
		cel.set(backup);

		const color = editor.tool === "eraser" ? 0 : strokeColor;
		for (const point of strokePath) {
			paintBrush(
				cel,
				editor.doc.width,
				editor.doc.height,
				point.x,
				point.y,
				editor.brushSize,
				color,
				editor.mirrorAxes,
				editor.selection,
				editor.lockAlpha,
			);
		}
	}

	function updatePixelPerfectStroke(cel: Uint32Array, point: Point): void {
		const from = last ?? point;
		const newPoints: Point[] = [];

		plotLine(from.x, from.y, point.x, point.y, (x, y) => {
			if (x === from.x && y === from.y) return;
			newPoints.push({ x, y });
		});

		let removed = false;
		for (const next of newPoints) {
			if (appendPixelPerfectPoint(next.x, next.y)) removed = true;
		}

		if (removed) {
			repaintPixelPerfectStroke(cel);
		} else {
			for (const next of newPoints) paintAt(cel, next.x, next.y);
		}

		last = point;
	}

	function pickColor(point: Point, slot: "primary" | "secondary"): void {
		const frame = editor.activeFrame;
		const source = editor.sampleAllLayers
			? compositeFrame(editor.doc, frame)
			: editor.activeLayer.cels[frame];
		if (!source) return;
		editor.setColorFromPacked(source[point.y * editor.doc.width + point.x] ?? 0, slot);
	}

	function startPan(event: PointerEvent): void {
		event.preventDefault();
		panning = true;
		panOrigin = {
			x: event.clientX,
			y: event.clientY,
			scrollLeft: stage?.scrollLeft ?? 0,
			scrollTop: stage?.scrollTop ?? 0,
		};
		capturePointer(event);
	}

	function updatePan(event: PointerEvent): void {
		if (!stage) return;
		stage.scrollLeft = panOrigin.scrollLeft - (event.clientX - panOrigin.x);
		stage.scrollTop = panOrigin.scrollTop - (event.clientY - panOrigin.y);
	}

	async function zoomAtPoint(event: PointerEvent, direction: 1 | -1): Promise<void> {
		if (!canvas || !stage) return;
		event.preventDefault();

		const rect = canvas.getBoundingClientRect();
		const oldZoom = editor.effectiveZoom;
		const docX = (event.clientX - rect.left) / oldZoom;
		const docY = (event.clientY - rect.top) / oldZoom;
		const nextZoom = Math.max(1, Math.min(64, oldZoom + direction));
		if (nextZoom === oldZoom) return;

		editor.zoom = nextZoom;
		await tick();

		const nextRect = canvas.getBoundingClientRect();
		stage.scrollLeft += nextRect.left + docX * nextZoom - event.clientX;
		stage.scrollTop += nextRect.top + docY * nextZoom - event.clientY;
	}

	function updateRectSelection(point: Point): void {
		if (!selectStart) return;
		const width = editor.doc.width;
		const height = editor.doc.height;
		const mask = selectElliptical
			? ellipseSelectionMask(
					selectStart.x,
					selectStart.y,
					point.x,
					point.y,
					width,
					height,
				)
			: rectSelectionMask(selectStart.x, selectStart.y, point.x, point.y, width, height);
		editor.setSelection(
			selectAdditive ? unionSelectionMasks(selectBaseMask, mask) : mask,
		);
	}

	function selectMagicWand(point: Point, additive: boolean): void {
		const cel = editor.activeLayer.cels[editor.activeFrame];
		if (!cel) return;
		const mask = magicWandMask(
			cel,
			editor.doc.width,
			editor.doc.height,
			point.x,
			point.y,
			editor.magicWandDiagonal,
		);
		editor.setSelection(additive ? unionSelectionMasks(editor.selection, mask) : mask);
	}

	function selectByColor(point: Point, additive: boolean): void {
		const cel = editor.activeLayer.cels[editor.activeFrame];
		if (!cel) return;
		const color = cel[point.y * editor.doc.width + point.x] ?? 0;
		const mask = colorSelectionMask(cel, color);
		editor.setSelection(additive ? unionSelectionMasks(editor.selection, mask) : mask);
	}

	function appendLassoPoint(point: Point): void {
		const previous = lassoPoints[lassoPoints.length - 1];
		if (!previous || previous.x !== point.x || previous.y !== point.y) {
			lassoPoints.push(point);
		}
		lassoHover = point;

		const first = lassoPoints[0];
		if (
			first &&
			lassoPoints.length >= 4 &&
			Math.abs(point.x - first.x) <= 1 &&
			Math.abs(point.y - first.y) <= 1
		) {
			finishLasso();
		}
	}

	function finishLasso(): void {
		const points = [...lassoPoints];
		const hover = lassoHover;
		const lastPoint = points[points.length - 1];
		if (hover && (!lastPoint || lastPoint.x !== hover.x || lastPoint.y !== hover.y)) {
			points.push(hover);
		}

		const mask = lassoSelectionMask(points, editor.doc.width, editor.doc.height);
		if (mask) {
			editor.setSelection(
				lassoAdditive ? unionSelectionMasks(lassoBaseMask, mask) : mask,
			);
		}
		resetLasso();
	}

	function resetLasso(): void {
		lassoPoints = [];
		lassoHover = null;
		lassoDragging = false;
		lassoAdditive = false;
		lassoBaseMask = null;
	}

	function beginSelectionMove(point: Point): void {
		const layer = editor.activeLayer;
		const cel = layer.cels[editor.activeFrame];
		if (!cel || !editor.selection) return;

		movingSelection = true;
		moveStart = point;
		moveCel = cel;
		moveBackup = new Uint32Array(cel);
		moveMask = new Uint8Array(editor.selection);
		moveApplied = false;
	}

	function updateSelectionMove(point: Point): void {
		if (!moveStart || !moveCel || !moveBackup || !moveMask) return;
		const dx = point.x - moveStart.x;
		const dy = point.y - moveStart.y;
		if (dx === 0 && dy === 0 && !moveApplied) return;

		if (!moveApplied) {
			editor.pushHistory();
			moveApplied = true;
		}

		const width = editor.doc.width;
		const height = editor.doc.height;
		moveCel.set(moveBackup);

		for (let i = 0; i < moveMask.length; i++) {
			if (moveMask[i]) moveCel[i] = 0;
		}

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const index = y * width + x;
				if (!moveMask[index]) continue;
				const nx = x + dx;
				const ny = y + dy;
				if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
				moveCel[ny * width + nx] = moveBackup[index]!;
			}
		}

		editor.setSelection(translateSelectionMask(moveMask, width, height, dx, dy));
		editor.touch();
	}

	function finishSelectionMove(): void {
		if (moveApplied) editor.touch();
		movingSelection = false;
		moveStart = null;
		moveCel = null;
		moveBackup = null;
		moveMask = null;
		moveApplied = false;
	}

	function capturePointer(event: PointerEvent): void {
		try {
			canvas?.setPointerCapture(event.pointerId);
		} catch {
			// Synthetic pointer events may not own a capture target.
		}
	}

	function releasePointer(event: PointerEvent): void {
		if (canvas?.hasPointerCapture(event.pointerId)) {
			canvas.releasePointerCapture(event.pointerId);
		}
	}

	function drawOverlay(
		context: CanvasRenderingContext2D,
		selection: Uint8Array | null,
		lasso: Point[],
		hover: Point | null,
		mirrors: MirrorAxis[],
		docWidth: number,
		docHeight: number,
	): void {
		const scaleX = context.canvas.width / docWidth;
		const scaleY = context.canvas.height / docHeight;
		const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
		const lineWidth = Math.max(2, dpr * 1.5);

		context.save();
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.lineJoin = "round";
		context.lineCap = "butt";

		if (selection) {
			context.beginPath();
			for (let y = 0; y < docHeight; y++) {
				for (let x = 0; x < docWidth; x++) {
					const index = y * docWidth + x;
					if (!selection[index]) continue;
					const x0 = x * scaleX;
					const x1 = (x + 1) * scaleX;
					const y0 = y * scaleY;
					const y1 = (y + 1) * scaleY;

					if (y === 0 || !selection[index - docWidth]) {
						context.moveTo(x0, y0);
						context.lineTo(x1, y0);
					}
					if (y === docHeight - 1 || !selection[index + docWidth]) {
						context.moveTo(x0, y1);
						context.lineTo(x1, y1);
					}
					if (x === 0 || !selection[index - 1]) {
						context.moveTo(x0, y0);
						context.lineTo(x0, y1);
					}
					if (x === docWidth - 1 || !selection[index + 1]) {
						context.moveTo(x1, y0);
						context.lineTo(x1, y1);
					}
				}
			}
			context.lineWidth = lineWidth;
			context.setLineDash([]);
			context.strokeStyle = "rgba(0, 0, 0, 0.85)";
			context.stroke();
			context.setLineDash([4 * dpr, 4 * dpr]);
			context.strokeStyle = "rgba(255, 255, 255, 0.95)";
			context.stroke();
		}

		if (lasso.length > 0) {
			context.beginPath();
			context.moveTo((lasso[0]!.x + 0.5) * scaleX, (lasso[0]!.y + 0.5) * scaleY);
			for (let i = 1; i < lasso.length; i++) {
				context.lineTo((lasso[i]!.x + 0.5) * scaleX, (lasso[i]!.y + 0.5) * scaleY);
			}
			if (hover) {
				context.lineTo((hover.x + 0.5) * scaleX, (hover.y + 0.5) * scaleY);
			}

			context.lineWidth = lineWidth;
			context.setLineDash([]);
			context.strokeStyle = "rgba(0, 0, 0, 0.85)";
			context.stroke();
			context.setLineDash([4 * dpr, 4 * dpr]);
			context.strokeStyle = "rgba(255, 255, 255, 0.95)";
			context.stroke();

			context.setLineDash([]);
			context.beginPath();
			context.arc(
				(lasso[0]!.x + 0.5) * scaleX,
				(lasso[0]!.y + 0.5) * scaleY,
				Math.max(2, dpr * 1.5),
				0,
				Math.PI * 2,
			);
			context.fillStyle = "rgba(255, 255, 255, 0.95)";
			context.fill();
			context.lineWidth = Math.max(1, dpr);
			context.strokeStyle = "rgba(0, 0, 0, 0.85)";
			context.stroke();
		}

		if (mirrors.length > 0) {
			context.beginPath();
			for (const axis of mirrors) {
				let x0 = 0;
				let y0 = 0;
				let x1 = 0;
				let y1 = 0;

				if (axis.kind === "x") {
					y0 = axis.position;
					y1 = axis.position;
					x0 = 0;
					x1 = docWidth;
				} else if (axis.kind === "y") {
					x0 = axis.position;
					x1 = axis.position;
					y0 = 0;
					y1 = docHeight;
				} else if (axis.kind === "diagonal-down") {
					const startX = Math.max(0, -axis.position);
					const endX = Math.min(docWidth, docHeight - axis.position);
					if (endX < startX) continue;
					x0 = startX;
					y0 = startX + axis.position;
					x1 = endX;
					y1 = endX + axis.position;
				} else {
					const startX = Math.max(0, axis.position - docHeight);
					const endX = Math.min(docWidth, axis.position);
					if (endX < startX) continue;
					x0 = startX;
					y0 = axis.position - startX;
					x1 = endX;
					y1 = axis.position - endX;
				}

				context.moveTo(x0 * scaleX, y0 * scaleY);
				context.lineTo(x1 * scaleX, y1 * scaleY);
			}
			context.lineWidth = Math.max(1.5, dpr * 1.5);
			context.setLineDash([6 * dpr, 4 * dpr]);
			context.strokeStyle = "rgba(14, 165, 233, 0.95)";
			context.stroke();
			context.setLineDash([]);
		}

		context.restore();
	}

	function handlePointerDown(event: PointerEvent): void {
		const tool = editor.tool;

		if (event.button === 0) {
			const mirror = mirrorAtEvent(event);
			if (mirror) {
				event.preventDefault();
				draggingMirror = mirror.kind;
				capturePointer(event);
				return;
			}
		}

		hoveringMirror = null;

		if (tool === "pan") {
			if (event.button !== 0) return;
			startPan(event);
			return;
		}

		if (tool === "zoom") {
			if (event.button !== 0 && event.button !== 2) return;
			void zoomAtPoint(event, event.button === 0 ? 1 : -1);
			return;
		}

		if (tool === "lasso" && event.button === 2) {
			if (lassoPoints.length >= 2) {
				event.preventDefault();
				const point = pixelFromEvent(event, true);
				if (point) lassoHover = point;
				finishLasso();
			}
			return;
		}

		const secondary = event.button === 2;
		if (event.button !== 0 && !secondary) return;
		const point = pixelFromEvent(event);
		if (!point) return;

		event.preventDefault();
		editor.playing = false;
		editor.cursor = point;
		capturePointer(event);

		if (isSelectionTool(tool)) {
			if (secondary) return;

			const additive = event.shiftKey && !!editor.selection;

			// A pending lasso keeps accepting points, even over an older selection.
			if (tool === "lasso" && lassoPoints.length > 0) {
				appendLassoPoint(point);
				lassoDragging = true;
				return;
			}

			if (!additive && editor.selection && isPointSelected(point) && isEditable()) {
				beginSelectionMove(point);
				return;
			}

			if (tool === "magic-wand") {
				selectMagicWand(point, additive);
				return;
			}
			if (tool === "select-color") {
				selectByColor(point, additive);
				return;
			}
			if (tool === "rect-select" || tool === "ellipse-select") {
				selecting = true;
				selectStart = point;
				selectElliptical = tool === "ellipse-select";
				selectAdditive = additive;
				selectBaseMask = additive && editor.selection ? new Uint8Array(editor.selection) : null;
				updateRectSelection(point);
				return;
			}
			if (tool === "lasso") {
				if (lassoPoints.length === 0) {
					lassoPoints = [point];
					lassoHover = point;
					lassoAdditive = additive;
					lassoBaseMask =
						additive && editor.selection ? new Uint8Array(editor.selection) : null;
				} else {
					appendLassoPoint(point);
				}
				lassoDragging = true;
				return;
			}
		}

		if (tool === "eyedropper") {
			if (!isDrawable) return;
			pickColor(point, secondary ? "secondary" : "primary");
			return;
		}

		if (!isDrawable) return;
		if (editor.selection && !isPointSelected(point)) return;

		strokeColor = secondary ? editor.secondaryCurrentColor : editor.currentColor;

		const layer = editor.activeLayer;
		const cel = layer.cels[editor.activeFrame];
		if (!cel) return;

		if (tool === "fill") {
			editor.pushHistory();
			const tolerance = Math.round((editor.fillTolerance / 100) * 255);
			const changed = fillPixels(
				cel,
				editor.doc.width,
				editor.doc.height,
				point.x,
				point.y,
				strokeColor,
				tolerance,
				editor.fillContiguous,
				editor.selection,
				editor.lockAlpha,
			);
			if (changed) editor.touch();
			return;
		}

		editor.pushHistory();
		backup = new Uint32Array(cel);
		drawing = true;
		start = point;
		last = point;
		strokePixelPerfect = editor.pixelPerfect && usesPixelPerfect(tool);
		strokePath = strokePixelPerfect ? [point] : [];

		if (tool === "pencil" || tool === "eraser") {
			paintAt(cel, point.x, point.y);
			editor.touch();
		} else {
			drawShape(cel, point);
			editor.touch();
		}
	}

	function handlePointerMove(event: PointerEvent): void {
		if (draggingMirror) {
			updateMirrorDrag(event);
			return;
		}

		if (!panning && !movingSelection && !selecting && !lassoDragging && !drawing) {
			hoveringMirror = mirrorAtEvent(event)?.kind ?? null;
		}

		if (panning) {
			updatePan(event);
			return;
		}

		if (movingSelection) {
			const point = pixelFromEvent(event, true);
			if (point) {
				editor.cursor = point;
				updateSelectionMove(point);
			}
			return;
		}

		if (selecting) {
			const point = pixelFromEvent(event, true);
			if (point) {
				editor.cursor = point;
				updateRectSelection(point);
			}
			return;
		}

		if (lassoDragging) {
			const point = pixelFromEvent(event, true);
			if (point) {
				editor.cursor = point;
				appendLassoPoint(point);
			}
			return;
		}

		const point = pixelFromEvent(event);
		editor.cursor = point;

		if (editor.tool === "lasso") {
			lassoHover = point;
		}

		hoveringSelection = isSelectionTool(editor.tool) && isPointSelected(point);

		if (!drawing || !point) return;
		const layer = editor.activeLayer;
		const cel = layer.cels[editor.activeFrame];
		if (!cel) return;

		if (editor.tool === "pencil" || editor.tool === "eraser") {
			if (strokePixelPerfect) {
				updatePixelPerfectStroke(cel, point);
			} else {
				const from = last ?? point;
				plotLine(from.x, from.y, point.x, point.y, (x, y) => paintAt(cel, x, y));
				last = point;
			}
		} else {
			drawShape(cel, point);
		}
		editor.touch();
	}

	function handlePointerUp(event: PointerEvent): void {
		if (draggingMirror) {
			draggingMirror = null;
			releasePointer(event);
			return;
		}

		if (panning) {
			panning = false;
			releasePointer(event);
			return;
		}

		if (movingSelection) {
			finishSelectionMove();
			releasePointer(event);
			return;
		}

		if (selecting) {
			selecting = false;
			selectStart = null;
			selectAdditive = false;
			selectBaseMask = null;
			releasePointer(event);
			return;
		}

		if (lassoDragging) {
			lassoDragging = false;
			releasePointer(event);
			return;
		}

		if (drawing) {
			drawing = false;
			backup = null;
			start = null;
			last = null;
			strokePath = [];
			strokePixelPerfect = false;
			editor.touch();
		}
		releasePointer(event);
		editor.cursor = pixelFromEvent(event);
	}

	function handlePointerLeave(): void {
		if (drawing || selecting || lassoDragging || movingSelection || panning) return;
		editor.cursor = null;
		hoveringSelection = false;
		hoveringMirror = null;
		if (editor.tool === "lasso") lassoHover = null;
	}

	function handleWindowKeydown(event: KeyboardEvent): void {
		if (event.key === "Escape" && lassoPoints.length > 0) resetLasso();
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
				<div class="checkerboard checkerboard-lg absolute inset-0"></div>

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

				{#if editor.cursor && isDrawable && showBrushCursor}
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

<svelte:window onkeydown={handleWindowKeydown} />
