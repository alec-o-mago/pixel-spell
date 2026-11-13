import { compositeFrame, frameDurationMs, loopRangeOf } from "./doc.js";
import { fileBase } from "./file.js";
import { drawPixels } from "./render.js";
import type { PixelDoc } from "./types.js";

export type ExportTabId = "image" | "spritesheet" | "gif";
export type ExportFormat = "png" | "webp" | "jpeg";
export type ExportBackground = "transparent" | "white" | "black";
export type SheetLayout = "horizontal" | "vertical" | "grid";

export interface ImageExportOptions {
	frame: number;
	scale: number;
	format: ExportFormat;
	background: ExportBackground;
	/** 0–100, used by WebP and JPEG. */
	quality: number;
}

export interface SheetExportOptions {
	scale: number;
	layout: SheetLayout;
	columns: number;
	/** Gap between frames, in output pixels. */
	spacing: number;
	format: ExportFormat;
	background: ExportBackground;
	quality: number;
}

export interface GifExportOptions {
	scale: number;
	fps: number;
	loop: boolean;
	background: ExportBackground;
	/** Restrict the GIF to the document loop range when one is set. */
	loopRange?: boolean;
}

export interface SheetGeometry {
	columns: number;
	rows: number;
	frameWidth: number;
	frameHeight: number;
	spacing: number;
	width: number;
	height: number;
}

export const EXPORT_TAB_LABELS: Record<ExportTabId, string> = {
	image: "Image",
	spritesheet: "Spritesheet",
	gif: "GIF",
};

export const EXPORT_FORMATS: { id: ExportFormat; label: string }[] = [
	{ id: "png", label: "PNG" },
	{ id: "webp", label: "WebP" },
	{ id: "jpeg", label: "JPEG" },
];

export const FORMAT_EXTENSION: Record<ExportFormat, string> = {
	png: "png",
	webp: "webp",
	jpeg: "jpg",
};

const FORMAT_MIME: Record<ExportFormat, string> = {
	png: "image/png",
	webp: "image/webp",
	jpeg: "image/jpeg",
};

export const MAX_EXPORT_DIMENSION = 16384;
export const MAX_EXPORT_PIXELS = 32_000_000;
export const MAX_GIF_DIMENSION = 8192;
export const MAX_GIF_PIXELS = 32_000_000;

const GIF_MAX_EXACT_COLORS = 65_536;
const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));
const clampInt = (value: number, min: number, max: number) =>
	Number.isFinite(value) ? clamp(Math.round(value), min, max) : min;

/** A file-name-safe version of a project name, without an extension. */
export function exportBaseName(name: string): string {
	return fileBase(name);
}

/** Replaces any known image extension with the requested one. */
export function exportFileName(name: string, extension: string): string {
	const safe = name
		.trim()
		.replace(/[\\/:*?"<>|]+/g, "-")
		.replace(/\s+/g, " ")
		.slice(0, 120);
	const base = (safe || "pixel-spell").replace(/\.(png|jpe?g|webp|gif)$/i, "");
	return `${base || "pixel-spell"}.${extension}`;
}

export function downloadBlob(filename: string, blob: Blob): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.rel = "noopener";
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function getSheetGeometry(
	width: number,
	height: number,
	frameCount: number,
	layout: SheetLayout,
	columns: number,
	spacing: number,
): SheetGeometry {
	const count = Math.max(1, frameCount);
	const cols =
		layout === "horizontal"
			? count
			: layout === "vertical"
				? 1
				: clampInt(columns, 1, count);
	const rows = Math.ceil(count / cols);
	const gap = Number.isFinite(spacing) ? Math.max(0, Math.round(spacing)) : 0;

	return {
		columns: cols,
		rows,
		frameWidth: width,
		frameHeight: height,
		spacing: gap,
		width: cols * width + Math.max(0, cols - 1) * gap,
		height: rows * height + Math.max(0, rows - 1) * gap,
	};
}

/** Frame indices included in an animation export. */
export function animationFrameIndices(
	doc: PixelDoc,
	useLoopRange = true,
): number[] {
	if (!useLoopRange) {
		return Array.from({ length: doc.frames.length }, (_, index) => index);
	}
	const range = loopRangeOf(doc);
	const indices: number[] = [];
	for (let index = range.start; index <= range.end; index++) {
		indices.push(index);
	}
	return indices.length > 0 ? indices : [0];
}

/** Returns a human-readable error when an export would exceed safe limits. */
export function validateExportSize(
	width: number,
	height: number,
	frameCount = 1,
	gif = false,
): string | null {
	const maxDimension = gif ? MAX_GIF_DIMENSION : MAX_EXPORT_DIMENSION;
	const maxPixels = gif ? MAX_GIF_PIXELS : MAX_EXPORT_PIXELS;
	const pixels = width * height * (gif ? frameCount : 1);
	const dimensions = `${Math.round(width)} × ${Math.round(height)} px`;
	const frames = gif && frameCount > 1 ? ` × ${frameCount} frames` : "";
	const megapixels = (pixels / 1_000_000).toFixed(1);

	if (width > maxDimension || height > maxDimension) {
		return `The output would be ${dimensions}${frames}. Keep each side at ${maxDimension} px or less by reducing the scale.`;
	}
	if (pixels > maxPixels) {
		return `The output would be ${dimensions}${frames} (${megapixels} MP). Reduce the scale${
			gif && frameCount > 1 ? " or use fewer frames" : ""
		} to stay under ${maxPixels / 1_000_000} MP.`;
	}
	return null;
}

/** Flattens alpha onto a solid background, or returns the buffer unchanged. */
export function flattenPixels(
	pixels: Uint32Array,
	background: ExportBackground,
): Uint32Array {
	if (background === "transparent") return pixels;

	const backgroundRgb = background === "white" ? 0xffffff : 0x000000;
	const br = backgroundRgb & 0xff;
	const bg = (backgroundRgb >>> 8) & 0xff;
	const bb = (backgroundRgb >>> 16) & 0xff;
	const output = new Uint32Array(pixels.length);

	for (let index = 0; index < pixels.length; index++) {
		const value = pixels[index]!;
		const alpha = value >>> 24;
		if (alpha === 255) {
			output[index] = value;
			continue;
		}

		const t = alpha / 255;
		const r = Math.round((value & 0xff) * t + br * (1 - t));
		const g = Math.round(((value >>> 8) & 0xff) * t + bg * (1 - t));
		const b = Math.round(((value >>> 16) & 0xff) * t + bb * (1 - t));
		output[index] = ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
	}

	return output;
}

function createSourceCanvas(doc: PixelDoc, frameIndex: number): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	drawPixels(
		canvas,
		compositeFrame(doc, frameIndex),
		doc.width,
		doc.height,
	);
	return canvas;
}

function fillBackground(
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
	background: ExportBackground,
): void {
	if (background === "transparent") return;
	context.fillStyle = background === "white" ? "#ffffff" : "#000000";
	context.fillRect(0, 0, width, height);
}

function canvasToBlob(
	canvas: HTMLCanvasElement,
	format: ExportFormat,
	quality: number,
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (!blob) {
					reject(
						new Error(
							`This browser could not encode ${format.toUpperCase()}. Try PNG instead.`,
						),
					);
					return;
				}
				if (format !== "png" && blob.type !== FORMAT_MIME[format]) {
					reject(
						new Error(
							`This browser does not support ${format.toUpperCase()} export. Try PNG instead.`,
						),
					);
					return;
				}
				resolve(blob);
			},
			FORMAT_MIME[format],
			format === "png" ? undefined : clamp(quality, 0, 100) / 100,
		);
	});
}

export async function exportFrameImage(
	doc: PixelDoc,
	options: ImageExportOptions,
): Promise<Blob> {
	const frameIndex = clampInt(options.frame, 0, doc.frames.length - 1);
	const scale = clampInt(options.scale, 1, 10);
	const width = doc.width * scale;
	const height = doc.height * scale;
	const sizeError = validateExportSize(width, height);
	if (sizeError) throw new Error(sizeError);

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas 2D is not available");

	fillBackground(context, width, height, options.background);
	context.imageSmoothingEnabled = false;
	context.drawImage(createSourceCanvas(doc, frameIndex), 0, 0, width, height);

	return canvasToBlob(canvas, options.format, options.quality);
}

export async function exportSpriteSheet(
	doc: PixelDoc,
	options: SheetExportOptions,
): Promise<Blob> {
	const scale = clampInt(options.scale, 1, 10);
	const geometry = getSheetGeometry(
		doc.width * scale,
		doc.height * scale,
		doc.frames.length,
		options.layout,
		options.columns,
		options.spacing,
	);
	const sizeError = validateExportSize(geometry.width, geometry.height);
	if (sizeError) throw new Error(sizeError);

	const canvas = document.createElement("canvas");
	canvas.width = geometry.width;
	canvas.height = geometry.height;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas 2D is not available");

	fillBackground(context, geometry.width, geometry.height, options.background);
	context.imageSmoothingEnabled = false;

	const source = document.createElement("canvas");

	for (let frameIndex = 0; frameIndex < doc.frames.length; frameIndex++) {
		drawPixels(
			source,
			compositeFrame(doc, frameIndex),
			doc.width,
			doc.height,
		);

		const column = frameIndex % geometry.columns;
		const row = Math.floor(frameIndex / geometry.columns);
		context.drawImage(
			source,
			column * (geometry.frameWidth + geometry.spacing),
			row * (geometry.frameHeight + geometry.spacing),
			geometry.frameWidth,
			geometry.frameHeight,
		);
	}

	return canvasToBlob(canvas, options.format, options.quality);
}

interface ColorCount {
	r: number;
	g: number;
	b: number;
	count: number;
}

interface ColorBox {
	entries: ColorCount[];
	channel: 0 | 1 | 2;
	range: number;
	score: number;
}

function channelValue(color: ColorCount, channel: 0 | 1 | 2): number {
	return channel === 0 ? color.r : channel === 1 ? color.g : color.b;
}

function makeColorBox(entries: ColorCount[]): ColorBox {
	let rMin = 255;
	let gMin = 255;
	let bMin = 255;
	let rMax = 0;
	let gMax = 0;
	let bMax = 0;
	let total = 0;

	for (const entry of entries) {
		if (entry.r < rMin) rMin = entry.r;
		if (entry.r > rMax) rMax = entry.r;
		if (entry.g < gMin) gMin = entry.g;
		if (entry.g > gMax) gMax = entry.g;
		if (entry.b < bMin) bMin = entry.b;
		if (entry.b > bMax) bMax = entry.b;
		total += entry.count;
	}

	const rRange = rMax - rMin;
	const gRange = gMax - gMin;
	const bRange = bMax - bMin;
	let channel: 0 | 1 | 2 = 0;
	let range = rRange;
	if (gRange > range) {
		channel = 1;
		range = gRange;
	}
	if (bRange > range) {
		channel = 2;
		range = bRange;
	}

	return { entries, channel, range, score: range * total };
}

/** Median-cut palette reduction for GIF exports. */
function medianCut(entries: ColorCount[], maxColors: number): ColorCount[] {
	if (entries.length <= maxColors) return entries;

	const boxes: ColorBox[] = [makeColorBox(entries)];

	while (boxes.length < maxColors) {
		let bestIndex = -1;
		let bestScore = 0;
		for (let index = 0; index < boxes.length; index++) {
			const box = boxes[index]!;
			if (box.entries.length < 2 || box.range === 0) continue;
			if (box.score > bestScore) {
				bestScore = box.score;
				bestIndex = index;
			}
		}
		if (bestIndex < 0) break;

		const box = boxes[bestIndex]!;
		const channel = box.channel;
		const sorted = [...box.entries].sort(
			(a, b) => channelValue(a, channel) - channelValue(b, channel),
		);

		let total = 0;
		for (const entry of sorted) total += entry.count;
		const midpoint = total / 2;

		let accumulated = 0;
		let split = 1;
		for (let index = 0; index < sorted.length - 1; index++) {
			accumulated += sorted[index]!.count;
			if (accumulated >= midpoint) {
				split = index + 1;
				break;
			}
			split = index + 2;
		}
		split = clampInt(split, 1, sorted.length - 1);

		boxes.splice(bestIndex, 1, makeColorBox(sorted.slice(0, split)), makeColorBox(sorted.slice(split)));
	}

	return boxes.map((box) => {
		let total = 0;
		let r = 0;
		let g = 0;
		let b = 0;
		for (const entry of box.entries) {
			total += entry.count;
			r += entry.r * entry.count;
			g += entry.g * entry.count;
			b += entry.b * entry.count;
		}
		const inv = total > 0 ? 1 / total : 0;
		return {
			r: Math.round(r * inv),
			g: Math.round(g * inv),
			b: Math.round(b * inv),
			count: total,
		};
	});
}

function collectGifColors(
	background: ExportBackground,
	frameIndices: readonly number[],
	getFrame: (frame: number) => Uint32Array,
): ColorCount[] {
	let exact: Map<number, number> | null = new Map();
	let buckets: Map<number, number> | null = null;

	const backgroundRgb = background === "white" ? 0xffffff : 0x000000;
	const backgroundR = backgroundRgb & 0xff;
	const backgroundG = (backgroundRgb >>> 8) & 0xff;
	const backgroundB = (backgroundRgb >>> 16) & 0xff;

	const add = (r: number, g: number, b: number): void => {
		if (buckets) {
			const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
			buckets.set(key, (buckets.get(key) ?? 0) + 1);
			return;
		}

		const key = (r | (g << 8) | (b << 16)) >>> 0;
		exact!.set(key, (exact!.get(key) ?? 0) + 1);
		if (exact!.size > GIF_MAX_EXACT_COLORS) {
			buckets = new Map();
			for (const [packed, count] of exact!) {
				const kr = packed & 0xff;
				const kg = (packed >>> 8) & 0xff;
				const kb = (packed >>> 16) & 0xff;
				const bucketKey = ((kr >> 3) << 10) | ((kg >> 3) << 5) | (kb >> 3);
				buckets.set(bucketKey, (buckets.get(bucketKey) ?? 0) + count);
			}
			exact = null;
		}
	};

	for (const frameIndex of frameIndices) {
		const pixels = getFrame(frameIndex);
		for (let index = 0; index < pixels.length; index++) {
			const value = pixels[index]!;
			const alpha = value >>> 24;

			if (background === "transparent") {
				if (alpha < 128) continue;
				add(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff);
				continue;
			}

			const t = alpha / 255;
			add(
				Math.round((value & 0xff) * t + backgroundR * (1 - t)),
				Math.round(((value >>> 8) & 0xff) * t + backgroundG * (1 - t)),
				Math.round(((value >>> 16) & 0xff) * t + backgroundB * (1 - t)),
			);
		}
	}

	const colors: ColorCount[] = [];
	if (exact) {
		for (const [packed, count] of exact) {
			colors.push({
				r: packed & 0xff,
				g: (packed >>> 8) & 0xff,
				b: (packed >>> 16) & 0xff,
				count,
			});
		}
		return colors;
	}

	for (const [key, count] of buckets!) {
		const r5 = (key >>> 10) & 31;
		const g5 = (key >>> 5) & 31;
		const b5 = key & 31;
		colors.push({
			r: Math.round((r5 * 255) / 31),
			g: Math.round((g5 * 255) / 31),
			b: Math.round((b5 * 255) / 31),
			count,
		});
	}
	return colors;
}

interface GifPalette {
	colors: { r: number; g: number; b: number }[];
	transparentIndex: number | null;
	tableSize: number;
	exact: Map<number, number>;
	lookup: Uint8Array;
}

function buildGifPalette(
	background: ExportBackground,
	frameIndices: readonly number[],
	getFrame: (frame: number) => Uint32Array,
): GifPalette {
	const transparentIndex = background === "transparent" ? 0 : null;
	const maxColors = transparentIndex === null ? 256 : 255;
	const sourceColors = collectGifColors(background, frameIndices, getFrame);
	const reduced =
		sourceColors.length <= maxColors
			? sourceColors
			: medianCut(sourceColors, maxColors);

	const colors: { r: number; g: number; b: number }[] = [];
	const seen = new Set<number>();
	for (const entry of reduced) {
		const key = (entry.r | (entry.g << 8) | (entry.b << 16)) >>> 0;
		if (seen.has(key)) continue;
		seen.add(key);
		colors.push({ r: entry.r, g: entry.g, b: entry.b });
	}

	const offset = transparentIndex === null ? 0 : 1;
	const exact = new Map<number, number>();
	colors.forEach((color, index) => {
		const key = (color.r | (color.g << 8) | (color.b << 16)) >>> 0;
		if (!exact.has(key)) exact.set(key, index + offset);
	});

	const entries = colors.length + offset;
	let tableSize = 2;
	while (tableSize < Math.max(2, entries)) tableSize <<= 1;

	const lookup = new Uint8Array(32_768);
	for (let key = 0; key < lookup.length; key++) {
		const r = Math.round((((key >>> 10) & 31) * 255) / 31);
		const g = Math.round((((key >>> 5) & 31) * 255) / 31);
		const b = Math.round(((key & 31) * 255) / 31);

		let bestIndex = 0;
		let bestDistance = Number.POSITIVE_INFINITY;
		for (let index = 0; index < colors.length; index++) {
			const color = colors[index]!;
			const dr = r - color.r;
			const dg = g - color.g;
			const db = b - color.b;
			const distance = dr * dr + dg * dg + db * db;
			if (distance < bestDistance) {
				bestDistance = distance;
				bestIndex = index;
			}
		}
		lookup[key] = bestIndex + offset;
	}

	return { colors, transparentIndex, tableSize, exact, lookup };
}

function gifColorIndex(palette: GifPalette, r: number, g: number, b: number): number {
	const key = (r | (g << 8) | (b << 16)) >>> 0;
	const exact = palette.exact.get(key);
	if (exact !== undefined) return exact;
	const bucket = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
	return palette.lookup[bucket]!;
}

function buildFrameIndices(
	doc: PixelDoc,
	frameIndex: number,
	scale: number,
	background: ExportBackground,
	palette: GifPalette,
	getFrame: (frame: number) => Uint32Array,
): Uint8Array {
	const pixels = getFrame(frameIndex);
	const width = doc.width * scale;
	const height = doc.height * scale;
	const indices = new Uint8Array(width * height);

	const sourceX = new Uint16Array(width);
	for (let x = 0; x < width; x++) sourceX[x] = Math.min(doc.width - 1, Math.floor(x / scale));
	const sourceY = new Uint16Array(height);
	for (let y = 0; y < height; y++) sourceY[y] = Math.min(doc.height - 1, Math.floor(y / scale));

	const backgroundRgb = background === "white" ? 0xffffff : 0x000000;
	const backgroundR = backgroundRgb & 0xff;
	const backgroundG = (backgroundRgb >>> 8) & 0xff;
	const backgroundB = (backgroundRgb >>> 16) & 0xff;

	for (let y = 0; y < height; y++) {
		const sourceRow = sourceY[y]! * doc.width;
		const targetRow = y * width;
		for (let x = 0; x < width; x++) {
			const value = pixels[sourceRow + sourceX[x]!]!;
			const alpha = value >>> 24;

			if (background === "transparent") {
				if (alpha < 128) {
					indices[targetRow + x] = palette.transparentIndex!;
					continue;
				}
				indices[targetRow + x] = gifColorIndex(
					palette,
					value & 0xff,
					(value >>> 8) & 0xff,
					(value >>> 16) & 0xff,
				);
				continue;
			}

			const t = alpha / 255;
			indices[targetRow + x] = gifColorIndex(
				palette,
				Math.round((value & 0xff) * t + backgroundR * (1 - t)),
				Math.round(((value >>> 8) & 0xff) * t + backgroundG * (1 - t)),
				Math.round(((value >>> 16) & 0xff) * t + backgroundB * (1 - t)),
			);
		}
	}

	return indices;
}

class ByteWriter {
	private data = new Uint8Array(4096);
	private length = 0;

	private ensure(size: number): void {
		if (this.length + size <= this.data.length) return;
		let capacity = this.data.length;
		while (capacity < this.length + size) capacity *= 2;
		const next = new Uint8Array(capacity);
		next.set(this.data.subarray(0, this.length));
		this.data = next;
	}

	writeByte(value: number): void {
		this.ensure(1);
		this.data[this.length++] = value & 0xff;
	}

	writeUint16(value: number): void {
		this.ensure(2);
		this.data[this.length++] = value & 0xff;
		this.data[this.length++] = (value >>> 8) & 0xff;
	}

	writeBytes(bytes: ArrayLike<number>): void {
		this.ensure(bytes.length);
		this.data.set(bytes, this.length);
		this.length += bytes.length;
	}

	writeString(value: string): void {
		this.ensure(value.length);
		for (let index = 0; index < value.length; index++) {
			this.data[this.length++] = value.charCodeAt(index) & 0xff;
		}
	}

	toUint8Array(): Uint8Array<ArrayBuffer> {
		const copy = new Uint8Array(this.length);
		copy.set(this.data.subarray(0, this.length));
		return copy;
	}
}

class BitWriter {
	private bytes = new Uint8Array(1024);
	private length = 0;
	private bitBuffer = 0;
	private bitCount = 0;

	private ensure(size: number): void {
		if (this.length + size <= this.bytes.length) return;
		let capacity = this.bytes.length;
		while (capacity < this.length + size) capacity *= 2;
		const next = new Uint8Array(capacity);
		next.set(this.bytes.subarray(0, this.length));
		this.bytes = next;
	}

	write(code: number, size: number): void {
		this.bitBuffer |= code << this.bitCount;
		this.bitCount += size;
		while (this.bitCount >= 8) {
			this.ensure(1);
			this.bytes[this.length++] = this.bitBuffer & 0xff;
			this.bitBuffer >>>= 8;
			this.bitCount -= 8;
		}
	}

	finish(): Uint8Array {
		if (this.bitCount > 0) {
			this.ensure(1);
			this.bytes[this.length++] = this.bitBuffer & 0xff;
			this.bitBuffer = 0;
			this.bitCount = 0;
		}
		return this.bytes.slice(0, this.length);
	}
}

function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
	const clearCode = 1 << minCodeSize;
	const endCode = clearCode + 1;
	let nextCode = endCode + 1;
	let codeSize = minCodeSize + 1;
	let dictionary = new Map<number, number>();
	const writer = new BitWriter();

	writer.write(clearCode, codeSize);

	if (indices.length === 0) {
		writer.write(endCode, codeSize);
		return writer.finish();
	}

	let current = indices[0]!;
	for (let index = 1; index < indices.length; index++) {
		const next = indices[index]!;
		const key = (current << 8) | next;
		const existing = dictionary.get(key);
		if (existing !== undefined) {
			current = existing;
			continue;
		}

		writer.write(current, codeSize);

		if (nextCode < 4096) {
			// The decoder is one dictionary entry behind, so grow the code
			// size before assigning the next code.
			if (nextCode >= 1 << codeSize && codeSize < 12) codeSize++;
			dictionary.set(key, nextCode);
			nextCode++;
		} else {
			writer.write(clearCode, codeSize);
			dictionary = new Map();
			nextCode = endCode + 1;
			codeSize = minCodeSize + 1;
		}

		current = next;
	}

	writer.write(current, codeSize);
	writer.write(endCode, codeSize);
	return writer.finish();
}

function writeSubBlocks(writer: ByteWriter, bytes: Uint8Array): void {
	for (let offset = 0; offset < bytes.length; offset += 255) {
		const length = Math.min(255, bytes.length - offset);
		writer.writeByte(length);
		writer.writeBytes(bytes.subarray(offset, offset + length));
	}
	writer.writeByte(0);
}

export function exportGif(doc: PixelDoc, options: GifExportOptions): Blob {
	const scale = clampInt(options.scale, 1, 10);
	const width = doc.width * scale;
	const height = doc.height * scale;
	const fps = clampInt(options.fps, 1, 60);
	const background = options.background;
	const frameIndices = animationFrameIndices(doc, options.loopRange !== false);
	const sizeError = validateExportSize(
		width,
		height,
		frameIndices.length,
		true,
	);
	if (sizeError) throw new Error(sizeError);

	// Palette collection and index building both need every frame. Cache the
	// composited frames when the document is small enough, avoiding a second
	// full composite pass for typical sprites.
	const frameCache =
		doc.width * doc.height * frameIndices.length <= 16_000_000
			? new Map<number, Uint32Array>()
			: null;
	const getFrame = (frame: number): Uint32Array => {
		if (!frameCache) return compositeFrame(doc, frame);
		const cached = frameCache.get(frame);
		if (cached) return cached;
		const pixels = compositeFrame(doc, frame);
		frameCache.set(frame, pixels);
		return pixels;
	};

	const palette = buildGifPalette(background, frameIndices, getFrame);

	const writer = new ByteWriter();
	writer.writeString("GIF89a");
	writer.writeUint16(width);
	writer.writeUint16(height);

	const sizeExponent = Math.log2(palette.tableSize);
	writer.writeByte(0x80 | 0x70 | (sizeExponent - 1));
	writer.writeByte(palette.transparentIndex ?? 0);
	writer.writeByte(0);

	const table = new Uint8Array(palette.tableSize * 3);
	let cursor = palette.transparentIndex === null ? 0 : 3;
	for (const color of palette.colors) {
		table[cursor++] = color.r;
		table[cursor++] = color.g;
		table[cursor++] = color.b;
	}
	writer.writeBytes(table);

	if (options.loop) {
		writer.writeBytes([0x21, 0xff, 0x0b]);
		writer.writeString("NETSCAPE2.0");
		writer.writeBytes([0x03, 0x01, 0x00, 0x00, 0x00]);
	}

	const minCodeSize = Math.max(2, Math.ceil(Math.log2(palette.tableSize)));
	const transparentFlag = palette.transparentIndex === null ? 0 : 1;
	const disposal = palette.transparentIndex === null ? 1 : 2;

	for (const frameIndex of frameIndices) {
		const customDuration = doc.frames[frameIndex]?.duration;
		const duration =
			customDuration !== undefined
				? frameDurationMs(doc, frameIndex)
				: 1000 / fps;
		const delay = Math.max(
			2,
			Math.min(65535, Math.round(duration / 10)),
		);
		writer.writeBytes([
			0x21,
			0xf9,
			0x04,
			(disposal << 2) | transparentFlag,
			delay & 0xff,
			(delay >>> 8) & 0xff,
			palette.transparentIndex ?? 0,
			0x00,
		]);

		writer.writeByte(0x2c);
		writer.writeUint16(0);
		writer.writeUint16(0);
		writer.writeUint16(width);
		writer.writeUint16(height);
		writer.writeByte(0);

		const indices = buildFrameIndices(
			doc,
			frameIndex,
			scale,
			background,
			palette,
			getFrame,
		);
		const compressed = lzwEncode(indices, minCodeSize);
		writer.writeByte(minCodeSize);
		writeSubBlocks(writer, compressed);
	}

	writer.writeByte(0x3b);
	return new Blob([writer.toUint8Array()], { type: "image/gif" });
}
