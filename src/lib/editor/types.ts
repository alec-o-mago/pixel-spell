export type ToolId =
	| "pencil"
	| "eraser"
	| "line"
	| "rectangle"
	| "ellipse"
	| "fill"
	| "eyedropper";

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
