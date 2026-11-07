import { normalizeHex, packColor, rgbToHex, unpackColor } from "./color.js";
import { cloneDoc, createDoc, createLayer, uid } from "./doc.js";
import { saveProjectFile } from "./file.js";
import { DEFAULT_PALETTE } from "./palette.js";
import type { Layer, PixelDoc, Point, ToolId, ViewportSize } from "./types.js";

const HISTORY_LIMIT = 80;
const MIN_SIZE = 1;
const MAX_SIZE = 256;
const MIN_ZOOM = 1;
const MAX_ZOOM = 64;

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));

function readStoredTheme(): "light" | "dark" {
	try {
		return localStorage.getItem("pixel-spell-theme") === "dark" ? "dark" : "light";
	} catch {
		return "light";
	}
}

export class EditorState {
	doc = $state<PixelDoc>(createDoc(32, 32));
	activeLayerId = $state<string>(this.doc.layers[0].id);
	activeFrame = $state(0);

	tool = $state<ToolId>("pencil");
	primaryColor = $state("#18181b");
	alpha = $state(255);
	palette = $state<string[]>([...DEFAULT_PALETTE]);

	brushSize = $state(1);
	mirrorX = $state(false);
	mirrorY = $state(false);
	shapeFilled = $state(false);
	fillTolerance = $state(0);
	fillContiguous = $state(true);
	sampleAllLayers = $state(true);

	showGrid = $state(true);
	zoom = $state<number | null>(null);
	viewport = $state<ViewportSize>({ w: 0, h: 0 });
	playing = $state(false);
	theme = $state<"light" | "dark">(readStoredTheme());

	cursor = $state<Point | null>(null);
	revision = $state(0);
	dirty = $state(false);
	name = $state("Untitled");

	undoCount = $state(0);
	redoCount = $state(0);

	#undo: PixelDoc[] = [];
	#redo: PixelDoc[] = [];

	get activeLayer(): Layer {
		return (
			this.doc.layers.find((layer) => layer.id === this.activeLayerId) ??
			this.doc.layers[this.doc.layers.length - 1]!
		);
	}

	get canUndo(): boolean {
		return this.undoCount > 0;
	}

	get canRedo(): boolean {
		return this.redoCount > 0;
	}

	get frameCount(): number {
		return this.doc.frames.length;
	}

	get currentColor(): number {
		return packColor(this.primaryColor, this.alpha);
	}

	get fitZoom(): number {
		const availableWidth = Math.max(0, this.viewport.w - 64);
		const availableHeight = Math.max(0, this.viewport.h - 112);
		const fit = Math.floor(
			Math.min(availableWidth / this.doc.width, availableHeight / this.doc.height),
		);
		return clamp(Number.isFinite(fit) ? fit : 1, MIN_ZOOM, MAX_ZOOM);
	}

	get effectiveZoom(): number {
		return this.zoom ?? this.fitZoom;
	}

	setTool(tool: ToolId): void {
		this.tool = tool;
	}

	setPrimaryColor(hex: string): void {
		const normalized = normalizeHex(hex);
		if (normalized) this.primaryColor = normalized;
	}

	setColorFromPacked(value: number): void {
		const { r, g, b, a } = unpackColor(value);
		if (a === 0) return;
		this.primaryColor = rgbToHex(r, g, b);
		this.alpha = a;
	}

	addPaletteColor(): void {
		if (this.palette.includes(this.primaryColor)) return;
		const next = [...this.palette, this.primaryColor];
		this.palette = next.slice(-64);
	}

	toggleTheme(): void {
		this.theme = this.theme === "dark" ? "light" : "dark";
	}

	zoomIn(): void {
		this.zoom = clamp(this.effectiveZoom + 1, MIN_ZOOM, MAX_ZOOM);
	}

	zoomOut(): void {
		this.zoom = clamp(this.effectiveZoom - 1, MIN_ZOOM, MAX_ZOOM);
	}

	fitToWindow(): void {
		this.zoom = null;
	}

	touch(): void {
		this.revision++;
	}

	pushHistory(): void {
		this.#undo.push(cloneDoc(this.doc));
		if (this.#undo.length > HISTORY_LIMIT) this.#undo.shift();
		this.#redo = [];
		this.undoCount = this.#undo.length;
		this.redoCount = 0;
		this.dirty = true;
	}

	undo(): void {
		const previous = this.#undo.pop();
		if (!previous) return;
		this.#redo.push(cloneDoc(this.doc));
		this.doc = previous;
		this.#afterHistoryRestore();
		this.undoCount = this.#undo.length;
		this.redoCount = this.#redo.length;
	}

	redo(): void {
		const next = this.#redo.pop();
		if (!next) return;
		this.#undo.push(cloneDoc(this.doc));
		this.doc = next;
		this.#afterHistoryRestore();
		this.undoCount = this.#undo.length;
		this.redoCount = this.#redo.length;
	}

	#afterHistoryRestore(): void {
		if (!this.doc.layers.some((layer) => layer.id === this.activeLayerId)) {
			this.activeLayerId = this.doc.layers[this.doc.layers.length - 1]!.id;
		}
		this.activeFrame = clamp(this.activeFrame, 0, this.doc.frames.length - 1);
		this.playing = false;
		this.revision++;
		this.dirty = true;
	}

	clearHistory(): void {
		this.#undo = [];
		this.#redo = [];
		this.undoCount = 0;
		this.redoCount = 0;
	}

	newDocument(width: number, height: number): void {
		const w = clamp(Math.round(width) || 32, MIN_SIZE, MAX_SIZE);
		const h = clamp(Math.round(height) || 32, MIN_SIZE, MAX_SIZE);
		this.doc = createDoc(w, h);
		this.activeLayerId = this.doc.layers[0].id;
		this.activeFrame = 0;
		this.zoom = null;
		this.playing = false;
		this.cursor = null;
		this.clearHistory();
		this.dirty = false;
		this.name = "Untitled";
		this.revision++;
	}

	loadProject(project: {
		doc: PixelDoc;
		palette?: string[];
		activeFrame?: number;
		activeLayerId?: string;
		name?: string;
	}): void {
		this.doc = project.doc;
		if (project.palette?.length) this.palette = [...project.palette];
		this.activeFrame = clamp(
			project.activeFrame ?? 0,
			0,
			this.doc.frames.length - 1,
		);
		this.activeLayerId = this.doc.layers.some(
			(layer) => layer.id === project.activeLayerId,
		)
			? project.activeLayerId!
			: this.doc.layers[this.doc.layers.length - 1]!.id;
		this.name = project.name?.trim() || "Untitled";
		this.zoom = null;
		this.playing = false;
		this.cursor = null;
		this.clearHistory();
		this.dirty = false;
		this.revision++;
	}

	markSaved(): void {
		this.dirty = false;
	}

	saveToFile(): void {
		saveProjectFile(
			this.doc,
			this.palette,
			this.name,
			this.activeFrame,
			this.activeLayerId,
		);
		this.markSaved();
	}

	selectLayer(id: string): void {
		if (this.doc.layers.some((layer) => layer.id === id)) {
			this.activeLayerId = id;
		}
	}

	toggleLayerVisibility(id: string): void {
		const layer = this.doc.layers.find((item) => item.id === id);
		if (!layer) return;
		layer.visible = !layer.visible;
		this.revision++;
	}

	toggleLayerLock(id: string): void {
		const layer = this.doc.layers.find((item) => item.id === id);
		if (!layer) return;
		layer.locked = !layer.locked;
	}

	renameLayer(id: string, name: string): void {
		const layer = this.doc.layers.find((item) => item.id === id);
		const trimmed = name.trim();
		if (!layer || !trimmed) return;
		layer.name = trimmed;
		this.dirty = true;
	}

	setLayerOpacity(id: string, opacity: number): void {
		const layer = this.doc.layers.find((item) => item.id === id);
		if (!layer) return;
		layer.opacity = clamp(opacity, 0, 1);
		this.revision++;
	}

	addLayer(): void {
		this.pushHistory();
		const layer = createLayer(
			`Layer ${this.doc.layers.length + 1}`,
			this.doc.width,
			this.doc.height,
			this.doc.frames.length,
		);
		this.doc.layers.push(layer);
		this.activeLayerId = layer.id;
		this.revision++;
	}

	duplicateLayer(): void {
		const source = this.activeLayer;
		if (!source) return;
		this.pushHistory();
		const copy: Layer = {
			id: uid("layer"),
			name: `${source.name} copy`,
			visible: source.visible,
			locked: false,
			opacity: source.opacity,
			cels: source.cels.map((cel) => new Uint32Array(cel)),
		};
		const index = this.doc.layers.findIndex((layer) => layer.id === source.id);
		this.doc.layers.splice(index + 1, 0, copy);
		this.activeLayerId = copy.id;
		this.revision++;
	}

	deleteLayer(): void {
		if (this.doc.layers.length <= 1) return;
		const index = this.doc.layers.findIndex(
			(layer) => layer.id === this.activeLayerId,
		);
		if (index < 0) return;
		this.pushHistory();
		this.doc.layers.splice(index, 1);
		this.activeLayerId =
			this.doc.layers[Math.min(index, this.doc.layers.length - 1)]!.id;
		this.revision++;
	}

	moveLayerUp(): void {
		const index = this.doc.layers.findIndex(
			(layer) => layer.id === this.activeLayerId,
		);
		if (index < 0 || index >= this.doc.layers.length - 1) return;
		this.pushHistory();
		const [layer] = this.doc.layers.splice(index, 1);
		this.doc.layers.splice(index + 1, 0, layer!);
		this.revision++;
	}

	moveLayerDown(): void {
		const index = this.doc.layers.findIndex(
			(layer) => layer.id === this.activeLayerId,
		);
		if (index <= 0) return;
		this.pushHistory();
		const [layer] = this.doc.layers.splice(index, 1);
		this.doc.layers.splice(index - 1, 0, layer!);
		this.revision++;
	}

	clearLayer(): void {
		const layer = this.activeLayer;
		if (!layer) return;
		this.pushHistory();
		layer.cels[this.activeFrame]?.fill(0);
		this.revision++;
	}

	clearFrame(): void {
		this.pushHistory();
		for (const layer of this.doc.layers) {
			layer.cels[this.activeFrame]?.fill(0);
		}
		this.revision++;
	}

	selectFrame(index: number): void {
		this.activeFrame = clamp(index, 0, this.doc.frames.length - 1);
	}

	nextFrame(): void {
		this.activeFrame = (this.activeFrame + 1) % this.doc.frames.length;
	}

	previousFrame(): void {
		this.activeFrame =
			(this.activeFrame - 1 + this.doc.frames.length) % this.doc.frames.length;
	}

	addFrame(): void {
		this.pushHistory();
		const index = this.activeFrame + 1;
		this.doc.frames.splice(index, 0, { id: uid("frame") });
		for (const layer of this.doc.layers) {
			layer.cels.splice(index, 0, new Uint32Array(this.doc.width * this.doc.height));
		}
		this.activeFrame = index;
		this.revision++;
	}

	duplicateFrame(): void {
		this.pushHistory();
		const index = this.activeFrame;
		this.doc.frames.splice(index + 1, 0, { id: uid("frame") });
		for (const layer of this.doc.layers) {
			const source = layer.cels[index] ?? new Uint32Array(this.doc.width * this.doc.height);
			layer.cels.splice(index + 1, 0, new Uint32Array(source));
		}
		this.activeFrame = index + 1;
		this.revision++;
	}

	deleteFrame(): void {
		if (this.doc.frames.length <= 1) return;
		this.pushHistory();
		const index = this.activeFrame;
		this.doc.frames.splice(index, 1);
		for (const layer of this.doc.layers) {
			layer.cels.splice(index, 1);
		}
		this.activeFrame = clamp(index, 0, this.doc.frames.length - 1);
		this.revision++;
	}

	setFps(value: number): void {
		if (!Number.isFinite(value)) return;
		this.doc.fps = clamp(Math.round(value), 1, 60);
	}

	togglePlayback(): void {
		this.playing = !this.playing;
	}
}

export const editor = new EditorState();
