import type { ReferenceImage } from "./types.js";

/** Largest source image dimension accepted for a reference board image. */
export const MAX_REFERENCE_DIMENSION = 8192;
export const MAX_REFERENCE_COUNT = 64;
export const MAX_REFERENCE_BYTES = 64 * 1024 * 1024;
export const MAX_TOTAL_REFERENCE_BYTES = 256 * 1024 * 1024;

/**
 * Copies an image into the top-left of a canvas-sized cel. Anything outside
 * the canvas is cropped. Used for importing a normal layer or frame.
 */
export function cropPixelsToCanvas(
	source: Uint32Array,
	sourceWidth: number,
	sourceHeight: number,
	targetWidth: number,
	targetHeight: number,
): Uint32Array {
	const output = new Uint32Array(targetWidth * targetHeight);
	if (sourceWidth <= 0 || sourceHeight <= 0) return output;

	const width = Math.min(sourceWidth, targetWidth);
	const height = Math.min(sourceHeight, targetHeight);
	for (let y = 0; y < height; y++) {
		const sourceRow = y * sourceWidth;
		const targetRow = y * targetWidth;
		for (let x = 0; x < width; x++) {
			output[targetRow + x] = source[sourceRow + x] ?? 0;
		}
	}
	return output;
}

/**
 * Fits an image inside the canvas, preserving the aspect ratio and centering
 * it. Used for reference-layer imports.
 */
export function fitPixelsToCanvas(
	source: Uint32Array,
	sourceWidth: number,
	sourceHeight: number,
	targetWidth: number,
	targetHeight: number,
): Uint32Array {
	const output = new Uint32Array(targetWidth * targetHeight);
	if (
		sourceWidth <= 0 ||
		sourceHeight <= 0 ||
		targetWidth <= 0 ||
		targetHeight <= 0
	) {
		return output;
	}

	const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
	const width = Math.max(1, Math.min(targetWidth, Math.round(sourceWidth * scale)));
	const height = Math.max(1, Math.min(targetHeight, Math.round(sourceHeight * scale)));
	const offsetX = Math.floor((targetWidth - width) / 2);
	const offsetY = Math.floor((targetHeight - height) / 2);

	for (let y = 0; y < height; y++) {
		const sourceY = Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / height));
		const sourceRow = sourceY * sourceWidth;
		const targetRow = (offsetY + y) * targetWidth + offsetX;
		for (let x = 0; x < width; x++) {
			const sourceX = Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / width));
			output[targetRow + x] = source[sourceRow + sourceX] ?? 0;
		}
	}

	return output;
}

/** A sensible default display size and position for a new board reference. */
export function defaultReferencePlacement(
	docWidth: number,
	docHeight: number,
	imageWidth: number,
	imageHeight: number,
	existing: readonly ReferenceImage[],
): { x: number; y: number; width: number; height: number } {
	const safeImageWidth = Math.max(1, imageWidth);
	const safeImageHeight = Math.max(1, imageHeight);
	const targetMax = Math.min(256, Math.max(32, Math.min(docWidth, docHeight)));
	const scale = Math.min(1, targetMax / Math.max(safeImageWidth, safeImageHeight));
	const width = Math.max(1, Math.round(safeImageWidth * scale));
	const height = Math.max(1, Math.round(safeImageHeight * scale));
	const gap = Math.max(4, Math.round(Math.min(docWidth, docHeight) * 0.15));

	let bottom = 0;
	for (const reference of existing) {
		bottom = Math.max(bottom, reference.y + reference.height);
	}

	return {
		x: Math.round(docWidth + gap),
		y: Math.round(existing.length > 0 ? bottom + gap : 0),
		width,
		height,
	};
}
