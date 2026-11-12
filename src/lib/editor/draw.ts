import type {
	GradientDither,
	GradientShape,
	MirrorAxis,
	RadialSymmetry,
	ShapeKind,
} from "./types.js";

export type PixelWriter = (x: number, y: number) => void;

/**
 * Cosine/sine pairs for one full turn, cached per symmetry count. Radial
 * symmetry can stamp the same point many times per brush pixel, so rebuilding
 * the trigonometry for every pixel would be needlessly expensive.
 */
const radialRotationCache = new Map<number, readonly { cos: number; sin: number }[]>();

function radialRotations(count: number): readonly { cos: number; sin: number }[] {
	const rounded = Math.max(2, Math.round(count));
	const cached = radialRotationCache.get(rounded);
	if (cached) return cached;

	const step = (Math.PI * 2) / rounded;
	const rotations = Array.from({ length: rounded - 1 }, (_, index) => {
		const angle = step * (index + 1);
		return { cos: Math.cos(angle), sin: Math.sin(angle) };
	});
	radialRotationCache.set(rounded, rotations);
	return rotations;
}

function forEachSymmetryPoint(
	x: number,
	y: number,
	width: number,
	height: number,
	mirrors: readonly MirrorAxis[],
	radial: RadialSymmetry | null,
	write: PixelWriter,
): void {
	const combinations = 1 << mirrors.length;
	const rotations = radial ? radialRotations(radial.count) : [];

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

		if (px < 0 || px >= width || py < 0 || py >= height) continue;
		write(px, py);

		if (!radial) continue;
		// Rotate the pixel center so odd-sized and offset centers stay stable.
		const dx = px + 0.5 - radial.centerX;
		const dy = py + 0.5 - radial.centerY;
		for (const rotation of rotations) {
			const rx = Math.floor(radial.centerX + dx * rotation.cos - dy * rotation.sin);
			const ry = Math.floor(radial.centerY + dx * rotation.sin + dy * rotation.cos);
			if (rx >= 0 && rx < width && ry >= 0 && ry < height) write(rx, ry);
		}
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
	radial: RadialSymmetry | null = null,
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

	forEachSymmetryPoint(x, y, width, height, mirrors, radial, set);
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
	radial: RadialSymmetry | null = null,
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
			forEachSymmetryPoint(
				x - offset + dx,
				y - offset + dy,
				width,
				height,
				mirrors,
				radial,
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

/** Outline of a five-pointed star inscribed in the drag rectangle. */
function starPoints(
	minX: number,
	minY: number,
	maxX: number,
	maxY: number,
): { x: number; y: number }[] {
	const centerX = (minX + maxX + 1) / 2;
	const centerY = (minY + maxY + 1) / 2;
	const radiusX = (maxX - minX + 1) / 2;
	const radiusY = (maxY - minY + 1) / 2;
	const points: { x: number; y: number }[] = [];

	for (let index = 0; index < 10; index++) {
		const angle = -Math.PI / 2 + (index * Math.PI) / 5;
		const radius = index % 2 === 0 ? 1 : 0.5;
		points.push({
			x: centerX + Math.cos(angle) * radiusX * radius,
			y: centerY + Math.sin(angle) * radiusY * radius,
		});
	}

	return points;
}

/** Parametric heart curve normalized into the drag rectangle. */
function heartPoints(
	minX: number,
	minY: number,
	maxX: number,
	maxY: number,
): { x: number; y: number }[] {
	const samples = 160;
	const raw: { x: number; y: number }[] = [];
	let rawMinX = Infinity;
	let rawMaxX = -Infinity;
	let rawMinY = Infinity;
	let rawMaxY = -Infinity;

	for (let index = 0; index < samples; index++) {
		const angle = (index / samples) * Math.PI * 2;
		const x = 16 * Math.sin(angle) ** 3;
		const y =
			13 * Math.cos(angle) -
			5 * Math.cos(2 * angle) -
			2 * Math.cos(3 * angle) -
			Math.cos(4 * angle);
		raw.push({ x, y });
		rawMinX = Math.min(rawMinX, x);
		rawMaxX = Math.max(rawMaxX, x);
		rawMinY = Math.min(rawMinY, y);
		rawMaxY = Math.max(rawMaxY, y);
	}

	const spanX = Math.max(1, rawMaxX - rawMinX);
	const spanY = Math.max(1, rawMaxY - rawMinY);
	const width = maxX - minX + 1;
	const height = maxY - minY + 1;

	return raw.map((point) => ({
		x: minX + ((point.x - rawMinX) / spanX) * width,
		// The parametric curve points up; canvas y increases downward.
		y: minY + ((rawMaxY - point.y) / spanY) * height,
	}));
}

/** Even-odd scanline fill sampled at pixel centers. */
function polygonMask(
	points: { x: number; y: number }[],
	minX: number,
	minY: number,
	maxX: number,
	maxY: number,
): { mask: Uint8Array; width: number; height: number } {
	const width = Math.max(1, maxX - minX + 1);
	const height = Math.max(1, maxY - minY + 1);
	const mask = new Uint8Array(width * height);

	for (let row = 0; row < height; row++) {
		const scanY = minY + row + 0.5;
		const crossings: number[] = [];

		for (let index = 0; index < points.length; index++) {
			const a = points[index]!;
			const b = points[(index + 1) % points.length]!;
			if ((a.y <= scanY && b.y > scanY) || (b.y <= scanY && a.y > scanY)) {
				const t = (scanY - a.y) / (b.y - a.y);
				crossings.push(a.x + t * (b.x - a.x));
			}
		}

		crossings.sort((a, b) => a - b);
		for (let index = 0; index + 1 < crossings.length; index += 2) {
			const start = Math.max(0, Math.ceil(crossings[index]! - 0.5) - minX);
			const end = Math.min(
				width - 1,
				Math.floor(crossings[index + 1]! - 0.5) - minX,
			);
			for (let column = start; column <= end; column++) {
				mask[row * width + column] = 1;
			}
		}
	}

	return { mask, width, height };
}

/**
 * Writes a polygon mask as either a solid fill or a one-pixel boundary. The
 * boundary is extracted from the filled mask so small shapes stay closed.
 */
function plotPolygon(
	points: { x: number; y: number }[],
	minX: number,
	minY: number,
	maxX: number,
	maxY: number,
	filled: boolean,
	write: PixelWriter,
): void {
	const { mask, width, height } = polygonMask(points, minX, minY, maxX, maxY);
	let wrote = false;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const index = y * width + x;
			if (!mask[index]) continue;

			if (!filled) {
				const left = x === 0 || !mask[index - 1];
				const right = x === width - 1 || !mask[index + 1];
				const top = y === 0 || !mask[index - width];
				const bottom = y === height - 1 || !mask[index + width];
				if (!left && !right && !top && !bottom) continue;
			}

			write(minX + x, minY + y);
			wrote = true;
		}
	}

	// Degenerate drags can rasterize to an empty polygon; leave a single dot.
	if (!wrote) write(Math.round((minX + maxX) / 2), Math.round((minY + maxY) / 2));
}

/** Draws a rectangle, ellipse, star, or heart between two drag points. */
export function plotShape(
	kind: ShapeKind,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	filled: boolean,
	write: PixelWriter,
): void {
	if (kind === "rectangle") {
		plotRectangle(x0, y0, x1, y1, filled, write);
		return;
	}
	if (kind === "ellipse") {
		plotEllipse(x0, y0, x1, y1, filled, write);
		return;
	}

	const minX = Math.min(x0, x1);
	const maxX = Math.max(x0, x1);
	const minY = Math.min(y0, y1);
	const maxY = Math.max(y0, y1);
	const points =
		kind === "star"
			? starPoints(minX, minY, maxX, maxY)
			: heartPoints(minX, minY, maxX, maxY);

	plotPolygon(points, minX, minY, maxX, maxY, filled, write);
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

interface BayerPattern {
	size: number;
	mask: number;
	shift: number;
	thresholds: Float32Array;
}

function bayerThresholds(values: number[], size: number): Float32Array {
	const total = size * size;
	return new Float32Array(values.map((value) => (value + 0.5) / total));
}

const BAYER_PATTERNS: Record<Exclude<GradientDither, "none">, BayerPattern> = {
	bayer2: {
		size: 2,
		mask: 1,
		shift: 1,
		thresholds: bayerThresholds([0, 2, 3, 1], 2),
	},
	bayer4: {
		size: 4,
		mask: 3,
		shift: 2,
		thresholds: bayerThresholds(
			[
				0, 8, 2, 10,
				12, 4, 14, 6,
				3, 11, 1, 9,
				15, 7, 13, 5,
			],
			4,
		),
	},
	bayer8: {
		size: 8,
		mask: 7,
		shift: 3,
		thresholds: bayerThresholds(
			[
				0, 32, 8, 40, 2, 34, 10, 42,
				48, 16, 56, 24, 50, 18, 58, 26,
				12, 44, 4, 36, 14, 46, 6, 38,
				60, 28, 52, 20, 62, 30, 54, 22,
				3, 35, 11, 43, 1, 33, 9, 41,
				51, 19, 59, 27, 49, 17, 57, 25,
				15, 47, 7, 39, 13, 45, 5, 37,
				63, 31, 55, 23, 61, 29, 53, 21,
			],
			8,
		),
	},
};

interface RegionMask {
	mask: Uint8Array;
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

const REGION_UNVISITED = 0;
const REGION_QUEUED = 1;
const REGION_REJECTED = 2;
const REGION_MATCH = 3;

/**
 * Builds the same region a fill would affect: a matching connected area, or
 * every matching pixel when `contiguous` is false. The mask also reports its
 * bounds so callers only touch the affected rectangle instead of the whole
 * canvas (important for large documents and gradient previews).
 */
function matchingRegionMask(
	cel: Uint32Array,
	width: number,
	height: number,
	x: number,
	y: number,
	tolerance: number,
	contiguous: boolean,
	clip: Uint8Array | null,
	lockAlpha: boolean,
): RegionMask | null {
	if (x < 0 || x >= width || y < 0 || y >= height) return null;

	const startIndex = y * width + x;
	if (clip && !clip[startIndex]) return null;
	if (lockAlpha && (cel[startIndex]! >>> 24) === 0) return null;

	const target = cel[startIndex]!;
	const mask = new Uint8Array(width * height);
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;

	if (!contiguous) {
		for (let index = 0; index < cel.length; index++) {
			if (clip && !clip[index]) continue;
			if (lockAlpha && (cel[index]! >>> 24) === 0) continue;
			if (!colorMatches(cel[index]!, target, tolerance)) continue;
			mask[index] = REGION_MATCH;
			const px = index % width;
			const py = (index - px) / width;
			if (px < minX) minX = px;
			if (px > maxX) maxX = px;
			if (py < minY) minY = py;
			if (py > maxY) maxY = py;
		}
		if (maxX < minX) return null;
		return { mask, minX, minY, maxX, maxY };
	}

	// Every pixel is queued at most once, so the stack only holds the current
	// frontier instead of growing to several times the pixel count.
	const stack: number[] = [startIndex];
	mask[startIndex] = REGION_QUEUED;

	while (stack.length > 0) {
		const index = stack.pop()!;
		if (mask[index] !== REGION_QUEUED) continue;

		if (clip && !clip[index]) {
			mask[index] = REGION_REJECTED;
			continue;
		}
		if (lockAlpha && (cel[index]! >>> 24) === 0) {
			mask[index] = REGION_REJECTED;
			continue;
		}
		if (!colorMatches(cel[index]!, target, tolerance)) {
			mask[index] = REGION_REJECTED;
			continue;
		}

		mask[index] = REGION_MATCH;
		const px = index % width;
		const py = (index - px) / width;
		if (px < minX) minX = px;
		if (px > maxX) maxX = px;
		if (py < minY) minY = py;
		if (py > maxY) maxY = py;

		if (px > 0) {
			const next = index - 1;
			if (mask[next] === REGION_UNVISITED) {
				mask[next] = REGION_QUEUED;
				stack.push(next);
			}
		}
		if (px < width - 1) {
			const next = index + 1;
			if (mask[next] === REGION_UNVISITED) {
				mask[next] = REGION_QUEUED;
				stack.push(next);
			}
		}
		if (py > 0) {
			const next = index - width;
			if (mask[next] === REGION_UNVISITED) {
				mask[next] = REGION_QUEUED;
				stack.push(next);
			}
		}
		if (py < height - 1) {
			const next = index + width;
			if (mask[next] === REGION_UNVISITED) {
				mask[next] = REGION_QUEUED;
				stack.push(next);
			}
		}
	}

	if (maxX < minX) return null;
	// Callers expect 1 for selected pixels; REGION_MATCH is the internal code.
	return { mask, minX, minY, maxX, maxY };
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
	onFirstChange?: () => void,
): boolean {
	if (x < 0 || x >= width || y < 0 || y >= height) return false;

	const startIndex = y * width + x;
	if (clip && !clip[startIndex]) return false;
	if (lockAlpha && (cel[startIndex]! >>> 24) === 0) return false;

	const target = cel[startIndex];
	if (target === color) return false;

	const region = matchingRegionMask(
		cel,
		width,
		height,
		x,
		y,
		tolerance,
		contiguous,
		clip,
		lockAlpha,
	);
	if (!region) return false;

	const { mask, minX, minY, maxX, maxY } = region;
	let changed = false;
	for (let py = minY; py <= maxY; py++) {
		const row = py * width;
		for (let px = minX; px <= maxX; px++) {
			const index = row + px;
			if (mask[index] !== REGION_MATCH || cel[index] === color) continue;
			if (!changed) {
				onFirstChange?.();
				changed = true;
			}
			cel[index] = color;
		}
	}
	return changed;
}

function lerpPackedColor(from: number, to: number, amount: number): number {
	const fromRed = from & 0xff;
	const fromGreen = (from >>> 8) & 0xff;
	const fromBlue = (from >>> 16) & 0xff;
	const fromAlpha = from >>> 24;
	const toRed = to & 0xff;
	const toGreen = (to >>> 8) & 0xff;
	const toBlue = (to >>> 16) & 0xff;
	const toAlpha = to >>> 24;

	const red = Math.round(fromRed + (toRed - fromRed) * amount);
	const green = Math.round(fromGreen + (toGreen - fromGreen) * amount);
	const blue = Math.round(fromBlue + (toBlue - fromBlue) * amount);
	const alpha = Math.round(fromAlpha + (toAlpha - fromAlpha) * amount);

	return (
		(((alpha & 0xff) << 24) |
			((blue & 0xff) << 16) |
			((green & 0xff) << 8) |
			(red & 0xff)) >>>
		0
	);
}

/**
 * Applies a linear or radial gradient between two colors inside the region a
 * fill would affect at the start point. Bayer dithering picks one endpoint per
 * pixel, while `none` blends the endpoints continuously.
 */
export function gradientPixels(
	cel: Uint32Array,
	width: number,
	height: number,
	startX: number,
	startY: number,
	endX: number,
	endY: number,
	startColor: number,
	endColor: number,
	tolerance: number,
	contiguous: boolean,
	shape: GradientShape,
	dither: GradientDither,
	clip: Uint8Array | null = null,
	lockAlpha = false,
	onFirstChange?: () => void,
): boolean {
	const deltaX = endX - startX;
	const deltaY = endY - startY;
	const lengthSquared = deltaX * deltaX + deltaY * deltaY;
	if (lengthSquared === 0) return false;

	const region = matchingRegionMask(
		cel,
		width,
		height,
		startX,
		startY,
		tolerance,
		contiguous,
		clip,
		lockAlpha,
	);
	if (!region) return false;

	const { mask, minX, minY, maxX, maxY } = region;
	const radius = Math.sqrt(lengthSquared);
	const pattern = dither === "none" ? null : BAYER_PATTERNS[dither];
	let changed = false;

	for (let y = minY; y <= maxY; y++) {
		for (let x = minX; x <= maxX; x++) {
			const index = y * width + x;
			if (mask[index] !== REGION_MATCH) continue;

			let amount: number;
			if (shape === "linear") {
				amount =
					((x - startX) * deltaX + (y - startY) * deltaY) / lengthSquared;
			} else {
				const dx = x - startX;
				const dy = y - startY;
				amount = Math.sqrt(dx * dx + dy * dy) / radius;
			}
			amount = Math.max(0, Math.min(1, amount));

			let next: number;
			if (pattern) {
				const threshold =
					pattern.thresholds[
						((y & pattern.mask) << pattern.shift) + (x & pattern.mask)
					]!;
				next = amount > threshold ? endColor : startColor;
			} else {
				next = lerpPackedColor(startColor, endColor, amount);
			}

			if (cel[index] === next) continue;
			if (!changed) onFirstChange?.();
			cel[index] = next;
			changed = true;
		}
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
	radial: RadialSymmetry | null = null,
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
		forEachSymmetryPoint(x, y, width, height, mirrors, radial, set);
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
	// feed its own output back into the kernel. Only the affected window plus a
	// one-pixel kernel border is copied; a full-canvas copy made every pointer
	// move allocate and touch the entire cel.
	const minX = Math.max(0, centerX - span);
	const maxX = Math.min(width - 1, centerX + span);
	const minY = Math.max(0, centerY - span);
	const maxY = Math.min(height - 1, centerY + span);
	const sourceMinX = Math.max(0, minX - 1);
	const sourceMaxX = Math.min(width - 1, maxX + 1);
	const sourceMinY = Math.max(0, minY - 1);
	const sourceMaxY = Math.min(height - 1, maxY + 1);
	const sourceWidth = sourceMaxX - sourceMinX + 1;
	const sourceHeight = sourceMaxY - sourceMinY + 1;
	const source = new Uint32Array(sourceWidth * sourceHeight);
	for (let y = 0; y < sourceHeight; y++) {
		const sourceRow = (sourceMinY + y) * width + sourceMinX;
		source.set(
			cel.subarray(sourceRow, sourceRow + sourceWidth),
			y * sourceWidth,
		);
	}
	const radiusSquared = span * span;
	let changed = false;

	for (let y = minY; y <= maxY; y++) {
		for (let x = minX; x <= maxX; x++) {
			const dx = x - centerX;
			const dy = y - centerY;
			if (dx * dx + dy * dy > radiusSquared) continue;

			const index = y * width + x;
			if (clip && !clip[index]) continue;

			const localIndex = (y - sourceMinY) * sourceWidth + (x - sourceMinX);
			const original = source[localIndex]!;
			const originalAlpha = original >>> 24;
			if (lockAlpha && originalAlpha === 0) continue;

			let sumAlpha = 0;
			let sumRed = 0;
			let sumGreen = 0;
			let sumBlue = 0;

			for (let kernelY = -1; kernelY <= 1; kernelY++) {
				const sampleY = y + kernelY;
				if (sampleY < 0 || sampleY >= height) continue;
				const localRow = (sampleY - sourceMinY) * sourceWidth;
				for (let kernelX = -1; kernelX <= 1; kernelX++) {
					const sampleX = x + kernelX;
					if (sampleX < 0 || sampleX >= width) continue;

					const weight =
						BLUR_WEIGHTS[(kernelY + 1) * 3 + (kernelX + 1)]!;
					const sample =
						source[localRow + (sampleX - sourceMinX)]!;
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
