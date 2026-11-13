/** Converts packed RGBA pixels into ImageData ready for `putImageData`. */
export function pixelsToImageData(
	pixels: Uint32Array,
	width: number,
	height: number,
): ImageData {
	const image = new ImageData(width, height);
	new Uint32Array(image.data.buffer).set(pixels.subarray(0, width * height));
	return image;
}

interface ScratchSource {
	canvas: HTMLCanvasElement;
	context: CanvasRenderingContext2D;
	image: ImageData;
	width: number;
	height: number;
}

/**
 * Reused 1:1 source canvas. Every render path is synchronous, so a single
 * scratch surface avoids allocating a canvas + ImageData on every pointer move.
 */
let scratch: ScratchSource | null = null;

function scratchSource(width: number, height: number): ScratchSource | null {
	if (width <= 0 || height <= 0) return null;
	if (!scratch || scratch.width !== width || scratch.height !== height) {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context) return null;
		scratch = {
			canvas,
			context,
			image: new ImageData(width, height),
			width,
			height,
		};
	}
	return scratch;
}

function writeScratchPixels(
	source: ScratchSource,
	pixels: Uint32Array,
	width: number,
	height: number,
): void {
	new Uint32Array(source.image.data.buffer).set(
		pixels.subarray(0, width * height),
	);
	source.context.putImageData(source.image, 0, 0);
}

/** Draws packed pixels into a canvas 1:1, reusing the scratch ImageData. */
export function drawPixels(
	canvas: HTMLCanvasElement,
	pixels: Uint32Array,
	width: number,
	height: number,
): void {
	if (canvas.width !== width) canvas.width = width;
	if (canvas.height !== height) canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) return;
	const source = scratchSource(width, height);
	if (!source) return;
	new Uint32Array(source.image.data.buffer).set(
		pixels.subarray(0, width * height),
	);
	// putImageData replaces every pixel, so no clear is needed.
	context.putImageData(source.image, 0, 0);
}

function drawSource(
	context: CanvasRenderingContext2D,
	pixels: Uint32Array,
	width: number,
	height: number,
	x = 0,
	y = 0,
	drawWidth = width,
	drawHeight = height,
): void {
	const source = scratchSource(width, height);
	if (!source) return;
	writeScratchPixels(source, pixels, width, height);
	context.imageSmoothingEnabled = false;
	context.drawImage(source.canvas, x, y, drawWidth, drawHeight);
}

/** Draws a document buffer into a canvas at a CSS size, accounting for DPR. */
export function drawScaled(
	canvas: HTMLCanvasElement,
	pixels: Uint32Array,
	width: number,
	height: number,
	cssWidth: number,
	cssHeight: number,
): void {
	const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
	const backingWidth = Math.max(1, Math.round(cssWidth * dpr));
	const backingHeight = Math.max(1, Math.round(cssHeight * dpr));

	if (canvas.width !== backingWidth) canvas.width = backingWidth;
	if (canvas.height !== backingHeight) canvas.height = backingHeight;

	const context = canvas.getContext("2d");
	if (!context) return;
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.clearRect(0, 0, backingWidth, backingHeight);
	context.save();
	context.scale(backingWidth / width, backingHeight / height);
	drawSource(context, pixels, width, height);
	context.restore();
}

/** Draws a buffer centered in a square thumbnail box, preserving aspect ratio. */
export function drawThumbnail(
	canvas: HTMLCanvasElement,
	pixels: Uint32Array,
	width: number,
	height: number,
	box = 64,
): void {
	const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
	const size = Math.max(1, Math.round(box * dpr));

	if (canvas.width !== size) canvas.width = size;
	if (canvas.height !== size) canvas.height = size;

	const context = canvas.getContext("2d");
	if (!context) return;
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.clearRect(0, 0, size, size);

	const scale = Math.min(size / width, size / height);
	const drawWidth = width * scale;
	const drawHeight = height * scale;

	drawSource(
		context,
		pixels,
		width,
		height,
		(size - drawWidth) / 2,
		(size - drawHeight) / 2,
		drawWidth,
		drawHeight,
	);
}
