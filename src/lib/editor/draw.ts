export type PixelWriter = (x: number, y: number) => void;

/** Sets a single pixel (with optional symmetry) without applying a brush. */
export function paintPixel(
	cel: Uint32Array,
	width: number,
	height: number,
	x: number,
	y: number,
	color: number,
	mirrorX = false,
	mirrorY = false,
): void {
	const set = (px: number, py: number) => {
		if (px < 0 || px >= width || py < 0 || py >= height) return;
		cel[py * width + px] = color;
	};

	set(x, y);
	if (mirrorX) set(width - 1 - x, y);
	if (mirrorY) set(x, height - 1 - y);
	if (mirrorX && mirrorY) set(width - 1 - x, height - 1 - y);
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
	mirrorX = false,
	mirrorY = false,
): void {
	const span = Math.max(1, Math.round(size));
	const offset = Math.floor((span - 1) / 2);
	const set = (px: number, py: number) => {
		if (px < 0 || px >= width || py < 0 || py >= height) return;
		cel[py * width + px] = color;
	};

	for (let dy = 0; dy < span; dy++) {
		for (let dx = 0; dx < span; dx++) {
			const px = x - offset + dx;
			const py = y - offset + dy;
			set(px, py);
			if (mirrorX) set(width - 1 - px, py);
			if (mirrorY) set(px, height - 1 - py);
			if (mirrorX && mirrorY) set(width - 1 - px, height - 1 - py);
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
): boolean {
	if (x < 0 || x >= width || y < 0 || y >= height) return false;

	const target = cel[y * width + x];
	if (target === color) return false;

	let changed = false;

	if (!contiguous) {
		for (let i = 0; i < cel.length; i++) {
			if (colorMatches(cel[i], target, tolerance)) {
				cel[i] = color;
				changed = true;
			}
		}
		return changed;
	}

	const visited = new Uint8Array(width * height);
	const stack: number[] = [y * width + x];

	while (stack.length > 0) {
		const index = stack.pop()!;
		if (visited[index]) continue;
		visited[index] = 1;

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
