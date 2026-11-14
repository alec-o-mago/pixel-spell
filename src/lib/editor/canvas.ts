import type { PixelDoc } from "./types.js";

/** Smallest supported canvas dimension in either direction. */
export const MIN_CANVAS_SIZE = 1;
/** Largest supported canvas dimension in either direction. */
export const MAX_CANVAS_SIZE = 2048;

export interface PixelBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Nearest-neighbor scale. Each target pixel samples the source pixel under its
 * top-left corner, which keeps hard edges intact for both upscaling and
 * downscaling.
 */
export function scalePixelsNearest(
	source: Uint32Array,
	sourceWidth: number,
	sourceHeight: number,
	targetWidth: number,
	targetHeight: number,
): Uint32Array {
	const target = new Uint32Array(targetWidth * targetHeight);
	if (
		sourceWidth <= 0 ||
		sourceHeight <= 0 ||
		targetWidth <= 0 ||
		targetHeight <= 0
	) {
		return target;
	}

	const xMap = new Uint32Array(targetWidth);
	for (let x = 0; x < targetWidth; x++) {
		xMap[x] = Math.min(
			sourceWidth - 1,
			Math.floor((x * sourceWidth) / targetWidth),
		);
	}
	const yMap = new Uint32Array(targetHeight);
	for (let y = 0; y < targetHeight; y++) {
		yMap[y] = Math.min(
			sourceHeight - 1,
			Math.floor((y * sourceHeight) / targetHeight),
		);
	}

	for (let y = 0; y < targetHeight; y++) {
		const sourceRow = yMap[y]! * sourceWidth;
		const targetRow = y * targetWidth;
		for (let x = 0; x < targetWidth; x++) {
			target[targetRow + x] = source[sourceRow + xMap[x]!]!;
		}
	}
	return target;
}

/**
 * Copies the overlapping region into a new buffer. Positive offsets add
 * transparent space; negative offsets crop.
 */
export function resizePixels(
	source: Uint32Array,
	sourceWidth: number,
	sourceHeight: number,
	targetWidth: number,
	targetHeight: number,
	offsetX: number,
	offsetY: number,
): Uint32Array {
	const target = new Uint32Array(targetWidth * targetHeight);

	const sourceX = Math.max(0, -offsetX);
	const sourceY = Math.max(0, -offsetY);
	const targetX = Math.max(0, offsetX);
	const targetY = Math.max(0, offsetY);
	const width = Math.min(sourceWidth - sourceX, targetWidth - targetX);
	const height = Math.min(sourceHeight - sourceY, targetHeight - targetY);
	if (width <= 0 || height <= 0) return target;

	for (let row = 0; row < height; row++) {
		const sourceStart = (sourceY + row) * sourceWidth + sourceX;
		const targetStart = (targetY + row) * targetWidth + targetX;
		target.set(
			source.subarray(sourceStart, sourceStart + width),
			targetStart,
		);
	}
	return target;
}

/**
 * Tight bounds of every non-transparent pixel across all frames and normal
 * layers. Reference layers are tracing aids and are deliberately ignored, as
 * are reference-board images, which are not part of the cel composite.
 */
export function contentBoundsOf(doc: PixelDoc): PixelBounds | null {
	let minX = doc.width;
	let minY = doc.height;
	let maxX = -1;
	let maxY = -1;

	for (const layer of doc.layers) {
		if (layer.role === "reference") continue;
		for (let frame = 0; frame < doc.frames.length; frame++) {
			const cel = layer.cels[frame];
			if (!cel) continue;
			for (let y = 0; y < doc.height; y++) {
				const rowStart = y * doc.width;
				for (let x = 0; x < doc.width; x++) {
					if ((cel[rowStart + x]! >>> 24) === 0) continue;
					if (x < minX) minX = x;
					if (x > maxX) maxX = x;
					if (y < minY) minY = y;
					if (y > maxY) maxY = y;
					if (
						minX === 0 &&
						minY === 0 &&
						maxX === doc.width - 1 &&
						maxY === doc.height - 1
					) {
						return { x: 0, y: 0, width: doc.width, height: doc.height };
					}
				}
			}
		}
	}

	if (maxX < minX || maxY < minY) return null;
	return {
		x: minX,
		y: minY,
		width: maxX - minX + 1,
		height: maxY - minY + 1,
	};
}
