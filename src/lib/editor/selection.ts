import { plotLine, plotShape } from "./draw.js";
import type { Point, ShapeKind } from "./types.js";

function clampToDoc(value: number, size: number): number {
	return Math.max(0, Math.min(size - 1, value));
}

function hasAny(mask: Uint8Array): boolean {
	for (let i = 0; i < mask.length; i++) {
		if (mask[i]) return true;
	}
	return false;
}

export interface SelectionBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export function isSelectionPoint(
	mask: Uint8Array | null,
	width: number,
	point: Point,
): boolean {
	return !!mask && mask[point.y * width + point.x] === 1;
}

/** Tight bounding box around the selected pixels, or null for an empty mask. */
export function selectionBounds(
	mask: Uint8Array | null,
	width: number,
	height: number,
): SelectionBounds | null {
	if (!mask) return null;

	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;

	// Native indexOf/lastIndexOf scan a whole row in optimized C++ instead of
	// running the per-pixel loop in JavaScript.
	for (let y = 0; y < height; y++) {
		const rowStart = y * width;
		const rowEnd = rowStart + width;
		const first = mask.indexOf(1, rowStart);
		if (first === -1 || first >= rowEnd) continue;
		const last = mask.lastIndexOf(1, rowEnd - 1);
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
		if (first - rowStart < minX) minX = first - rowStart;
		if (last - rowStart > maxX) maxX = last - rowStart;
	}

	if (maxX < minX || maxY < minY) return null;
	return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function shapeSelectionMask(
	kind: ShapeKind,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	width: number,
	height: number,
): Uint8Array {
	const mask = new Uint8Array(width * height);
	const minX = clampToDoc(Math.min(x0, x1), width);
	const maxX = clampToDoc(Math.max(x0, x1), width);
	const minY = clampToDoc(Math.min(y0, y1), height);
	const maxY = clampToDoc(Math.max(y0, y1), height);

	plotShape(kind, minX, minY, maxX, maxY, true, (x, y) => {
		if (x >= 0 && x < width && y >= 0 && y < height) mask[y * width + x] = 1;
	});
	return mask;
}

export function magicWandMask(
	pixels: Uint32Array,
	width: number,
	height: number,
	x: number,
	y: number,
	diagonal: boolean,
): Uint8Array {
	const mask = new Uint8Array(width * height);
	if (x < 0 || x >= width || y < 0 || y >= height) return mask;

	const target = pixels[y * width + x];
	const visited = new Uint8Array(width * height);
	// Queue each pixel at most once so the stack stays proportional to the
	// current frontier instead of growing to several times the pixel count.
	const stack: number[] = [];
	const start = y * width + x;
	stack.push(start);
	visited[start] = 1;

	const push = (nx: number, ny: number) => {
		if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;
		const next = ny * width + nx;
		if (visited[next]) return;
		visited[next] = 1;
		stack.push(next);
	};

	while (stack.length > 0) {
		const index = stack.pop()!;
		if (pixels[index] !== target) continue;

		mask[index] = 1;
		const px = index % width;
		const py = (index - px) / width;
		push(px, py - 1);
		push(px - 1, py);
		push(px + 1, py);
		push(px, py + 1);
		if (diagonal) {
			push(px - 1, py - 1);
			push(px + 1, py - 1);
			push(px - 1, py + 1);
			push(px + 1, py + 1);
		}
	}
	return mask;
}

export function colorSelectionMask(
	pixels: Uint32Array,
	color: number,
): Uint8Array {
	const mask = new Uint8Array(pixels.length);
	for (let i = 0; i < pixels.length; i++) {
		if (pixels[i] === color) mask[i] = 1;
	}
	return mask;
}

export function unionSelectionMasks(
	base: Uint8Array | null,
	addition: Uint8Array | null,
): Uint8Array | null {
	if (!base) return addition;
	if (!addition) return base;

	const length = Math.min(base.length, addition.length);
	const result = new Uint8Array(length);
	for (let i = 0; i < length; i++) {
		result[i] = base[i] || addition[i] ? 1 : 0;
	}
	return result;
}

export function translateSelectionMask(
	mask: Uint8Array,
	width: number,
	height: number,
	dx: number,
	dy: number,
): Uint8Array {
	const next = new Uint8Array(width * height);
	for (let y = 0; y < height; y++) {
		const ny = y + dy;
		if (ny < 0 || ny >= height) continue;
		for (let x = 0; x < width; x++) {
			if (!mask[y * width + x]) continue;
			const nx = x + dx;
			if (nx < 0 || nx >= width) continue;
			next[ny * width + nx] = 1;
		}
	}
	return next;
}

/**
 * Rasterizes a freehand or polygonal lasso path into a selection mask.
 * Vertices use pixel coordinates; the shape is always implicitly closed.
 */
export function lassoSelectionMask(
	points: Point[],
	width: number,
	height: number,
): Uint8Array | null {
	if (points.length < 3) return null;

	const mask = new Uint8Array(width * height);
	const set = (x: number, y: number) => {
		if (x >= 0 && x < width && y >= 0 && y < height) mask[y * width + x] = 1;
	};

	for (let i = 0; i < points.length; i++) {
		const a = points[i]!;
		const b = points[(i + 1) % points.length]!;
		plotLine(a.x, a.y, b.x, b.y, set);
	}

	let minY = height - 1;
	let maxY = 0;
	for (const point of points) {
		minY = Math.min(minY, point.y);
		maxY = Math.max(maxY, point.y);
	}

	// Even-odd scanline fill sampled at pixel centers. Rasterized edges above
	// keep the boundary intact for very thin or self-intersecting lasso paths.
	for (let y = Math.max(0, minY); y <= Math.min(height - 1, maxY); y++) {
		const scanY = y + 0.5;
		const crossings: number[] = [];

		for (let i = 0; i < points.length; i++) {
			const a = points[i]!;
			const b = points[(i + 1) % points.length]!;
			const ay = a.y + 0.5;
			const by = b.y + 0.5;
			if ((ay <= scanY && by > scanY) || (by <= scanY && ay > scanY)) {
				const t = (scanY - ay) / (by - ay);
				crossings.push(a.x + 0.5 + t * (b.x - a.x));
			}
		}

		crossings.sort((a, b) => a - b);
		for (let i = 0; i + 1 < crossings.length; i += 2) {
			const start = Math.max(0, Math.ceil(crossings[i]! - 0.5));
			const end = Math.min(width - 1, Math.floor(crossings[i + 1]! - 0.5));
			for (let x = start; x <= end; x++) set(x, y);
		}
	}

	return hasAny(mask) ? mask : null;
}
