import { isTransparent, normalizeHex, packColor, rgbToHex, unpackColor } from "./color.js";
import { cloneDoc, createDoc, createLayer, uid } from "./doc.js";
import { saveProjectFile, type LoadedProject } from "./file.js";
import { selectionBounds } from "./selection.js";
import {
	DEFAULT_PALETTE_ID,
	MAX_PALETTE_COLORS,
	createDefaultPalette,
	loadPaletteState,
	savePaletteState,
	type Palette,
} from "./palette.js";
import type {
	BackgroundKind,
	ColorSlot,
	GradientDither,
	GradientShape,
	Layer,
	MirrorAxis,
	MirrorKind,
	PixelDoc,
	Point,
	ProjectTab,
	ShapeKind,
	ToolId,
	ViewportSize,
} from "./types.js";

const HISTORY_LIMIT = 80;
const MIN_SIZE = 1;
const MAX_SIZE = 1024;
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
	panX: number;
	panY: number;
	selection: Uint8Array | null;
	undo: PixelDoc[];
	redo: PixelDoc[];
}

/** In-memory copy of selected pixels, independent of the OS clipboard. */
interface SelectionClipboard {
	originX: number;
	originY: number;
	width: number;
	height: number;
	pixels: Uint32Array;
	mask: Uint8Array;
}

/**
 * Pixels temporarily floating above a cel. They are not applied until the
 * floating selection is committed (deselected, replaced, or the move ends).
 */
export interface FloatingSelection {
	layerId: string;
	frame: number;
	originX: number;
	originY: number;
	width: number;
	height: number;
	pixels: Uint32Array;
	mask: Uint8Array;
	/** True once the pre-move document has been pushed to the undo stack. */
	historyPushed: boolean;
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
	palettes = $state<Palette[]>([createDefaultPalette()]);
	activePaletteId = $state<string>(DEFAULT_PALETTE_ID);

	brushSize = $state(1);
	sprayRadius = $state(6);
	sprayRate = $state(40);
	blurRadius = $state(4);
	blurPower = $state(50);
	jumbleRadius = $state(4);
	jumblePower = $state(100);
	mirrorX = $state(false);
	mirrorY = $state(false);
	mirrorDiagonalDown = $state(false);
	mirrorDiagonalUp = $state(false);
	mirrorXOffset = $state(0);
	mirrorYOffset = $state(0);
	mirrorDiagonalDownOffset = $state(0);
	mirrorDiagonalUpOffset = $state(0);
	lockAlpha = $state(false);
	pixelPerfect = $state(false);
	shapeFilled = $state(false);
	/** Shape drawn by the combined shape tool. */
	shapeKind = $state<ShapeKind>("rectangle");
	/** Shape drawn by the combined selection tool. */
	selectionShape = $state<ShapeKind>("rectangle");
	fillTolerance = $state(0);
	fillContiguous = $state(true);
	gradientTolerance = $state(0);
	gradientContiguous = $state(true);
	gradientShape = $state<GradientShape>("linear");
	gradientDither = $state<GradientDither>("bayer2");
	sampleAllLayers = $state(true);
	magicWandDiagonal = $state(false);

	/** Selected pixel mask for the active document, or null when nothing is selected. */
	selection = $state<Uint8Array | null>(null);
	selectionRevision = $state(0);
	hasClipboard = $state(false);
	/** Temporary preview content that has not been written into a cel yet. */
	floating = $state<FloatingSelection | null>(null);

	showGrid = $state(true);
	showPreview = $state(false);
	zoom = $state<number | null>(null);
	/** Canvas center offset from the stage center, in screen pixels. */
	panX = $state(0);
	panY = $state(0);
	viewport = $state<ViewportSize>({ w: 0, h: 0 });
	playing = $state(false);
	theme = $state<"light" | "dark">(readStoredTheme());

	cursor = $state<Point | null>(null);
	/** Last cursor position over the canvas, kept for the menu bar readout. */
	lastCursor = $state<Point | null>(null);
	revision = $state(0);
	dirty = $state(false);
	modified = $state(false);
	name = $state("Untitled");

	projects = $state<ProjectTab[]>([]);
	activeProjectId = $state("");

	undoCount = $state(0);
	redoCount = $state(0);
	/** Increments only when undo/redo restores a document. */
	historyActionRevision = $state(0);

	#undo: PixelDoc[] = [];
	#redo: PixelDoc[] = [];
	#states = new Map<string, ProjectSnapshot>();
	#clipboard: SelectionClipboard | null = null;

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
			panX: 0,
			panY: 0,
			selection: null,
			undo: [],
			redo: [],
		});

		const paletteState = loadPaletteState();
		this.palettes = paletteState.palettes;
		this.activePaletteId = paletteState.activeId;
	}

	get activeLayer(): Layer {
		return (
			this.doc.layers.find((layer) => layer.id === this.activeLayerId) ??
			this.doc.layers[this.doc.layers.length - 1]!
		);
	}

	get activePalette(): Palette {
		return (
			this.palettes.find((palette) => palette.id === this.activePaletteId) ??
			this.palettes[0]!
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

	get mirrorAxes(): MirrorAxis[] {
		const width = this.doc.width;
		const height = this.doc.height;
		const axes: MirrorAxis[] = [];

		// X axis mirrors across the horizontal axis; Y axis across the vertical axis.
		if (this.mirrorX) {
			axes.push({
				kind: "x",
				position: clamp(height / 2 + this.mirrorXOffset, 0, height),
			});
		}
		if (this.mirrorY) {
			axes.push({
				kind: "y",
				position: clamp(width / 2 + this.mirrorYOffset, 0, width),
			});
		}
		if (this.mirrorDiagonalDown) {
			axes.push({
				kind: "diagonal-down",
				position: clamp(
					(height - width) / 2 + this.mirrorDiagonalDownOffset,
					-width,
					height,
				),
			});
		}
		if (this.mirrorDiagonalUp) {
			axes.push({
				kind: "diagonal-up",
				position: clamp(
					(width + height) / 2 + this.mirrorDiagonalUpOffset,
					0,
					width + height,
				),
			});
		}

		return axes;
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

	setSelection(mask: Uint8Array | null, keepFloating = false): void {
		if (!keepFloating && this.floating) this.commitFloatingSelection();
		this.selection = mask;
		this.selectionRevision++;
	}

	clearSelection(): void {
		if (this.floating) this.commitFloatingSelection();
		if (!this.selection) return;
		this.selection = null;
		this.selectionRevision++;
	}

	selectAll(): void {
		const mask = new Uint8Array(this.doc.width * this.doc.height);
		mask.fill(1);
		this.setSelection(mask);
	}

	/** Builds a clipboard-style snapshot of the current selection. */
	#captureSelection(): SelectionClipboard | null {
		const mask = this.selection;
		if (!mask) return null;

		const floating = this.floating;
		if (
			floating &&
			floating.layerId === this.activeLayer?.id &&
			floating.frame === this.activeFrame
		) {
			return {
				originX: floating.originX,
				originY: floating.originY,
				width: floating.width,
				height: floating.height,
				pixels: new Uint32Array(floating.pixels),
				mask: new Uint8Array(floating.mask),
			};
		}

		const cel = this.activeLayer?.cels[this.activeFrame];
		if (!cel) return null;

		const bounds = selectionBounds(mask, this.doc.width, this.doc.height);
		if (!bounds) return null;

		const pixels = new Uint32Array(bounds.width * bounds.height);
		const clipMask = new Uint8Array(bounds.width * bounds.height);

		for (let y = 0; y < bounds.height; y++) {
			const sourceRow = (bounds.y + y) * this.doc.width + bounds.x;
			const targetRow = y * bounds.width;
			for (let x = 0; x < bounds.width; x++) {
				const sourceIndex = sourceRow + x;
				if (!mask[sourceIndex]) continue;
				clipMask[targetRow + x] = 1;

				const value = cel[sourceIndex]!;
				// Transparent pixels are ignored so they can never erase a
				// destination pixel when the content is applied.
				if (!isTransparent(value)) pixels[targetRow + x] = value;
			}
		}

		return {
			originX: bounds.x,
			originY: bounds.y,
			width: bounds.width,
			height: bounds.height,
			pixels,
			mask: clipMask,
		};
	}

	/** Copies the selected pixels of the active cel into the internal clipboard. */
	copySelection(): boolean {
		const data = this.#captureSelection();
		if (!data) return false;
		this.#clipboard = data;
		this.hasClipboard = true;
		return true;
	}

	/**
	 * Creates floating content from the current selection without changing the
	 * cel. The caller moves it and commits it when the drag ends.
	 */
	createFloatingSelection(): FloatingSelection | null {
		const layer = this.activeLayer;
		const cel = layer?.cels[this.activeFrame];
		if (!layer || !cel) return null;

		const data = this.#captureSelection();
		if (!data) return null;

		return {
			layerId: layer.id,
			frame: this.activeFrame,
			originX: data.originX,
			originY: data.originY,
			width: data.width,
			height: data.height,
			pixels: data.pixels,
			mask: data.mask,
			historyPushed: false,
		};
	}

	/**
	 * Starts moving an existing selection: pushes one history entry, removes the
	 * source pixels, and places the content in the floating layer.
	 */
	beginFloatingMove(
		floating: FloatingSelection,
		targetX: number,
		targetY: number,
	): boolean {
		const layer = this.doc.layers.find((item) => item.id === floating.layerId);
		const cel = layer?.cels[floating.frame];
		if (!cel) return false;

		this.pushHistory();

		const width = this.doc.width;
		const height = this.doc.height;
		const sourceX = floating.originX;
		const sourceY = floating.originY;

		for (let y = 0; y < floating.height; y++) {
			const pixelY = sourceY + y;
			if (pixelY < 0 || pixelY >= height) continue;
			for (let x = 0; x < floating.width; x++) {
				if (!floating.mask[y * floating.width + x]) continue;
				const pixelX = sourceX + x;
				if (pixelX < 0 || pixelX >= width) continue;
				cel[pixelY * width + pixelX] = 0;
			}
		}

		floating.historyPushed = true;
		floating.originX = targetX;
		floating.originY = targetY;
		this.floating = floating;
		this.#syncFloatingMask();
		this.revision++;
		return true;
	}

	/** Moves the current floating content without applying it. */
	moveFloatingSelection(x: number, y: number): void {
		const floating = this.floating;
		if (!floating) return;
		floating.originX = x;
		floating.originY = y;
		this.#syncFloatingMask();
	}

	#syncFloatingMask(): void {
		const floating = this.floating;
		if (!floating) return;

		const width = this.doc.width;
		const height = this.doc.height;
		const mask = new Uint8Array(width * height);

		for (let y = 0; y < floating.height; y++) {
			const destY = floating.originY + y;
			if (destY < 0 || destY >= height) continue;
			for (let x = 0; x < floating.width; x++) {
				const destX = floating.originX + x;
				if (destX < 0 || destX >= width) continue;
				if (floating.mask[y * floating.width + x]) {
					mask[destY * width + destX] = 1;
				}
			}
		}

		this.selection = mask;
		this.selectionRevision++;
	}

	/**
	 * Applies floating content to its original layer and frame. Transparent
	 * floating pixels leave the destination untouched.
	 */
	commitFloatingSelection(): boolean {
		const floating = this.floating;
		if (!floating) return false;

		// Detach first so the history push below cannot re-enter this method.
		this.floating = null;

		const layer = this.doc.layers.find((item) => item.id === floating.layerId);
		const cel = layer?.cels[floating.frame];
		if (!cel) {
			this.selectionRevision++;
			return false;
		}

		const width = this.doc.width;
		const height = this.doc.height;
		let changed = false;

		for (let y = 0; y < floating.height && !changed; y++) {
			const destY = floating.originY + y;
			if (destY < 0 || destY >= height) continue;
			for (let x = 0; x < floating.width; x++) {
				const destX = floating.originX + x;
				if (destX < 0 || destX >= width) continue;
				const value = floating.pixels[y * floating.width + x]!;
				if (isTransparent(value)) continue;
				if (cel[destY * width + destX] !== value) {
					changed = true;
					break;
				}
			}
		}

		if (changed) {
			if (!floating.historyPushed) this.pushHistory();
			for (let y = 0; y < floating.height; y++) {
				const destY = floating.originY + y;
				if (destY < 0 || destY >= height) continue;
				for (let x = 0; x < floating.width; x++) {
					const destX = floating.originX + x;
					if (destX < 0 || destX >= width) continue;
					const value = floating.pixels[y * floating.width + x]!;
					if (isTransparent(value)) continue;
					cel[destY * width + destX] = value;
				}
			}
			this.touch();
		}

		this.selectionRevision++;
		return changed;
	}

	/**
	 * Pastes the internal clipboard as floating content. It is not written into
	 * the cel until the user deselects or starts another selection.
	 */
	pasteSelection(): boolean {
		const clipboard = this.#clipboard;
		if (!clipboard) return false;

		const layer = this.activeLayer;
		if (!layer || layer.locked || !layer.visible) return false;
		if (!layer.cels[this.activeFrame]) return false;

		if (this.floating) this.commitFloatingSelection();

		const targetBounds = selectionBounds(
			this.selection,
			this.doc.width,
			this.doc.height,
		);
		const targetX = targetBounds ? targetBounds.x : clipboard.originX;
		const targetY = targetBounds ? targetBounds.y : clipboard.originY;

		this.floating = {
			layerId: layer.id,
			frame: this.activeFrame,
			originX: targetX,
			originY: targetY,
			width: clipboard.width,
			height: clipboard.height,
			pixels: new Uint32Array(clipboard.pixels),
			mask: new Uint8Array(clipboard.mask),
			historyPushed: false,
		};
		this.#syncFloatingMask();
		return true;
	}

	toggleMirror(kind: MirrorKind): void {
		if (kind === "x") {
			this.mirrorX = !this.mirrorX;
			if (!this.mirrorX) this.mirrorXOffset = 0;
		} else if (kind === "y") {
			this.mirrorY = !this.mirrorY;
			if (!this.mirrorY) this.mirrorYOffset = 0;
		} else if (kind === "diagonal-down") {
			this.mirrorDiagonalDown = !this.mirrorDiagonalDown;
			if (!this.mirrorDiagonalDown) this.mirrorDiagonalDownOffset = 0;
		} else {
			this.mirrorDiagonalUp = !this.mirrorDiagonalUp;
			if (!this.mirrorDiagonalUp) this.mirrorDiagonalUpOffset = 0;
		}
		this.revision++;
	}

	setMirrorPosition(kind: MirrorKind, position: number): void {
		const width = this.doc.width;
		const height = this.doc.height;

		if (kind === "x") {
			this.mirrorXOffset = clamp(position, 0, height) - height / 2;
		} else if (kind === "y") {
			this.mirrorYOffset = clamp(position, 0, width) - width / 2;
		} else if (kind === "diagonal-down") {
			this.mirrorDiagonalDownOffset =
				clamp(position, -width, height) - (height - width) / 2;
		} else {
			this.mirrorDiagonalUpOffset =
				clamp(position, 0, width + height) - (width + height) / 2;
		}

		this.revision++;
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

	#persistPalettes(): void {
		savePaletteState(this.palettes, this.activePaletteId);
	}

	#nextPaletteName(): string {
		const names = new Set(this.palettes.map((palette) => palette.name.toLowerCase()));
		let index = 1;
		while (names.has(`palette ${index}`)) index++;
		return `Palette ${index}`;
	}

	selectPalette(id: string): void {
		if (!this.palettes.some((palette) => palette.id === id)) return;
		if (this.activePaletteId === id) return;
		this.activePaletteId = id;
		this.#persistPalettes();
	}

	createPalette(): string {
		const palette: Palette = {
			id: uid("palette"),
			name: this.#nextPaletteName(),
			colors: [],
		};
		this.palettes.push(palette);
		this.activePaletteId = palette.id;
		this.#persistPalettes();
		return palette.id;
	}

	deletePalette(id: string): void {
		const index = this.palettes.findIndex((palette) => palette.id === id);
		if (index < 0) return;
		const palette = this.palettes[index]!;
		if (palette.builtin) return;

		this.palettes.splice(index, 1);
		if (this.activePaletteId === id) {
			this.activePaletteId = DEFAULT_PALETTE_ID;
		}
		this.#persistPalettes();
	}

	renamePalette(id: string, name: string): void {
		const palette = this.palettes.find((item) => item.id === id);
		if (!palette || palette.builtin) return;
		const trimmed = name.trim();
		if (!trimmed) return;
		palette.name = trimmed.slice(0, 40);
		this.#persistPalettes();
	}

	addPaletteColor(slot: ColorSlot = this.activeColorSlot): void {
		const palette = this.activePalette;
		if (palette.builtin) return;

		const color = slot === "secondary" ? this.secondaryColor : this.primaryColor;
		if (palette.colors.includes(color)) return;
		if (palette.colors.length >= MAX_PALETTE_COLORS) return;

		palette.colors.push(color);
		this.#persistPalettes();
	}

	removePaletteColor(index: number): void {
		const palette = this.activePalette;
		if (palette.builtin) return;
		if (index < 0 || index >= palette.colors.length) return;
		palette.colors.splice(index, 1);
		this.#persistPalettes();
	}

	removeLastPaletteColor(): void {
		const palette = this.activePalette;
		if (palette.builtin || palette.colors.length === 0) return;
		palette.colors.pop();
		this.#persistPalettes();
	}

	/** Adds an imported palette, makes it active, and returns its id. */
	importPalette(name: string, colors: string[]): string | null {
		const unique: string[] = [];
		for (const color of colors) {
			const normalized = normalizeHex(color);
			if (!normalized || unique.includes(normalized)) continue;
			unique.push(normalized);
			if (unique.length >= MAX_PALETTE_COLORS) break;
		}
		if (unique.length === 0) return null;

		const baseName = (name.trim() || "Imported palette").slice(0, 40);
		const usedNames = new Set(this.palettes.map((palette) => palette.name.toLowerCase()));
		let paletteName = baseName;
		let suffixIndex = 2;
		while (usedNames.has(paletteName.toLowerCase())) {
			const suffix = ` (${suffixIndex})`;
			paletteName = `${baseName.slice(0, Math.max(1, 40 - suffix.length))}${suffix}`;
			suffixIndex++;
		}

		const palette: Palette = {
			id: uid("palette"),
			name: paletteName,
			colors: unique,
		};
		this.palettes.push(palette);
		this.activePaletteId = palette.id;
		this.#persistPalettes();
		return palette.id;
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
		this.panX = 0;
		this.panY = 0;
	}

	touch(): void {
		this.revision++;
		this.dirty = true;
		this.modified = true;
	}

	pushHistory(): void {
		// Any new edit implicitly applies content that is still floating.
		if (this.floating) this.commitFloatingSelection();
		this.#undo.push(cloneDoc(this.doc));
		if (this.#undo.length > HISTORY_LIMIT) this.#undo.shift();
		this.#redo = [];
		this.undoCount = this.#undo.length;
		this.redoCount = 0;
		this.dirty = true;
		this.modified = true;
	}

	undo(): void {
		if (this.floating) this.commitFloatingSelection();
		const previous = this.#undo.pop();
		if (!previous) return;
		this.#redo.push(cloneDoc(this.doc));
		this.doc = previous;
		this.#afterHistoryRestore();
		this.undoCount = this.#undo.length;
		this.redoCount = this.#redo.length;
	}

	redo(): void {
		if (this.floating) this.commitFloatingSelection();
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
		this.floating = null;
		// The selection may no longer match the restored pixels.
		this.selection = null;
		this.selectionRevision++;
		this.historyActionRevision++;
		this.revision++;
		this.dirty = true;
		this.modified = true;
	}

	#syncActiveProject(): void {
		if (this.floating) this.commitFloatingSelection();

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
		snapshot.panX = this.panX;
		snapshot.panY = this.panY;
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
		this.panX = snapshot.panX;
		this.panY = snapshot.panY;
		this.floating = null;
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

	newProject(
		width: number,
		height: number,
		options: { name?: string; background?: BackgroundKind } = {},
	): void {
		const w = clamp(Math.round(width) || 32, MIN_SIZE, MAX_SIZE);
		const h = clamp(Math.round(height) || 32, MIN_SIZE, MAX_SIZE);
		const doc = createDoc(w, h, options.background ?? "transparent");
		const requestedName = options.name?.trim().slice(0, 60);
		const name = requestedName || this.#nextUntitledName();

		this.#syncActiveProject();
		const id = uid("project");
		this.#states.set(id, {
			doc,
			activeLayerId: doc.layers[0].id,
			activeFrame: 0,
			zoom: null,
			panX: 0,
			panY: 0,
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
			panX: 0,
			panY: 0,
			selection: null,
			undo: [],
			redo: [],
		});
		this.projects.push({ id, name, dirty: false, modified: true });
		this.#activateProject(id);
	}

	/** Creates a new, unsaved project tab from an imported image. */
	importImageProject(image: {
		name: string;
		width: number;
		height: number;
		pixels: Uint32Array;
	}): void {
		const width = clamp(Math.round(image.width) || 1, MIN_SIZE, MAX_SIZE);
		const height = clamp(Math.round(image.height) || 1, MIN_SIZE, MAX_SIZE);
		const pixels = new Uint32Array(width * height);
		pixels.set(image.pixels.subarray(0, Math.min(image.pixels.length, pixels.length)));

		const doc: PixelDoc = {
			width,
			height,
			fps: 12,
			frames: [{ id: uid("frame") }],
			layers: [
				{
					id: uid("layer"),
					name: "Imported image",
					visible: true,
					locked: false,
					opacity: 1,
					cels: [pixels],
				},
			],
		};

		const requestedName = image.name.trim().slice(0, 60);
		const name = requestedName || this.#nextUntitledName();

		this.#syncActiveProject();
		const id = uid("project");
		this.#states.set(id, {
			doc,
			activeLayerId: doc.layers[0]!.id,
			activeFrame: 0,
			zoom: null,
			panX: 0,
			panY: 0,
			selection: null,
			undo: [],
			redo: [],
		});
		this.projects.push({ id, name, dirty: true, modified: true });
		this.#activateProject(id);
	}

	markSaved(): void {
		this.dirty = false;
		this.modified = true;
		this.#syncActiveProject();
	}

	saveToFile(): void {
		if (this.floating) this.commitFloatingSelection();
		saveProjectFile(
			this.doc,
			this.activePalette.colors,
			this.name,
			this.activeFrame,
			this.activeLayerId,
		);
		this.markSaved();
	}

	selectLayer(id: string): void {
		if (!this.doc.layers.some((layer) => layer.id === id)) return;
		if (id === this.activeLayerId) return;
		if (this.floating) this.commitFloatingSelection();
		this.activeLayerId = id;
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

	deleteSelection(): void {
		if (this.floating) {
			// Deleting a floating selection discards its unapplied content.
			this.floating = null;
			this.selection = null;
			this.selectionRevision++;
			this.revision++;
			return;
		}

		const mask = this.selection;
		if (!mask) return;

		const layer = this.activeLayer;
		if (!layer || layer.locked || !layer.visible) return;
		const cel = layer.cels[this.activeFrame];
		if (!cel) return;

		let changed = false;
		for (let i = 0; i < cel.length; i++) {
			if (mask[i] && cel[i] !== 0) {
				changed = true;
				break;
			}
		}
		if (!changed) return;

		this.pushHistory();
		for (let i = 0; i < cel.length; i++) {
			if (mask[i]) cel[i] = 0;
		}
		this.touch();
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
		const next = clamp(index, 0, this.doc.frames.length - 1);
		if (next === this.activeFrame) return;
		if (this.floating) this.commitFloatingSelection();
		this.activeFrame = next;
	}

	nextFrame(): void {
		this.selectFrame((this.activeFrame + 1) % this.doc.frames.length);
	}

	previousFrame(): void {
		this.selectFrame(
			(this.activeFrame - 1 + this.doc.frames.length) % this.doc.frames.length,
		);
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
