export type ToolId =
	| "pan"
	| "zoom"
	| "magic-wand"
	| "shape-select"
	| "lasso"
	| "select-color"
	| "pencil"
	| "spray"
	| "eraser"
	| "line"
	| "curve"
	| "shape"
	| "fill"
	| "eyedropper"
	| "blur"
	| "jumble";

/** Raster shapes available to the shape and shape-selection tools. */
export type ShapeKind = "rectangle" | "ellipse" | "star" | "heart";

/** Initial canvas fill chosen when a project is created. */
export type BackgroundKind = "transparent" | "white" | "black";

/** Which mouse button a color is assigned to. */
export type ColorSlot = "primary" | "secondary";

export type MirrorKind = "x" | "y" | "diagonal-down" | "diagonal-up";

export interface MirrorAxis {
	kind: MirrorKind;
	/** Axis position in canvas boundary coordinates. */
	position: number;
}

export interface Frame {
	id: string;
}

export interface Layer {
	id: string;
	name: string;
	visible: boolean;
	locked: boolean;
	/** 0..1 */
	opacity: number;
	/** One pixel buffer per animation frame. */
	cels: Uint32Array[];
}

export interface PixelDoc {
	width: number;
	height: number;
	fps: number;
	frames: Frame[];
	/** Ordered bottom-to-top. */
	layers: Layer[];
}

export interface ProjectTab {
	id: string;
	name: string;
	dirty: boolean;
	modified: boolean;
}

export interface Point {
	x: number;
	y: number;
}

export interface ViewportSize {
	w: number;
	h: number;
}
