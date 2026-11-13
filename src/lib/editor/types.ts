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
	| "gradient"
	| "eyedropper"
	| "blur"
	| "jumble";

/** Raster shapes available to the shape and shape-selection tools. */
export type ShapeKind = "rectangle" | "ellipse" | "star" | "heart";

/** Gradient direction shapes. */
export type GradientShape = "linear" | "radial";

/** Bayer matrices available to the gradient tool. */
export type GradientDither = "none" | "bayer2" | "bayer4" | "bayer8";

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

/** Rotational symmetry that duplicates each painted point around a center. */
export interface RadialSymmetry {
	/** Number of rotational copies, including the original point (2–16). */
	count: number;
	/** Rotation origin in document pixel coordinates. */
	centerX: number;
	centerY: number;
}

export interface Frame {
	id: string;
	/** Custom display duration in milliseconds; missing uses the document fps. */
	duration?: number;
	/** Optional tag. Contiguous frames with the same tag form a tag range. */
	tag?: string;
}

/** Reference layers are visible in the viewport but are never exported. */
export type LayerRole = "reference";

export interface Layer {
	id: string;
	name: string;
	visible: boolean;
	locked: boolean;
	/** 0..1 */
	opacity: number;
	/** One pixel buffer per animation frame. */
	cels: Uint32Array[];
	/** Missing means a normal paint layer. */
	role?: LayerRole;
}

/**
 * An image on the project-level reference board. Unlike a reference layer,
 * this is independent of layers and frames and can sit outside the canvas.
 */
export interface ReferenceImage {
	id: string;
	name: string;
	/** Original compressed source bytes (PNG/JPEG/WebP/SVG/…). */
	bytes: Uint8Array;
	mime: string;
	/** Natural source dimensions. */
	imageWidth: number;
	imageHeight: number;
	/** Display bounds in document pixels. */
	x: number;
	y: number;
	width: number;
	height: number;
	/** Rotation in degrees around the image center. */
	rotation: number;
	/** 0..1 */
	opacity: number;
	visible: boolean;
	locked: boolean;
}

export interface PixelDoc {
	width: number;
	height: number;
	fps: number;
	frames: Frame[];
	/** Ordered bottom-to-top. */
	layers: Layer[];
	/** Project-level reference board images. */
	references: ReferenceImage[];
	/** Inclusive playback/export range; missing means the whole animation. */
	loopStart?: number;
	loopEnd?: number;
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
