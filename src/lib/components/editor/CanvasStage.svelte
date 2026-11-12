<script lang="ts">
	import Grid3x3 from "@lucide/svelte/icons/grid-3x3";
	import Maximize2 from "@lucide/svelte/icons/maximize-2";
	import Minus from "@lucide/svelte/icons/minus";
	import Plus from "@lucide/svelte/icons/plus";
	import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
	import RotateCw from "@lucide/svelte/icons/rotate-cw";
	import ZoomIn from "@lucide/svelte/icons/zoom-in";
	import ZoomOut from "@lucide/svelte/icons/zoom-out";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { compositeFrameCached, compositePixel } from "$lib/editor/doc.js";
	import {
		blurPixels,
		fillPixels,
		gradientPixels,
		jumblePixels,
		paintBrush,
		paintPixel,
		plotCubicCurve,
		plotLine,
		plotShape,
		sprayPixels,
	} from "$lib/editor/draw.js";
	import {
		colorSelectionMask,
		isSelectionPoint,
		lassoSelectionMask,
		magicWandMask,
		shapeSelectionMask,
		unionSelectionMasks,
	} from "$lib/editor/selection.js";
	import { drawPixels, drawScaled } from "$lib/editor/render.js";
	import { editor, type FloatingSelection } from "$lib/editor/editor.svelte.js";
	import { isSelectionTool, usesPixelPerfect } from "$lib/editor/tools.js";
	import type {
		MirrorAxis,
		MirrorKind,
		Point,
		ReferenceImage,
	} from "$lib/editor/types.js";
	import { cn } from "$lib/utils.js";
	import Preview from "./Preview.svelte";
	import ReferenceBoardImage from "./ReferenceBoardImage.svelte";
	import ReferenceBoardPanel from "./ReferenceBoardPanel.svelte";

	const ROTATION_OPTIONS = Array.from({ length: 25 }, (_, index) => -180 + index * 15);
	const GRID_SIZES = [1, 2, 4, 8, 16, 32, 64];
	const GRID_MIN = GRID_SIZES[0]!;
	const GRID_MAX = GRID_SIZES[GRID_SIZES.length - 1]!;

	function stepGridSize(direction: 1 | -1): void {
		const current = GRID_SIZES.indexOf(editor.gridSize);
		const index =
			current >= 0
				? current
				: GRID_SIZES.findIndex((size) => size > editor.gridSize);
		let nextIndex: number;
		if (index < 0) {
			nextIndex = GRID_SIZES.length - 1;
		} else {
			nextIndex = Math.max(0, Math.min(GRID_SIZES.length - 1, index + direction));
		}
		editor.setGridSize(GRID_SIZES[nextIndex]!);
	}

	let stage: HTMLDivElement | undefined;
	let canvas: HTMLCanvasElement | undefined;
	let overlayCanvas: HTMLCanvasElement | undefined;
	let mirrorCanvas: HTMLCanvasElement | undefined;
	let floatingCanvas: HTMLCanvasElement | null = null;
	let mirrorCanvasHasContent = false;
	/** Cached stage bounds; refreshed by the ResizeObserver. */
	let stageRect = { left: 0, top: 0, width: 0, height: 0 };

	let drawing = false;
	let start: Point | null = null;
	let last: Point | null = null;
	let backup: Uint32Array | null = null;
	/** Packed color captured on pointer down, so the whole stroke stays consistent. */
	let strokeColor = 0;
	/** Mirror axes captured on pointer down; avoids rebuilding the array per pixel. */
	let strokeMirrors: readonly MirrorAxis[] = [];
	let gradientStartColor = 0;
	let gradientEndColor = 0;
	let gradientHistoryPushed = false;
	let strokePath: Point[] = [];
	let strokePixelPerfect = false;

	let sprayTimer: ReturnType<typeof setInterval> | null = null;
	let sprayAccumulator = 0;
	let sprayLastTick = 0;

	type CurvePhase = "idle" | "base" | "adjust1" | "adjust2";
	let curvePhase: CurvePhase = "idle";
	let curveDragging = false;
	let curveStart: Point | null = null;
	let curveEnd: Point | null = null;
	let curveControl1: Point | null = null;
	let curveControl2: Point | null = null;
	let curveBackup: Uint32Array | null = null;
	let curveHistoryPushed = false;

	let panning = $state(false);
	let panOrigin = { x: 0, y: 0, panX: 0, panY: 0 };
	let wheelAccumulator = 0;

	let selecting = false;
	let selectStart: Point | null = null;
	let selectAdditive = false;
	let selectBaseMask: Uint8Array | null = null;

	let lassoPoints = $state<Point[]>([]);
	let lassoHover = $state<Point | null>(null);
	let lassoDragging = false;
	let lassoAdditive = false;
	let lassoBaseMask: Uint8Array | null = null;

	let movingSelection = false;
	let moveStart: Point | null = null;
	let moveContent: FloatingSelection | null = null;
	let moveOriginX = 0;
	let moveOriginY = 0;
	let moveApplied = false;
	/** True when the drag started on content that was already floating. */
	let moveExistingFloating = false;

	let hoveringSelection = $state(false);
	let hoveringMirror = $state<MirrorKind | null>(null);
	let draggingMirror = $state<MirrorKind | null>(null);
	let hoveringReference = $state(false);
	let draggingReference = $state<{
		id: string;
		startX: number;
		startY: number;
		originX: number;
		originY: number;
	} | null>(null);

	let zoom = $derived(editor.effectiveZoom);
	let canvasWidth = $derived(editor.doc.width * zoom);
	let canvasHeight = $derived(editor.doc.height * zoom);
	let gridStep = $derived(zoom * editor.gridSize);
	let isDrawable = $derived(editor.activeLayerDrawable);

	let brushCursorSize = $derived(
		editor.tool === "pencil" ||
			editor.tool === "eraser" ||
			editor.tool === "line" ||
			editor.tool === "curve" ||
			(editor.tool === "shape" && !editor.shapeFilled)
			? editor.brushSize
			: 1,
	);
	let cursorOffset = $derived(Math.floor((brushCursorSize - 1) / 2));

	let areaToolRadius = $derived(
		editor.tool === "spray"
			? editor.sprayRadius
			: editor.tool === "blur"
				? editor.blurRadius
				: editor.tool === "jumble"
					? editor.jumbleRadius
					: 0,
	);

	let showBrushCursor = $derived(
		!panning &&
			!draggingMirror &&
			!hoveringMirror &&
			!draggingReference &&
			!hoveringReference &&
			editor.tool !== "pan" &&
			editor.tool !== "zoom" &&
			!isSelectionTool(editor.tool),
	);

	let canvasCursor = $derived(
		draggingReference
			? "cursor-grabbing"
			: hoveringReference
				? "cursor-move"
				: draggingMirror
					? mirrorCursor(draggingMirror)
					: hoveringMirror
						? mirrorCursor(hoveringMirror)
						: panning
							? "cursor-grabbing"
							: editor.tool === "pan"
								? "cursor-grab"
								: editor.tool === "zoom"
									? "cursor-zoom-in"
									: isSelectionTool(editor.tool)
										? hoveringSelection
											? "cursor-move"
											: "cursor-crosshair"
										: editor.tool === "eyedropper"
											? "cursor-copy"
											: !isDrawable
												? "cursor-not-allowed"
												: editor.tool === "fill"
													? "cursor-cell"
													: "cursor-crosshair",
	);

	let stageCursor = $derived(
		draggingReference
			? "cursor-grabbing"
			: hoveringReference
				? "cursor-move"
				: draggingMirror
					? mirrorCursor(draggingMirror)
					: hoveringMirror
						? mirrorCursor(hoveringMirror)
						: panning
							? "cursor-grabbing"
							: editor.tool === "pan"
								? "cursor-grab"
								: "",
	);

	$effect(() => {
		if (!stage) return;
		const refresh = () => {
			if (!stage) return;
			const rect = stage.getBoundingClientRect();
			stageRect = {
				left: rect.left,
				top: rect.top,
				width: rect.width,
				height: rect.height,
			};
			editor.viewport = { w: rect.width, h: rect.height };
		};
		refresh();
		const observer = new ResizeObserver(refresh);
		observer.observe(stage);
		return () => observer.disconnect();
	});

	$effect(() => {
		const doc = editor.doc;
		const frame = editor.activeFrame;
		const currentZoom = editor.effectiveZoom;
		const revision = editor.revision;

		if (!canvas) return;
		// Coalesce rapid pointer moves into one draw per animation frame.
		const id = requestAnimationFrame(() => {
			if (!canvas) return;
			const pixels = compositeFrameCached(doc, frame, revision, true);
			drawScaled(
				canvas,
				pixels,
				doc.width,
				doc.height,
				doc.width * currentZoom,
				doc.height * currentZoom,
			);
		});
		return () => cancelAnimationFrame(id);
	});

	$effect(() => {
		const doc = editor.doc;
		const currentZoom = editor.effectiveZoom;
		const selection = editor.selection;
		const floating = editor.floating;
		editor.selectionRevision;
		const lasso = lassoPoints;
		const hover = lassoHover;

		if (!overlayCanvas) return;
		const id = requestAnimationFrame(() => {
			if (!overlayCanvas) return;
			const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
			const bufferWidth = Math.max(1, Math.round(doc.width * currentZoom * dpr));
			const bufferHeight = Math.max(1, Math.round(doc.height * currentZoom * dpr));
			if (overlayCanvas.width !== bufferWidth) overlayCanvas.width = bufferWidth;
			if (overlayCanvas.height !== bufferHeight) overlayCanvas.height = bufferHeight;

			const context = overlayCanvas.getContext("2d");
			if (!context) return;
			drawOverlay(context, selection, floating, lasso, hover, doc.width, doc.height);
		});
		return () => cancelAnimationFrame(id);
	});

	$effect(() => {
		// Mirror guides depend on the axes and the view transform, not on pixel
		// edits. Re-clearing the full-stage overlay on every brush stamp was a
		// significant cost.
		editor.viewport;
		editor.panX;
		editor.panY;
		editor.rotation;
		const axes = editor.mirrorAxes;
		zoom;
		canvasWidth;
		canvasHeight;
		if (axes.length === 0 && !mirrorCanvasHasContent) return;
		const id = requestAnimationFrame(drawMirrorOverlay);
		return () => cancelAnimationFrame(id);
	});

	$effect(() => {
		const bounds = panBounds();
		if (!bounds) return;
		if (
			editor.panX < bounds.minX ||
			editor.panX > bounds.maxX ||
			editor.panY < bounds.minY ||
			editor.panY > bounds.maxY
		) {
			// A resize or document change left the canvas off stage; recenter it.
			editor.panX = 0;
			editor.panY = 0;
		}
	});

	$effect(() => {
		const tool = editor.tool;
		if (tool !== "spray") stopSpray();
		if (tool !== "lasso") resetLasso();
		if (tool !== "curve" && curvePhase !== "idle") finishCurve();
	});

	$effect(() => () => stopSpray());

	$effect(() => {
		editor.activeProjectId;
		stopSpray();
		resetLasso();
		resetCurveState(false);
		draggingReference = null;
		hoveringReference = false;
		selecting = false;
	});

	$effect(() => {
		editor.activeLayerId;
		editor.activeFrame;
		stopSpray();
		if (curvePhase !== "idle") finishCurve();
	});

	$effect(() => {
		editor.historyActionRevision;
		stopSpray();
		if (curvePhase !== "idle") resetCurveState(false);
	});

	/** Maps a pointer event into unrotated canvas-local screen pixels. */
	function pointerToLocalCanvas(event: {
		clientX: number;
		clientY: number;
	}): { x: number; y: number } | null {
		if (!stage) return null;
		const rect = stageRect;
		if (rect.width === 0 || rect.height === 0) return null;

		const centerX = rect.left + rect.width / 2 + editor.panX;
		const centerY = rect.top + rect.height / 2 + editor.panY;
		const dx = event.clientX - centerX;
		const dy = event.clientY - centerY;
		const radians = (editor.rotation * Math.PI) / 180;
		const cosine = Math.cos(radians);
		const sine = Math.sin(radians);

		return {
			x: dx * cosine + dy * sine + canvasWidth / 2,
			y: -dx * sine + dy * cosine + canvasHeight / 2,
		};
	}

	function pixelFromEvent(event: PointerEvent, clampToCanvas = false): Point | null {
		const local = pointerToLocalCanvas(event);
		if (!local || canvasWidth <= 0 || canvasHeight <= 0) return null;

		let relativeX = local.x / canvasWidth;
		let relativeY = local.y / canvasHeight;

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

	/** Maps a pointer event to document coordinates, including outside the canvas. */
	function documentPointFromEvent(event: {
		clientX: number;
		clientY: number;
	}): Point | null {
		const local = pointerToLocalCanvas(event);
		const scale = editor.effectiveZoom;
		if (!local || scale <= 0) return null;
		return { x: local.x / scale, y: local.y / scale };
	}

	/** Board references are draggable only while selected and unlocked. */
	function referenceAtEvent(event: PointerEvent): ReferenceImage | null {
		if (!editor.showReferenceBoard) return null;
		const reference = editor.activeReference;
		if (!reference || reference.locked || !reference.visible) return null;
		const point = documentPointFromEvent(event);
		if (!point) return null;

		const centerX = reference.x + reference.width / 2;
		const centerY = reference.y + reference.height / 2;
		const dx = point.x - centerX;
		const dy = point.y - centerY;
		const radians = (reference.rotation * Math.PI) / 180;
		const cosine = Math.cos(radians);
		const sine = Math.sin(radians);
		// Undo the reference's own rotation before testing its local bounds.
		const localX = dx * cosine + dy * sine;
		const localY = -dx * sine + dy * cosine;

		if (
			Math.abs(localX) > reference.width / 2 ||
			Math.abs(localY) > reference.height / 2
		) {
			return null;
		}
		return reference;
	}

	function beginReferenceDrag(
		event: PointerEvent,
		reference: ReferenceImage,
		target: HTMLElement | undefined,
	): void {
		const point = documentPointFromEvent(event);
		if (!point) return;
		event.preventDefault();
		editor.selectReferenceImage(reference.id);
		draggingReference = {
			id: reference.id,
			startX: point.x,
			startY: point.y,
			originX: reference.x,
			originY: reference.y,
		};
		hoveringReference = true;
		capturePointer(event, target);
	}

	function updateReferenceDrag(event: PointerEvent): void {
		if (!draggingReference) return;
		const point = documentPointFromEvent(event);
		if (!point) return;
		editor.moveReferenceImage(
			draggingReference.id,
			Math.round(draggingReference.originX + point.x - draggingReference.startX),
			Math.round(draggingReference.originY + point.y - draggingReference.startY),
		);
	}

	function finishReferenceDrag(event: PointerEvent, target: HTMLElement | undefined): void {
		if (!draggingReference) return;
		draggingReference = null;
		hoveringReference = referenceAtEvent(event) !== null;
		releasePointer(event, target);
	}

	function isEditable(): boolean {
		return isDrawable;
	}

	function setCursor(point: Point | null): void {
		editor.cursor = point;
		if (point) editor.lastCursor = point;
	}

	function blurActiveInput(): void {
		const active = document.activeElement;
		if (!(active instanceof HTMLElement)) return;
		if (
			active.tagName === "INPUT" ||
			active.tagName === "TEXTAREA" ||
			active.tagName === "SELECT" ||
			active.isContentEditable
		) {
			active.blur();
		}
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
		if (
			!editor.mirrorX &&
			!editor.mirrorY &&
			!editor.mirrorDiagonalDown &&
			!editor.mirrorDiagonalUp
		) {
			return null;
		}
		const local = pointerToLocalCanvas(event);
		if (!local || !stage) return null;

		const width = editor.doc.width;
		const height = editor.doc.height;
		const scale = canvasWidth / width;
		if (scale <= 0) return null;

		let best: MirrorAxis | null = null;
		let bestDistance = 6;

		for (const axis of editor.mirrorAxes) {
			let distance: number;
			if (axis.kind === "x") {
				distance = Math.abs(local.y - axis.position * scale);
			} else if (axis.kind === "y") {
				distance = Math.abs(local.x - axis.position * scale);
			} else if (axis.kind === "diagonal-down") {
				distance =
					Math.abs(local.y - local.x - axis.position * scale) / Math.SQRT2;
			} else {
				distance =
					Math.abs(local.x + local.y - axis.position * scale) / Math.SQRT2;
			}

			if (distance < bestDistance) {
				best = axis;
				bestDistance = distance;
			}
		}

		return best;
	}

	function updateMirrorDrag(event: PointerEvent): void {
		if (!draggingMirror) return;
		const local = pointerToLocalCanvas(event);
		if (!local) return;

		const scale = canvasWidth / editor.doc.width;
		if (scale <= 0) return;

		const boundaryX = local.x / scale;
		const boundaryY = local.y / scale;
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
			strokeMirrors,
			editor.selection,
			editor.lockAlpha,
		);
	}

	function sprayAt(cel: Uint32Array, point: Point, count: number): boolean {
		return sprayPixels(
			cel,
			editor.doc.width,
			editor.doc.height,
			point.x,
			point.y,
			editor.sprayRadius,
			count,
			strokeColor,
			strokeMirrors,
			editor.selection,
			editor.lockAlpha,
		);
	}

	function applyAreaTool(cel: Uint32Array, point: Point): boolean {
		if (editor.tool === "blur") {
			return blurPixels(
				cel,
				editor.doc.width,
				editor.doc.height,
				point.x,
				point.y,
				editor.blurRadius,
				editor.blurPower,
				editor.selection,
				editor.lockAlpha,
			);
		}
		if (editor.tool === "jumble") {
			return jumblePixels(
				cel,
				editor.doc.width,
				editor.doc.height,
				point.x,
				point.y,
				editor.jumbleRadius,
				editor.jumblePower,
				editor.selection,
				editor.lockAlpha,
			);
		}
		return false;
	}

	function stopSpray(): void {
		if (sprayTimer !== null) {
			clearInterval(sprayTimer);
			sprayTimer = null;
		}
		sprayAccumulator = 0;
	}

	function startSpray(): void {
		stopSpray();
		sprayLastTick = performance.now();
		sprayTimer = setInterval(() => {
			if (!drawing || editor.tool !== "spray") {
				stopSpray();
				return;
			}

			const point = last;
			const cel = editor.activeLayer.cels[editor.activeFrame];
			if (!point || !cel) return;

			const now = performance.now();
			const elapsed = Math.min(0.25, (now - sprayLastTick) / 1000);
			sprayLastTick = now;
			sprayAccumulator += editor.sprayRate * elapsed;
			const count = Math.floor(sprayAccumulator);
			if (count < 1) return;
			sprayAccumulator -= count;

			if (sprayAt(cel, point, Math.min(count, 128))) editor.touch();
		}, 30);
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
				strokeMirrors,
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
				strokeMirrors,
				editor.selection,
				editor.lockAlpha,
			);

		if (editor.tool === "line") {
			plotLine(start.x, start.y, end.x, end.y, stroke);
		} else if (editor.tool === "shape") {
			plotShape(
				editor.shapeKind,
				start.x,
				start.y,
				end.x,
				end.y,
				editor.shapeFilled,
				editor.shapeFilled ? dot : stroke,
			);
		}
	}

	function drawGradient(
		cel: Uint32Array,
		end: Point,
		onFirstChange: () => void,
	): boolean {
		if (!backup || !start) return false;
		cel.set(backup);

		const tolerance = Math.round((editor.gradientTolerance / 100) * 255);
		return gradientPixels(
			cel,
			editor.doc.width,
			editor.doc.height,
			start.x,
			start.y,
			end.x,
			end.y,
			gradientStartColor,
			gradientEndColor,
			tolerance,
			editor.gradientContiguous,
			editor.gradientShape,
			editor.gradientDither,
			editor.selection,
			editor.lockAlpha,
			onFirstChange,
		);
	}

	function drawCurvePreview(cel: Uint32Array): void {
		if (!curveBackup || !curveStart || !curveEnd) return;
		cel.set(curveBackup);

		const control1 = curveControl1 ?? curveStart;
		const control2 = curveControl2 ?? curveEnd;
		const stroke = (x: number, y: number) =>
			paintBrush(
				cel,
				editor.doc.width,
				editor.doc.height,
				x,
				y,
				editor.brushSize,
				strokeColor,
				strokeMirrors,
				editor.selection,
				editor.lockAlpha,
			);

		const rawPath: Point[] = [];
		plotCubicCurve(
			curveStart.x,
			curveStart.y,
			control1.x,
			control1.y,
			control2.x,
			control2.y,
			curveEnd.x,
			curveEnd.y,
			(x, y) => rawPath.push({ x, y }),
		);

		const path =
			editor.pixelPerfect && usesPixelPerfect("curve")
				? filterPixelPerfectPath(rawPath)
				: rawPath;
		for (const point of path) stroke(point.x, point.y);
		editor.touch();
	}

	function resetCurveState(restorePreview: boolean): void {
		if (restorePreview && curveBackup) {
			const cel = editor.activeLayer.cels[editor.activeFrame];
			if (cel) {
				cel.set(curveBackup);
				editor.touch();
			}
		}

		curvePhase = "idle";
		curveDragging = false;
		curveStart = null;
		curveEnd = null;
		curveControl1 = null;
		curveControl2 = null;
		curveBackup = null;
		curveHistoryPushed = false;
	}

	function finishCurve(): void {
		resetCurveState(false);
	}

	function appendPixelPerfectPointTo(path: Point[], x: number, y: number): boolean {
		const lastPoint = path[path.length - 1];
		if (lastPoint && lastPoint.x === x && lastPoint.y === y) return false;

		path.push({ x, y });
		let removed = false;

		while (path.length >= 3) {
			const length = path.length;
			const a = path[length - 3]!;
			const b = path[length - 2]!;
			const c = path[length - 1]!;

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
				path.splice(length - 2, 1);
				removed = true;
				continue;
			}
			break;
		}

		return removed;
	}

	function appendPixelPerfectPoint(x: number, y: number): boolean {
		return appendPixelPerfectPointTo(strokePath, x, y);
	}

	function filterPixelPerfectPath(points: readonly Point[]): Point[] {
		const path: Point[] = [];
		for (const point of points) appendPixelPerfectPointTo(path, point.x, point.y);
		return path;
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
				strokeMirrors,
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
		const value = editor.sampleAllLayers
			? compositePixel(editor.doc, frame, point.x, point.y)
			: editor.activeLayer.cels[frame]?.[point.y * editor.doc.width + point.x];
		if (value === undefined) return;
		editor.setColorFromPacked(value, slot);
	}

	function startPan(event: PointerEvent): void {
		event.preventDefault();
		panning = true;
		panOrigin = {
			x: event.clientX,
			y: event.clientY,
			panX: editor.panX,
			panY: editor.panY,
		};
		capturePointer(event);
	}

	function panBounds(): {
		minX: number;
		maxX: number;
		minY: number;
		maxY: number;
	} | null {
		const viewport = editor.viewport;
		if (viewport.w <= 0 || viewport.h <= 0) return null;

		const scale = editor.effectiveZoom;
		const width = editor.doc.width * scale;
		const height = editor.doc.height * scale;
		const radians = (editor.rotation * Math.PI) / 180;
		const cosine = Math.abs(Math.cos(radians));
		const sine = Math.abs(Math.sin(radians));
		const rotatedWidth = width * cosine + height * sine;
		const rotatedHeight = width * sine + height * cosine;
		// Keep at least one whole sprite pixel inside the stage on each axis.
		const visibleX = Math.min(scale, rotatedWidth, viewport.w);
		const visibleY = Math.min(scale, rotatedHeight, viewport.h);

		return {
			minX: visibleX - (viewport.w + rotatedWidth) / 2,
			maxX: (viewport.w + rotatedWidth) / 2 - visibleX,
			minY: visibleY - (viewport.h + rotatedHeight) / 2,
			maxY: (viewport.h + rotatedHeight) / 2 - visibleY,
		};
	}

	function clampPan(): void {
		const bounds = panBounds();
		if (!bounds) return;
		editor.panX = Math.max(bounds.minX, Math.min(bounds.maxX, editor.panX));
		editor.panY = Math.max(bounds.minY, Math.min(bounds.maxY, editor.panY));
	}

	function updatePan(event: PointerEvent): void {
		editor.panX = panOrigin.panX + (event.clientX - panOrigin.x);
		editor.panY = panOrigin.panY + (event.clientY - panOrigin.y);
		clampPan();
	}

	function zoomAtPoint(
		event: { clientX: number; clientY: number },
		direction: 1 | -1,
	): void {
		if (!stage) return;

		const oldZoom = editor.effectiveZoom;
		const nextZoom = Math.max(1, Math.min(64, oldZoom + direction));
		if (nextZoom === oldZoom) return;

		const rect = stageRect;
		if (rect.width === 0 || rect.height === 0) return;

		// Move the view to the midpoint between the pointer and the current center.
		const stageCenterX = rect.left + rect.width / 2;
		const stageCenterY = rect.top + rect.height / 2;
		editor.panX = (editor.panX + (event.clientX - stageCenterX)) / 2;
		editor.panY = (editor.panY + (event.clientY - stageCenterY)) / 2;
		editor.zoom = nextZoom;
		clampPan();
	}

	function handleWheel(event: WheelEvent): void {
		if (event.deltaY === 0) return;
		event.preventDefault();

		const scale =
			event.deltaMode === WheelEvent.DOM_DELTA_LINE
				? 16
				: event.deltaMode === WheelEvent.DOM_DELTA_PAGE
					? 400
					: 1;
		wheelAccumulator += event.deltaY * scale;
		if (Math.abs(wheelAccumulator) < 40) return;

		const direction: 1 | -1 = wheelAccumulator < 0 ? 1 : -1;
		wheelAccumulator = 0;
		zoomAtPoint(event, direction);
	}

	function updateShapeSelection(point: Point): void {
		if (!selectStart) return;
		const width = editor.doc.width;
		const height = editor.doc.height;
		const mask = shapeSelectionMask(
			editor.selectionShape,
			selectStart.x,
			selectStart.y,
			point.x,
			point.y,
			width,
			height,
		);
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
		if (!editor.selection) return;

		const existing = editor.floating;
		if (existing) {
			movingSelection = true;
			moveStart = point;
			moveContent = existing;
			moveOriginX = existing.originX;
			moveOriginY = existing.originY;
			moveApplied = false;
			moveExistingFloating = true;
			return;
		}

		const cel = editor.activeLayer.cels[editor.activeFrame];
		if (!cel) return;

		const content = editor.createFloatingSelection();
		if (!content) return;

		movingSelection = true;
		moveStart = point;
		moveContent = content;
		moveOriginX = content.originX;
		moveOriginY = content.originY;
		moveApplied = false;
		moveExistingFloating = false;
	}

	function updateSelectionMove(point: Point): void {
		if (!moveStart || !moveContent) return;
		const dx = point.x - moveStart.x;
		const dy = point.y - moveStart.y;
		if (dx === 0 && dy === 0 && !moveApplied) return;

		const targetX = moveOriginX + dx;
		const targetY = moveOriginY + dy;

		if (!moveApplied) {
			if (moveExistingFloating) {
				editor.moveFloatingSelection(targetX, targetY);
			} else {
				editor.beginFloatingMove(moveContent, targetX, targetY);
			}
			moveApplied = true;
			return;
		}

		editor.moveFloatingSelection(targetX, targetY);
	}

	function finishSelectionMove(): void {
		// A lifted selection is applied when the drag ends. An existing floating
		// paste stays floating until the user deselects it.
		if (moveApplied && !moveExistingFloating) {
			editor.commitFloatingSelection();
		}
		movingSelection = false;
		moveStart = null;
		moveContent = null;
		moveApplied = false;
		moveExistingFloating = false;
	}

	function capturePointer(
		event: PointerEvent,
		target: HTMLElement | undefined = canvas,
	): void {
		try {
			target?.setPointerCapture(event.pointerId);
		} catch {
			// Synthetic pointer events may not own a capture target.
		}
	}

	function releasePointer(
		event: PointerEvent,
		target: HTMLElement | undefined = canvas,
	): void {
		if (target?.hasPointerCapture(event.pointerId)) {
			target.releasePointerCapture(event.pointerId);
		}
	}

	function drawFloatingPixels(
		context: CanvasRenderingContext2D,
		floating: FloatingSelection,
		scaleX: number,
		scaleY: number,
	): void {
		if (!floatingCanvas) floatingCanvas = document.createElement("canvas");
		drawPixels(
			floatingCanvas,
			floating.pixels,
			Math.max(1, floating.width),
			Math.max(1, floating.height),
		);

		context.save();
		context.globalAlpha = 0.5;
		context.imageSmoothingEnabled = false;
		context.drawImage(
			floatingCanvas,
			floating.originX * scaleX,
			floating.originY * scaleY,
			floating.width * scaleX,
			floating.height * scaleY,
		);
		context.restore();
	}

	function drawOverlay(
		context: CanvasRenderingContext2D,
		selection: Uint8Array | null,
		floating: FloatingSelection | null,
		lasso: Point[],
		hover: Point | null,
		docWidth: number,
		docHeight: number,
	): void {
		const scaleX = context.canvas.width / docWidth;
		const scaleY = context.canvas.height / docHeight;
		const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
		const lineWidth = Math.max(2, dpr * 1.5);

		context.save();
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, context.canvas.width, context.canvas.height);
		context.lineJoin = "round";
		context.lineCap = "butt";

		if (floating) drawFloatingPixels(context, floating, scaleX, scaleY);

		if (selection) {
			// Trace horizontal runs instead of testing four neighbors for every
			// selected pixel. Large selections produce far fewer path segments.
			const emitHorizontal = (
				rowStart: number,
				runStart: number,
				runEnd: number,
				neighborOffset: number,
				edgeY: number,
			) => {
				let segmentStart = -1;
				for (let px = runStart; px <= runEnd; px++) {
					const covered =
						neighborOffset !== 0 &&
						selection[rowStart + neighborOffset + px] === 1;
					if (!covered) {
						if (segmentStart < 0) segmentStart = px;
					} else if (segmentStart >= 0) {
						context.moveTo(segmentStart * scaleX, edgeY);
						context.lineTo(px * scaleX, edgeY);
						segmentStart = -1;
					}
				}
				if (segmentStart >= 0) {
					context.moveTo(segmentStart * scaleX, edgeY);
					context.lineTo((runEnd + 1) * scaleX, edgeY);
				}
			};

			context.beginPath();
			for (let y = 0; y < docHeight; y++) {
				const rowStart = y * docWidth;
				const y0 = y * scaleY;
				const y1 = (y + 1) * scaleY;
				let x = 0;
				while (x < docWidth) {
					if (!selection[rowStart + x]) {
						x++;
						continue;
					}
					const runStart = x;
					while (x < docWidth && selection[rowStart + x]) x++;
					const runEnd = x - 1;
					const x0 = runStart * scaleX;
					const x1 = (runEnd + 1) * scaleX;

					// Emit only the parts of the run whose neighbor is unselected,
					// merging contiguous spans into one path segment.
					emitHorizontal(
						rowStart,
						runStart,
						runEnd,
						y === 0 ? 0 : -docWidth,
						y0,
					);
					emitHorizontal(
						rowStart,
						runStart,
						runEnd,
						y === docHeight - 1 ? 0 : docWidth,
						y1,
					);

					if (runStart === 0 || !selection[rowStart + runStart - 1]) {
						context.moveTo(x0, y0);
						context.lineTo(x0, y1);
					}
					if (runEnd === docWidth - 1 || !selection[rowStart + runEnd + 1]) {
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

		context.restore();
	}

	/** Draw mirror guides across the whole stage, not just over the sprite. */
	function drawMirrorOverlay(): void {
		if (!mirrorCanvas || !stage) return;
		const axes = editor.mirrorAxes;
		// The common case (no mirror guides) must not touch the full-stage
		// canvas while panning or zooming.
		if (axes.length === 0 && !mirrorCanvasHasContent) return;

		const width = Math.max(1, Math.round(stageRect.width));
		const height = Math.max(1, Math.round(stageRect.height));
		const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
		const bufferWidth = Math.round(width * dpr);
		const bufferHeight = Math.round(height * dpr);

		if (mirrorCanvas.width !== bufferWidth || mirrorCanvas.height !== bufferHeight) {
			mirrorCanvas.width = bufferWidth;
			mirrorCanvas.height = bufferHeight;
			mirrorCanvasHasContent = false;
		}

		const context = mirrorCanvas.getContext("2d");
		if (!context) return;

		if (axes.length === 0) {
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, bufferWidth, bufferHeight);
			mirrorCanvasHasContent = false;
			return;
		}

		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, bufferWidth, bufferHeight);

		const scale = editor.effectiveZoom;
		const centerX = width / 2 + editor.panX;
		const centerY = height / 2 + editor.panY;
		const span = width + height + canvasWidth + canvasHeight;

		context.setTransform(dpr, 0, 0, dpr, 0, 0);
		context.translate(centerX, centerY);
		context.rotate((editor.rotation * Math.PI) / 180);
		context.translate(-canvasWidth / 2, -canvasHeight / 2);
		context.beginPath();

		for (const axis of axes) {
			const offset = axis.position * scale;
			if (axis.kind === "x") {
				context.moveTo(-span, offset);
				context.lineTo(span, offset);
			} else if (axis.kind === "y") {
				context.moveTo(offset, -span);
				context.lineTo(offset, span);
			} else if (axis.kind === "diagonal-down") {
				context.moveTo(-span, -span + offset);
				context.lineTo(span, span + offset);
			} else {
				context.moveTo(-span, span + offset);
				context.lineTo(span, -span + offset);
			}
		}

		context.lineWidth = 1.5;
		context.setLineDash([6, 4]);
		context.strokeStyle = "rgba(14, 165, 233, 0.95)";
		context.stroke();
		context.setLineDash([]);
		mirrorCanvasHasContent = true;
	}

	function handlePointerDown(event: PointerEvent): void {
		blurActiveInput();
		const tool = editor.tool;

		if (event.button === 1) {
			event.preventDefault();
			hoveringMirror = null;
			hoveringReference = false;
			if (!drawing && !movingSelection && !selecting && !lassoDragging) {
				startPan(event);
			}
			return;
		}

		if (event.button === 0) {
			const reference = referenceAtEvent(event);
			if (reference) {
				beginReferenceDrag(event, reference, canvas);
				return;
			}

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
			zoomAtPoint(event, event.button === 0 ? 1 : -1);
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
		setCursor(point);
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
			if (tool === "shape-select") {
				selecting = true;
				selectStart = point;
				selectAdditive = additive;
				selectBaseMask = additive && editor.selection ? new Uint8Array(editor.selection) : null;
				updateShapeSelection(point);
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
			// Picking is read-only, so it works even when the active layer is
			// locked or hidden.
			pickColor(point, secondary ? "secondary" : "primary");
			return;
		}

		if (!isDrawable) return;

		const layer = editor.activeLayer;
		const cel = layer.cels[editor.activeFrame];
		if (!cel) return;

		if (tool === "curve") {
			if (curvePhase === "idle") {
				if (editor.selection && !isPointSelected(point)) return;
				strokeColor = secondary ? editor.secondaryCurrentColor : editor.currentColor;
				strokeMirrors = editor.mirrorAxes;
				curveStart = point;
				curveEnd = point;
				curveControl1 = point;
				curveControl2 = point;
				curveBackup = new Uint32Array(cel);
				curveHistoryPushed = false;
				curvePhase = "base";
				curveDragging = true;
				return;
			}

			if (curvePhase === "adjust1") {
				curveControl1 = point;
			} else if (curvePhase === "adjust2") {
				curveControl2 = point;
			}
			curveDragging = true;
			drawCurvePreview(cel);
			return;
		}

		if (editor.selection && !isPointSelected(point)) return;
		strokeColor = secondary ? editor.secondaryCurrentColor : editor.currentColor;
		strokeMirrors = editor.mirrorAxes;
		gradientStartColor = secondary ? editor.secondaryCurrentColor : editor.currentColor;
		gradientEndColor = secondary ? editor.currentColor : editor.secondaryCurrentColor;

		if (tool === "fill") {
			// Apply pending floating content first so the fill region is computed
			// against the final pixels, then only record history if something
			// actually changes.
			if (editor.floating) editor.commitFloatingSelection();
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
				() => editor.pushHistoryCel(layer.id, editor.activeFrame),
			);
			if (changed) editor.touch();
			return;
		}

		if (tool === "gradient") {
			// The gradient is only committed after the pointer moves, so a
			// click does not create an empty history entry.
			backup = new Uint32Array(cel);
			drawing = true;
			start = point;
			last = point;
			gradientHistoryPushed = false;
			strokePath = [];
			strokePixelPerfect = false;
			return;
		}

		editor.pushHistoryCel(layer.id, editor.activeFrame);
		backup = new Uint32Array(cel);
		drawing = true;
		start = point;
		last = point;
		strokePixelPerfect = editor.pixelPerfect && usesPixelPerfect(tool);
		strokePath = strokePixelPerfect ? [point] : [];

		if (tool === "spray") {
			if (sprayAt(cel, point, 1)) editor.touch();
			startSpray();
		} else if (tool === "blur" || tool === "jumble") {
			if (applyAreaTool(cel, point)) editor.touch();
		} else if (tool === "pencil" || tool === "eraser") {
			paintAt(cel, point.x, point.y);
			editor.touch();
		} else {
			drawShape(cel, point);
			editor.touch();
		}
	}

	function handlePointerMove(event: PointerEvent): void {
		if (draggingReference) {
			updateReferenceDrag(event);
			return;
		}

		if (draggingMirror) {
			updateMirrorDrag(event);
			return;
		}

		if (!panning && !movingSelection && !selecting && !lassoDragging && !drawing) {
			hoveringReference = referenceAtEvent(event) !== null;
			hoveringMirror = mirrorAtEvent(event)?.kind ?? null;
		}

		if (panning) {
			updatePan(event);
			return;
		}

		if (movingSelection) {
			const point = pixelFromEvent(event, true);
			if (point) {
				setCursor(point);
				updateSelectionMove(point);
			}
			return;
		}

		if (selecting) {
			const point = pixelFromEvent(event, true);
			if (point) {
				setCursor(point);
				updateShapeSelection(point);
			}
			return;
		}

		if (lassoDragging) {
			const point = pixelFromEvent(event, true);
			if (point) {
				setCursor(point);
				appendLassoPoint(point);
			}
			return;
		}

		if (editor.tool === "curve" && curvePhase !== "idle") {
			const point = pixelFromEvent(event, true);
			if (!point) return;
			setCursor(point);

			if (curvePhase === "base" && curveDragging) {
				if (!curveEnd || curveEnd.x !== point.x || curveEnd.y !== point.y) {
					curveEnd = point;
					if (!curveHistoryPushed) {
						editor.pushHistoryCel(editor.activeLayerId, editor.activeFrame);
						curveHistoryPushed = true;
					}
					const cel = editor.activeLayer.cels[editor.activeFrame];
					if (cel) drawCurvePreview(cel);
				}
				return;
			}

			if (curveDragging) {
				if (curvePhase === "adjust1") {
					curveControl1 = point;
				} else if (curvePhase === "adjust2") {
					curveControl2 = point;
				}
				const cel = editor.activeLayer.cels[editor.activeFrame];
				if (cel) drawCurvePreview(cel);
			}
			return;
		}

		const point = pixelFromEvent(event);
		setCursor(point);

		if (editor.tool === "lasso") {
			lassoHover = point;
		}

		hoveringSelection = isSelectionTool(editor.tool) && isPointSelected(point);

		if (!drawing || !point) return;
		const layer = editor.activeLayer;
		const cel = layer.cels[editor.activeFrame];
		if (!cel) return;

		let changed = false;
		if (editor.tool === "pencil" || editor.tool === "eraser") {
			if (strokePixelPerfect) {
				updatePixelPerfectStroke(cel, point);
			} else {
				const from = last ?? point;
				plotLine(from.x, from.y, point.x, point.y, (x, y) => paintAt(cel, x, y));
				last = point;
			}
			changed = true;
		} else if (editor.tool === "spray") {
			// The spray timer paints while the pointer is held still.
			last = point;
		} else if (editor.tool === "blur" || editor.tool === "jumble") {
			if (!last || last.x !== point.x || last.y !== point.y) {
				last = point;
				changed = applyAreaTool(cel, point);
			}
		} else if (editor.tool === "gradient") {
			if (!last || last.x !== point.x || last.y !== point.y) {
				last = point;
				changed = drawGradient(cel, point, () => {
					if (gradientHistoryPushed) return;
					editor.pushHistoryCel(editor.activeLayerId, editor.activeFrame);
					gradientHistoryPushed = true;
				});
			}
		} else {
			drawShape(cel, point);
			changed = true;
		}
		if (changed) editor.touch();
	}

	function handlePointerUp(event: PointerEvent): void {
		if (draggingReference) {
			finishReferenceDrag(event, canvas);
			return;
		}

		if (draggingMirror) {
			draggingMirror = null;
			releasePointer(event);
			return;
		}

		if (editor.tool === "curve" && curvePhase !== "idle") {
			if (curveDragging) {
				if (curvePhase === "base") {
					if (
						!curveStart ||
						!curveEnd ||
						(curveStart.x === curveEnd.x && curveStart.y === curveEnd.y)
					) {
						resetCurveState(curveHistoryPushed);
					} else {
						curvePhase = "adjust1";
					}
				} else if (curvePhase === "adjust1") {
					curvePhase = "adjust2";
				} else if (curvePhase === "adjust2") {
					finishCurve();
				}
			}
			curveDragging = false;
			releasePointer(event);
			setCursor(pixelFromEvent(event));
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
			stopSpray();
			const commit = editor.tool !== "gradient" || gradientHistoryPushed;
			drawing = false;
			backup = null;
			start = null;
			last = null;
			strokePath = [];
			strokePixelPerfect = false;
			gradientHistoryPushed = false;
			strokeMirrors = [];
			if (commit) editor.touch();
		}
		releasePointer(event);
		setCursor(pixelFromEvent(event));
	}

	function handlePointerLeave(): void {
		if (drawing || selecting || lassoDragging || movingSelection || panning) return;
		setCursor(null);
		hoveringSelection = false;
		hoveringMirror = null;
		hoveringReference = false;
		if (editor.tool === "lasso") lassoHover = null;
	}

	function handleStagePointerDown(event: PointerEvent): void {
		if (event.button !== 0 || event.target === canvas) return;
		blurActiveInput();

		const reference = referenceAtEvent(event);
		if (reference) {
			beginReferenceDrag(event, reference, stage);
			return;
		}

		const mirror = mirrorAtEvent(event);
		if (mirror) {
			event.preventDefault();
			draggingMirror = mirror.kind;
			capturePointer(event, stage);
			return;
		}

		if (isSelectionTool(editor.tool)) editor.clearSelection();
	}

	function handleStagePointerMove(event: PointerEvent): void {
		if (event.target === canvas) return;

		if (draggingReference) {
			updateReferenceDrag(event);
			return;
		}

		if (draggingMirror) {
			updateMirrorDrag(event);
			return;
		}

		if (panning || movingSelection || selecting || lassoDragging || drawing) return;
		hoveringReference = referenceAtEvent(event) !== null;
		hoveringMirror = mirrorAtEvent(event)?.kind ?? null;
	}

	function handleStagePointerUp(event: PointerEvent): void {
		if (event.target === canvas) return;
		if (draggingReference) {
			finishReferenceDrag(event, stage);
			return;
		}
		if (!draggingMirror) return;
		draggingMirror = null;
		releasePointer(event, stage);
	}

	function handleStagePointerLeave(): void {
		if (draggingReference || draggingMirror) return;
		hoveringReference = false;
		hoveringMirror = null;
	}

	function handleWindowKeydown(event: KeyboardEvent): void {
		if (event.key === "Escape" && lassoPoints.length > 0) resetLasso();
	}
</script>

<section class="relative min-h-0 flex-1 overflow-hidden bg-muted/20">
	<div
		class={cn("canvas-stage absolute inset-0 overflow-hidden", stageCursor)}
		bind:this={stage}
		role="presentation"
		onwheel={handleWheel}
		onpointerdown={handleStagePointerDown}
		onpointermove={handleStagePointerMove}
		onpointerup={handleStagePointerUp}
		onpointercancel={handleStagePointerUp}
		onpointerleave={handleStagePointerLeave}
	>
		<div
			class="absolute left-1/2 top-1/2 shadow-xl ring-1 ring-border/70"
			style:width={`${canvasWidth}px`}
			style:height={`${canvasHeight}px`}
			style:transform={`translate(calc(-50% + ${editor.panX}px), calc(-50% + ${editor.panY}px)) rotate(${editor.rotation}deg)`}
		>
			<div class="checkerboard checkerboard-lg absolute inset-0"></div>

			{#each editor.doc.references as reference (reference.id)}
				{#if reference.visible}
					<ReferenceBoardImage
						{reference}
						{zoom}
						active={reference.id === editor.activeReferenceId}
					/>
				{/if}
			{/each}

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
				onmousedown={(event) => {
					if (event.button === 1) event.preventDefault();
				}}
				oncontextmenu={(event) => event.preventDefault()}
				aria-label="Pixel art canvas"
			></canvas>

			<canvas
				bind:this={overlayCanvas}
				class="pointer-events-none absolute inset-0 block"
				style:width={`${canvasWidth}px`}
				style:height={`${canvasHeight}px`}
				aria-hidden="true"
			></canvas>

			{#if editor.showGrid && gridStep >= 6}
				<div
					class="pointer-events-none absolute inset-0"
					style={`background-image: linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px); background-size: ${gridStep}px ${gridStep}px;`}
				></div>
			{/if}

			{#if editor.cursor && isDrawable && showBrushCursor}
				{#if areaToolRadius > 0}
					<div
						class="pointer-events-none absolute rounded-full border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
						style:left={`${(editor.cursor.x - areaToolRadius) * zoom}px`}
						style:top={`${(editor.cursor.y - areaToolRadius) * zoom}px`}
						style:width={`${(areaToolRadius * 2 + 1) * zoom}px`}
						style:height={`${(areaToolRadius * 2 + 1) * zoom}px`}
					></div>
				{:else}
					<div
						class="pointer-events-none absolute border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
						style:left={`${(editor.cursor.x - cursorOffset) * zoom}px`}
						style:top={`${(editor.cursor.y - cursorOffset) * zoom}px`}
						style:width={`${brushCursorSize * zoom}px`}
						style:height={`${brushCursorSize * zoom}px`}
					></div>
				{/if}
			{/if}
		</div>

		<canvas
			bind:this={mirrorCanvas}
			class="pointer-events-none absolute inset-0 h-full w-full"
			aria-hidden="true"
		></canvas>
	</div>

	<Preview />
	<ReferenceBoardPanel />

	<div
		class="absolute bottom-3 left-3 flex items-center gap-0.5 rounded-full border bg-background/90 p-1 shadow-sm backdrop-blur"
	>
		<Button
			variant={editor.showGrid ? "secondary" : "ghost"}
			size="icon-xs"
			class="rounded-full text-muted-foreground"
			onclick={() => (editor.showGrid = !editor.showGrid)}
			title="Toggle grid"
			aria-label="Toggle grid"
			aria-pressed={editor.showGrid}
		>
			<Grid3x3 class="size-3.5" />
		</Button>
		<Button
			variant="ghost"
			size="icon-xs"
			class="rounded-full text-muted-foreground"
			onclick={() => stepGridSize(-1)}
			disabled={editor.gridSize <= GRID_MIN}
			title="Decrease grid size"
			aria-label="Decrease grid size"
		>
			<Minus class="size-3.5" />
		</Button>
		<select
			class="h-6 cursor-pointer rounded-full bg-transparent px-1.5 font-mono text-[11px] tabular-nums text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
			value={editor.gridSize}
			onchange={(event) =>
				editor.setGridSize(Number((event.currentTarget as HTMLSelectElement).value))}
			title="Grid size in document pixels"
			aria-label="Grid size"
		>
			{#each GRID_SIZES as size (size)}
				<option value={size}>{size}×{size}</option>
			{/each}
		</select>
		<Button
			variant="ghost"
			size="icon-xs"
			class="rounded-full text-muted-foreground"
			onclick={() => stepGridSize(1)}
			disabled={editor.gridSize >= GRID_MAX}
			title="Increase grid size"
			aria-label="Increase grid size"
		>
			<Plus class="size-3.5" />
		</Button>
	</div>

	<div
		class="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-full border bg-background/90 p-1 shadow-sm backdrop-blur"
	>
		<Button
			variant="ghost"
			size="icon-xs"
			class="rounded-full text-muted-foreground"
			onclick={() => editor.rotateBy(-15)}
			disabled={editor.rotation <= -180}
			title="Rotate left 15°"
			aria-label="Rotate left 15 degrees"
		>
			<RotateCcw class="size-3.5" />
		</Button>
		<select
			class="h-6 min-w-14 cursor-pointer rounded-full bg-transparent px-1 font-mono text-[11px] tabular-nums text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
			value={editor.rotation}
			onchange={(event) =>
				editor.setRotation(Number((event.currentTarget as HTMLSelectElement).value))}
			title="Canvas rotation"
			aria-label="Canvas rotation"
		>
			{#each ROTATION_OPTIONS as angle (angle)}
				<option value={angle}>{angle}°</option>
			{/each}
		</select>
		<Button
			variant="ghost"
			size="icon-xs"
			class="rounded-full text-muted-foreground"
			onclick={() => editor.rotateBy(15)}
			disabled={editor.rotation >= 180}
			title="Rotate right 15°"
			aria-label="Rotate right 15 degrees"
		>
			<RotateCw class="size-3.5" />
		</Button>
		<Separator orientation="vertical" class="mx-1 h-4" />
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
	</div>
</section>

<svelte:window onkeydown={handleWindowKeydown} />
