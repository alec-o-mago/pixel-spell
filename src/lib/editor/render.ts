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

function drawSource(
	context: CanvasRenderingContext2D,
	pixels: Uint32Array,
	width: number,
	height: number,
): void {
	const source = document.createElement("canvas");
	source.width = width;
	source.height = height;
	const sourceContext = source.getContext("2d");
	if (!sourceContext) return;
	sourceContext.putImageData(pixelsToImageData(pixels, width, height), 0, 0);

	context.imageSmoothingEnabled = false;
	context.drawImage(source, 0, 0);
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

	const source = document.createElement("canvas");
	source.width = width;
	source.height = height;
	const sourceContext = source.getContext("2d");
	if (!sourceContext) return;
	sourceContext.putImageData(pixelsToImageData(pixels, width, height), 0, 0);

	context.imageSmoothingEnabled = false;
	context.drawImage(
		source,
		(size - drawWidth) / 2,
		(size - drawHeight) / 2,
		drawWidth,
		drawHeight,
	);
}
