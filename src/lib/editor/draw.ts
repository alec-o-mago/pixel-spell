import type { MirrorAxis } from "./types.js";

export type PixelWriter = (x: number, y: number) => void;

function forEachMirroredPoint(
	x: number,
	y: number,
	width: number,
	height: number,
	mirrors: readonly MirrorAxis[],
	write: PixelWriter,
): void {
	const combinations = 1 << mirrors.length;

	for (let mask = 0; mask < combinations; mask++) {
		let px = x;
		let py = y;

		for (let index = 0; index < mirrors.length; index++) {
			if ((mask & (1 << index)) === 0) continue;
			const axis = mirrors[index]!;

			if (axis.kind === "x") {
				py = Math.round(2 * axis.position - py - 1);
			} else if (axis.kind === "y") {
				px = Math.round(2 * axis.position - px - 1);
			} else if (axis.kind === "diagonal-down") {
				const nextX = Math.round(py - axis.position);
				const nextY = Math.round(px + axis.position);
				px = nextX;
				py = nextY;
			} else {
				const nextX = Math.round(axis.position - py - 1);
				const nextY = Math.round(axis.position - px - 1);
				px = nextX;
				py = nextY;
			}
		}

		if (px >= 0 && px < width && py >= 0 && py < height) write(px, py);
	}
}

/** Sets a single pixel (with optional symmetry) without applying a brush. */
export function paintPixel(
	cel: Uint32Array,
	width: number,
	height: number,
	x: number,
	y: number,
	color: number,
	mirrors: readonly MirrorAxis[] = [],
	clip: Uint8Array | null = null,
	lockAlpha = false,
): void {
	const set = (px: number, py: number) => {
		if (px < 0 || px >= width || py < 0 || py >= height) return;
		const index = py * width + px;
		if (clip && !clip[index]) return;
		if (lockAlpha && (cel[index]! >>> 24) === 0) return;
		cel[index] = color;
	};

	forEachMirroredPoint(x, y, width, height, mirrors, set);
}

/** Stamps a square brush of `size` pixels, honoring symmetry. */
export function paintBrush(
	cel: Uint32Array,
	width: number,
	height: number,
	x: number,
	y: number,
	size: number,
	color: number,
	mirrors: readonly MirrorAxis[] = [],
	clip: Uint8Array | null = null,
	lockAlpha = false,
): void {
	const span = Math.max(1, Math.round(size));
	const offset = Math.floor((span - 1) / 2);
	const set = (px: number, py: number) => {
		if (px < 0 || px >= width || py < 0 || py >= height) return;
		const index = py * width + px;
		if (clip && !clip[index]) return;
		if (lockAlpha && (cel[index]! >>> 24) === 0) return;
		cel[index] = color;
	};

	for (let dy = 0; dy < span; dy++) {
		for (let dx = 0; dx < span; dx++) {
			forEachMirroredPoint(
				x - offset + dx,
				y - offset + dy,
				width,
				height,
				mirrors,
				set,
			);
		}
	}
}

/** Bresenham line between two points. */
export function plotLine(
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	write: PixelWriter,
): void {
	let x = Math.round(x0);
	let y = Math.round(y0);
	const endX = Math.round(x1);
	const endY = Math.round(y1);
	const dx = Math.abs(endX - x);
	const dy = -Math.abs(endY - y);
	const stepX = x < endX ? 1 : -1;
	const stepY = y < endY ? 1 : -1;
	let error = dx + dy;

	while (true) {
		write(x, y);
		if (x === endX && y === endY) break;
		const doubled = 2 * error;
		if (doubled >= dy) {
			error += dy;
			x += stepX;
		}
		if (doubled <= dx) {
			error += dx;
			y += stepY;
		}
	}
}

/** Cubic Bézier curve sampled densely enough to leave a connected pixel path. */
export function plotCubicCurve(
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	x3: number,
	y3: number,
	write: PixelWriter,
): void {
	const controlLength =
		Math.hypot(x1 - x0, y1 - y0) +
		Math.hypot(x2 - x1, y2 - y1) +
		Math.hypot(x3 - x2, y3 - y2);
	const steps = Math.max(1, Math.ceil(controlLength * 2));

	let previousX = x0;
	let previousY = y0;
	write(Math.round(previousX), Math.round(previousY));

	for (let step = 1; step <= steps; step++) {
		const t = step / steps;
		const inverse = 1 - t;
		const a = inverse * inverse * inverse;
		const b = 3 * inverse * inverse * t;
		const c = 3 * inverse * t * t;
		const d = t * t * t;
		const x = a * x0 + b * x1 + c * x2 + d * x3;
		const y = a * y0 + b * y1 + c * y2 + d * y3;

		plotLine(previousX, previousY, x, y, write);
		previousX = x;
		previousY = y;
	}
}

/** Rectangle outline or filled rectangle. */
export function plotRectangle(
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	filled: boolean,
	write: PixelWriter,
): void {
	const minX = Math.min(x0, x1);
	const maxX = Math.max(x0, x1);
	const minY = Math.min(y0, y1);
	const maxY = Math.max(y0, y1);

	if (filled) {
		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) write(x, y);
		}
		return;
	}

	for (let x = minX; x <= maxX; x++) {
		write(x, minY);
		write(x, maxY);
	}
	for (let y = minY + 1; y < maxY; y++) {
		write(minX, y);
		write(maxX, y);
	}
}

/**
 * Pixel ellipse inscribed in the drag rectangle. Uses scanline extents so
 * outlines stay connected even at very small sizes.
 */
export function plotEllipse(
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	filled: boolean,
	write: PixelWriter,
): void {
	const minX = Math.min(x0, x1);
	const maxX = Math.max(x0, x1);
	const minY = Math.min(y0, y1);
	const maxY = Math.max(y0, y1);

	if (minX === maxX && minY === maxY) {
		write(minX, minY);
		return;
	}

	const centerX = (minX + maxX) / 2;
	const centerY = (minY + maxY) / 2;
	const radiusX = Math.max(0.5, (maxX - minX + 1) / 2);
	const radiusY = Math.max(0.5, (maxY - minY + 1) / 2);

	let previousLeft = minX;
	let previousRight = maxX;
	let hasPrevious = false;

	for (let y = minY; y <= maxY; y++) {
		const normalizedY = (y - centerY) / radiusY;
		const remaining = Math.max(0, 1 - normalizedY * normalizedY);
		const extent = Math.sqrt(remaining) * radiusX;
		let left = Math.round(centerX - extent);
		let right = Math.round(centerX + extent);
		left = Math.max(minX, Math.min(maxX, left));
		right = Math.max(minX, Math.min(maxX, right));

		if (filled) {
			for (let x = left; x <= right; x++) write(x, y);
			continue;
		}

		if (!hasPrevious) {
			for (let x = left; x <= right; x++) write(x, y);
		} else {
			// Join this row's extents to the previous row's. Wide ellipses can
			// move several pixels per scanline near the poles, so plotting only
			// the two edge pixels leaves diagonal gaps.
			plotLine(previousLeft, y - 1, left, y, write);
			plotLine(previousRight, y - 1, right, y, write);
		}

		write(left, y);
		write(right, y);
		if (y === maxY) {
			for (let x = left; x <= right; x++) write(x, y);
		}

		previousLeft = left;
		previousRight = right;
		hasPrevious = true;
	}
}

function colorMatches(a: number, b: number, tolerance: number): boolean {
	if (tolerance <= 0) return a === b;
	const ar = a & 0xff;
	const ag = (a >>> 8) & 0xff;
	const ab = (a >>> 16) & 0xff;
	const aa = (a >>> 24) & 0xff;
	const br = b & 0xff;
	const bg = (b >>> 8) & 0xff;
	const bb = (b >>> 16) & 0xff;
	const ba = (b >>> 24) & 0xff;
	return (
		Math.abs(ar - br) <= tolerance &&
		Math.abs(ag - bg) <= tolerance &&
		Math.abs(ab - bb) <= tolerance &&
		Math.abs(aa - ba) <= tolerance
	);
}

/** Flood fill (contiguous) or global replace (non-contiguous). */
export function fillPixels(
	cel: Uint32Array,
	width: number,
	height: number,
	x: number,
	y: number,
	color: number,
	tolerance: number,
	contiguous: boolean,
	clip: Uint8Array | null = null,
	lockAlpha = false,
): boolean {
	if (x < 0 || x >= width || y < 0 || y >= height) return false;

	const startIndex = y * width + x;
	if (clip && !clip[startIndex]) return false;
	if (lockAlpha && (cel[startIndex]! >>> 24) === 0) return false;

	const target = cel[startIndex];
	if (target === color) return false;

	let changed = false;

	if (!contiguous) {
		for (let i = 0; i < cel.length; i++) {
			if (clip && !clip[i]) continue;
			if (lockAlpha && (cel[i]! >>> 24) === 0) continue;
			if (colorMatches(cel[i]!, target!, tolerance)) {
				cel[i] = color;
				changed = true;
			}
		}
		return changed;
	}

	const visited = new Uint8Array(width * height);
	const stack: number[] = [startIndex];

	while (stack.length > 0) {
		const index = stack.pop()!;
		if (visited[index]) continue;
		visited[index] = 1;
		if (clip && !clip[index]) continue;
		if (lockAlpha && (cel[index]! >>> 24) === 0) continue;

		if (!colorMatches(cel[index], target, tolerance)) continue;

		cel[index] = color;
		changed = true;

		const px = index % width;
		const py = (index - px) / width;

		if (px > 0) stack.push(index - 1);
		if (px < width - 1) stack.push(index + 1);
		if (py > 0) stack.push(index - width);
		if (py < height - 1) stack.push(index + width);
	}

	return changed;
}

/** Scatters `count` random pixels inside a disk, honoring symmetry and clipping. */
export function sprayPixels(
	cel: Uint32Array,
	width: number,
	height: number,
	centerX: number,
	centerY: number,
	radius: number,
	count: number,
	color: number,
	mirrors: readonly MirrorAxis[] = [],
	clip: Uint8Array | null = null,
	lockAlpha = false,
): boolean {
	const span = Math.max(1, radius);
	let changed = false;

	const set = (px: number, py: number) => {
		if (px < 0 || px >= width || py < 0 || py >= height) return;
		const index = py * width + px;
		if (clip && !clip[index]) return;
		if (lockAlpha && (cel[index]! >>> 24) === 0) return;
		if (cel[index] === color) return;
		cel[index] = color;
		changed = true;
	};

	const shots = Math.max(1, Math.round(count));
	for (let shot = 0; shot < shots; shot++) {
		const angle = Math.random() * Math.PI * 2;
		const distance = Math.sqrt(Math.random()) * span;
		const x = Math.round(centerX + Math.cos(angle) * distance);
		const y = Math.round(centerY + Math.sin(angle) * distance);
		forEachMirroredPoint(x, y, width, height, mirrors, set);
	}

	return changed;
}

const BLUR_WEIGHTS = [1, 2, 1, 2, 4, 2, 1, 2, 1];
const BLUR_TOTAL_WEIGHT = 16;

function lerp(from: number, to: number, amount: number): number {
	return from + (to - from) * amount;
}

/**
 * Blurs every pixel inside a disk using a 3×3 Gaussian kernel. `power` (0–100)
 * controls how much of the blurred result replaces each pixel, so repeated
 * passes over the same spot soften it further.
 */
export function blurPixels(
	cel: Uint32Array,
	width: number,
	height: number,
	centerX: number,
	centerY: number,
	radius: number,
	power: number,
	clip: Uint8Array | null = null,
	lockAlpha = false,
): boolean {
	const span = Math.max(1, Math.round(radius));
	const strength = Math.max(0, Math.min(1, power / 100));
	if (strength <= 0) return false;

	// Read every sample from an untouched snapshot so a single pass cannot
	// feed its own output back into the kernel.
	const source = new Uint32Array(cel);
	const minX = Math.max(0, centerX - span);
	const maxX = Math.min(width - 1, centerX + span);
	const minY = Math.max(0, centerY - span);
	const maxY = Math.min(height - 1, centerY + span);
	const radiusSquared = span * span;
	let changed = false;

	for (let y = minY; y <= maxY; y++) {
		for (let x = minX; x <= maxX; x++) {
			const dx = x - centerX;
			const dy = y - centerY;
			if (dx * dx + dy * dy > radiusSquared) continue;

			const index = y * width + x;
			if (clip && !clip[index]) continue;

			const original = source[index]!;
			const originalAlpha = original >>> 24;
			if (lockAlpha && originalAlpha === 0) continue;

			let sumAlpha = 0;
			let sumRed = 0;
			let sumGreen = 0;
			let sumBlue = 0;

			for (let kernelY = -1; kernelY <= 1; kernelY++) {
				const sampleY = y + kernelY;
				if (sampleY < 0 || sampleY >= height) continue;
				for (let kernelX = -1; kernelX <= 1; kernelX++) {
					const sampleX = x + kernelX;
					if (sampleX < 0 || sampleX >= width) continue;

					const weight =
						BLUR_WEIGHTS[(kernelY + 1) * 3 + (kernelX + 1)]!;
					const sample = source[sampleY * width + sampleX]!;
					const alpha = sample >>> 24;
					if (alpha === 0) continue;

					sumAlpha += alpha * weight;
					sumRed += (sample & 0xff) * alpha * weight;
					sumGreen += ((sample >>> 8) & 0xff) * alpha * weight;
					sumBlue += ((sample >>> 16) & 0xff) * alpha * weight;
				}
			}

			if (sumAlpha === 0) continue;

			const blurredAlpha = sumAlpha / BLUR_TOTAL_WEIGHT;
			const blurredRed = sumRed / sumAlpha;
			const blurredGreen = sumGreen / sumAlpha;
			const blurredBlue = sumBlue / sumAlpha;

			const originalRed = original & 0xff;
			const originalGreen = (original >>> 8) & 0xff;
			const originalBlue = (original >>> 16) & 0xff;

			// Blend premultiplied colors so transparent neighbors do not leave
			// dark fringes around softened edges.
			const originalPremultipliedRed = originalRed * originalAlpha;
			const originalPremultipliedGreen = originalGreen * originalAlpha;
			const originalPremultipliedBlue = originalBlue * originalAlpha;
			const blurredPremultipliedRed = blurredRed * blurredAlpha;
			const blurredPremultipliedGreen = blurredGreen * blurredAlpha;
			const blurredPremultipliedBlue = blurredBlue * blurredAlpha;

			const nextAlpha = Math.round(
				lerp(originalAlpha, blurredAlpha, strength),
			);
			const nextPremultipliedRed = lerp(
				originalPremultipliedRed,
				blurredPremultipliedRed,
				strength,
			);
			const nextPremultipliedGreen = lerp(
				originalPremultipliedGreen,
				blurredPremultipliedGreen,
				strength,
			);
			const nextPremultipliedBlue = lerp(
				originalPremultipliedBlue,
				blurredPremultipliedBlue,
				strength,
			);

			const nextRed =
				nextAlpha > 0
					? Math.max(0, Math.min(255, Math.round(nextPremultipliedRed / nextAlpha)))
					: 0;
			const nextGreen =
				nextAlpha > 0
					? Math.max(0, Math.min(255, Math.round(nextPremultipliedGreen / nextAlpha)))
					: 0;
			const nextBlue =
				nextAlpha > 0
					? Math.max(0, Math.min(255, Math.round(nextPremultipliedBlue / nextAlpha)))
					: 0;

			const next =
				((nextAlpha << 24) |
					(nextBlue << 16) |
					(nextGreen << 8) |
					nextRed) >>>
				0;

			if (next === original) continue;
			cel[index] = next;
			changed = true;
		}
	}

	return changed;
}

/**
 * Randomly swaps pixels inside a disk. `power` (0–100) controls how many
 * swaps are performed relative to the number of pixels in the area.
 */
export function jumblePixels(
	cel: Uint32Array,
	width: number,
	height: number,
	centerX: number,
	centerY: number,
	radius: number,
	power: number,
	clip: Uint8Array | null = null,
	lockAlpha = false,
): boolean {
	const span = Math.max(1, Math.round(radius));
	const strength = Math.max(0, Math.min(1, power / 100));
	if (strength <= 0) return false;

	const minX = Math.max(0, centerX - span);
	const maxX = Math.min(width - 1, centerX + span);
	const minY = Math.max(0, centerY - span);
	const maxY = Math.min(height - 1, centerY + span);
	const radiusSquared = span * span;
	const indices: number[] = [];

	for (let y = minY; y <= maxY; y++) {
		for (let x = minX; x <= maxX; x++) {
			const dx = x - centerX;
			const dy = y - centerY;
			if (dx * dx + dy * dy > radiusSquared) continue;

			const index = y * width + x;
			if (clip && !clip[index]) continue;
			if (lockAlpha && (cel[index]! >>> 24) === 0) continue;
			indices.push(index);
		}
	}

	if (indices.length < 2) return false;

	const swaps = Math.max(1, Math.round(indices.length * strength));
	let changed = false;

	for (let swap = 0; swap < swaps; swap++) {
		const a = indices[Math.floor(Math.random() * indices.length)]!;
		const b = indices[Math.floor(Math.random() * indices.length)]!;
		if (a === b || cel[a] === cel[b]) continue;

		const value = cel[a]!;
		cel[a] = cel[b]!;
		cel[b] = value;
		changed = true;
	}

	return changed;
}
