import { normalizeHex, packColor, rgbToHex, unpackColor } from "./color.js";
import { cloneDoc, createDoc, createLayer, uid } from "./doc.js";
import { saveProjectFile, type LoadedProject } from "./file.js";
import { DEFAULT_PALETTE } from "./palette.js";
import type {
	ColorSlot,
	Layer,
	PixelDoc,
	Point,
	ProjectTab,
	ToolId,
	ViewportSize,
} from "./types.js";

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

interface ProjectSnapshot {
	doc: PixelDoc;
	activeLayerId: string;
	activeFrame: number;
	zoom: number | null;
	selection: Uint8Array | null;
	undo: PixelDoc[];
	redo: PixelDoc[];
}

export class EditorState {
	doc = $state<PixelDoc>(createDoc(32, 32));
	activeLayerId = $state<string>(this.doc.layers[0].id);
	activeFrame = $state(0);

	tool = $state<ToolId>("pencil");
	primaryColor = $state("#18181b");
	alpha = $state(255);
	secondaryColor = $state("#ffffff");
	secondaryAlpha = $state(255);
	/** Which color slot the color panel is currently editing. */
	activeColorSlot = $state<ColorSlot>("primary");
	palette = $state<string[]>([...DEFAULT_PALETTE]);

	brushSize = $state(1);
	mirrorX = $state(false);
	mirrorY = $state(false);
	shapeFilled = $state(false);
	fillTolerance = $state(0);
	fillContiguous = $state(true);
	sampleAllLayers = $state(true);
	magicWandDiagonal = $state(false);

	/** Selected pixel mask for the active document, or null when nothing is selected. */
	selection = $state<Uint8Array | null>(null);
	selectionRevision = $state(0);

	showGrid = $state(true);
	zoom = $state<number | null>(null);
	viewport = $state<ViewportSize>({ w: 0, h: 0 });
	playing = $state(false);
	theme = $state<"light" | "dark">(readStoredTheme());

	cursor = $state<Point | null>(null);
	revision = $state(0);
	dirty = $state(false);
	modified = $state(false);
	name = $state("Untitled");

	projects = $state<ProjectTab[]>([]);
	activeProjectId = $state("");

	undoCount = $state(0);
	redoCount = $state(0);

	#undo: PixelDoc[] = [];
	#redo: PixelDoc[] = [];
	#states = new Map<string, ProjectSnapshot>();

	constructor() {
		const id = uid("project");
		this.projects = [
			{
				id,
				name: this.name,
				dirty: this.dirty,
				modified: this.modified,
			},
		];
		this.activeProjectId = id;
		this.#states.set(id, {
			doc: this.doc,
			activeLayerId: this.activeLayerId,
			activeFrame: this.activeFrame,
			zoom: this.zoom,
			selection: null,
			undo: [],
			redo: [],
		});
	}

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

	get hasSelection(): boolean {
		return this.selection !== null;
	}

	get currentColor(): number {
		return packColor(this.primaryColor, this.alpha);
	}

	get secondaryCurrentColor(): number {
		return packColor(this.secondaryColor, this.secondaryAlpha);
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

	setSelection(mask: Uint8Array | null): void {
		this.selection = mask;
		this.selectionRevision++;
	}

	clearSelection(): void {
		if (!this.selection) return;
		this.selection = null;
		this.selectionRevision++;
	}

	setPrimaryColor(hex: string): void {
		this.setColor("primary", hex);
	}

	setSecondaryColor(hex: string): void {
		this.setColor("secondary", hex);
	}

	setColor(slot: ColorSlot, hex: string): void {
		const normalized = normalizeHex(hex);
		if (!normalized) return;
		if (slot === "secondary") this.secondaryColor = normalized;
		else this.primaryColor = normalized;
	}

	setColorAlpha(slot: ColorSlot, alpha: number): void {
		const value = clamp(Math.round(alpha), 0, 255);
		if (slot === "secondary") this.secondaryAlpha = value;
		else this.alpha = value;
	}

	setColorFromPacked(value: number, slot: ColorSlot = "primary"): void {
		const { r, g, b, a } = unpackColor(value);
		if (a === 0) return;
		this.setColor(slot, rgbToHex(r, g, b));
		this.setColorAlpha(slot, a);
		this.activeColorSlot = slot;
	}

	swapColors(): void {
		const primaryColor = this.primaryColor;
		const primaryAlpha = this.alpha;
		this.primaryColor = this.secondaryColor;
		this.alpha = this.secondaryAlpha;
		this.secondaryColor = primaryColor;
		this.secondaryAlpha = primaryAlpha;
	}

	addPaletteColor(slot: ColorSlot = this.activeColorSlot): void {
		const color = slot === "secondary" ? this.secondaryColor : this.primaryColor;
		if (this.palette.includes(color)) return;
		const next = [...this.palette, color];
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
		this.dirty = true;
		this.modified = true;
	}

	pushHistory(): void {
		this.#undo.push(cloneDoc(this.doc));
		if (this.#undo.length > HISTORY_LIMIT) this.#undo.shift();
		this.#redo = [];
		this.undoCount = this.#undo.length;
		this.redoCount = 0;
		this.dirty = true;
		this.modified = true;
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
		// The selection may no longer match the restored pixels.
		this.selection = null;
		this.selectionRevision++;
		this.revision++;
		this.dirty = true;
		this.modified = true;
	}

	#syncActiveProject(): void {
		const tab = this.projects.find((project) => project.id === this.activeProjectId);
		const snapshot = this.#states.get(this.activeProjectId);
		if (!tab || !snapshot) return;

		tab.name = this.name;
		tab.dirty = this.dirty;
		tab.modified = this.modified;
		snapshot.doc = this.doc;
		snapshot.activeLayerId = this.activeLayerId;
		snapshot.activeFrame = this.activeFrame;
		snapshot.zoom = this.zoom;
		snapshot.selection = this.selection;
		snapshot.undo = this.#undo;
		snapshot.redo = this.#redo;
	}

	#activateProject(id: string): void {
		const tab = this.projects.find((project) => project.id === id);
		const snapshot = this.#states.get(id);
		if (!tab || !snapshot) return;

		this.activeProjectId = id;
		this.doc = snapshot.doc;
		this.activeLayerId = snapshot.activeLayerId;
		this.activeFrame = snapshot.activeFrame;
		this.zoom = snapshot.zoom;
		this.selection = snapshot.selection;
		this.selectionRevision++;
		this.name = tab.name;
		this.dirty = tab.dirty;
		this.modified = tab.modified;
		this.#undo = snapshot.undo;
		this.#redo = snapshot.redo;
		this.undoCount = snapshot.undo.length;
		this.redoCount = snapshot.redo.length;
		this.cursor = null;
		this.playing = false;
		this.revision++;
	}

	#nextUntitledName(): string {
		const names = new Set(
			this.projects.map((project) =>
				project.id === this.activeProjectId ? this.name : project.name,
			),
		);
		if (!names.has("Untitled")) return "Untitled";
		let index = 2;
		while (names.has(`Untitled ${index}`)) index++;
		return `Untitled ${index}`;
	}

	isProjectDirty(id: string): boolean {
		if (id === this.activeProjectId) return this.dirty;
		return this.projects.find((project) => project.id === id)?.dirty ?? false;
	}

	isProjectModified(id: string): boolean {
		if (id === this.activeProjectId) return this.modified;
		return this.projects.find((project) => project.id === id)?.modified ?? false;
	}

	projectName(id: string): string {
		if (id === this.activeProjectId) return this.name;
		return this.projects.find((project) => project.id === id)?.name ?? "Untitled";
	}

	selectProject(id: string): void {
		if (id === this.activeProjectId) return;
		if (!this.projects.some((project) => project.id === id)) return;
		this.#syncActiveProject();
		this.#activateProject(id);
	}

	closeProject(id: string): void {
		const index = this.projects.findIndex((project) => project.id === id);
		if (index < 0) return;
		if (this.projects.length === 1 && !this.isProjectModified(id)) return;

		const wasActive = id === this.activeProjectId;
		this.projects.splice(index, 1);
		this.#states.delete(id);

		if (this.projects.length === 0) {
			this.newProject(32, 32);
			return;
		}

		if (wasActive) {
			const next = this.projects[Math.min(index, this.projects.length - 1)]!;
			this.#activateProject(next.id);
		} else {
			this.revision++;
		}
	}

	newProject(width: number, height: number): void {
		const w = clamp(Math.round(width) || 32, MIN_SIZE, MAX_SIZE);
		const h = clamp(Math.round(height) || 32, MIN_SIZE, MAX_SIZE);
		const doc = createDoc(w, h);
		const name = this.#nextUntitledName();

		this.#syncActiveProject();
		const id = uid("project");
		this.#states.set(id, {
			doc,
			activeLayerId: doc.layers[0].id,
			activeFrame: 0,
			zoom: null,
			selection: null,
			undo: [],
			redo: [],
		});
		this.projects.push({ id, name, dirty: false, modified: false });
		this.#activateProject(id);
	}

	openProject(project: LoadedProject): void {
		const doc = project.doc;
		const activeLayerId = doc.layers.some((layer) => layer.id === project.activeLayerId)
			? project.activeLayerId
			: doc.layers[doc.layers.length - 1]!.id;
		const activeFrame = clamp(project.activeFrame ?? 0, 0, doc.frames.length - 1);
		const name = project.name?.trim() || this.#nextUntitledName();

		this.#syncActiveProject();
		const id = uid("project");
		this.#states.set(id, {
			doc,
			activeLayerId,
			activeFrame,
			zoom: null,
			selection: null,
			undo: [],
			redo: [],
		});
		this.projects.push({ id, name, dirty: false, modified: true });
		if (project.palette?.length) this.palette = [...project.palette];
		this.#activateProject(id);
	}

	markSaved(): void {
		this.dirty = false;
		this.modified = true;
		this.#syncActiveProject();
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
		this.dirty = true;
		this.modified = true;
		this.revision++;
	}

	toggleLayerLock(id: string): void {
		const layer = this.doc.layers.find((item) => item.id === id);
		if (!layer) return;
		layer.locked = !layer.locked;
		this.dirty = true;
		this.modified = true;
	}

	renameLayer(id: string, name: string): void {
		const layer = this.doc.layers.find((item) => item.id === id);
		const trimmed = name.trim();
		if (!layer || !trimmed) return;
		layer.name = trimmed;
		this.dirty = true;
		this.modified = true;
	}

	setLayerOpacity(id: string, opacity: number): void {
		const layer = this.doc.layers.find((item) => item.id === id);
		if (!layer) return;
		layer.opacity = clamp(opacity, 0, 1);
		this.dirty = true;
		this.modified = true;
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
		const cel = layer.cels[this.activeFrame];
		if (cel) this.#clearCel(cel);
		this.revision++;
	}

	clearFrame(): void {
		this.pushHistory();
		for (const layer of this.doc.layers) {
			const cel = layer.cels[this.activeFrame];
			if (cel) this.#clearCel(cel);
		}
		this.revision++;
	}

	#clearCel(cel: Uint32Array): void {
		const mask = this.selection;
		if (!mask) {
			cel.fill(0);
			return;
		}
		for (let i = 0; i < cel.length; i++) {
			if (mask[i]) cel[i] = 0;
		}
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
			const source =
				layer.cels[index] ?? new Uint32Array(this.doc.width * this.doc.height);
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
		this.dirty = true;
		this.modified = true;
	}

	togglePlayback(): void {
		this.playing = !this.playing;
	}
}

export const editor = new EditorState();
