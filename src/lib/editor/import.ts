import { normalizeHex, rgbToHex } from "./color.js";
import { MAX_PALETTE_COLORS } from "./palette.js";

/** Raster image formats that browsers can generally decode in a canvas. */
export const IMAGE_IMPORT_EXTENSIONS = [
	"png",
	"apng",
	"jpg",
	"jpeg",
	"jfif",
	"gif",
	"webp",
	"bmp",
	"avif",
	"ico",
	"svg",
] as const;

const IMAGE_EXTENSIONS = new Set<string>(IMAGE_IMPORT_EXTENSIONS);
const PALETTE_EXTENSIONS = new Set(["pal", "gpl", "hex"]);

export const IMPORT_ACCEPT = [...IMAGE_IMPORT_EXTENSIONS, ...PALETTE_EXTENSIONS]
	.map((extension) => `.${extension}`)
	.join(",");

/** Imported images are cropped to this many pixels in each dimension. */
export const MAX_IMPORT_DIMENSION = 1024;

/**
 * Palette extraction is exact for normal-sized images. Very large images are
 * sampled down so a single import cannot lock up the tab. Bands span the full
 * width so colors stay in true top-to-bottom, left-to-right appearance order.
 */
const MAX_PALETTE_SCAN_PIXELS = 32_000_000;
const MAX_PALETTE_SCAN_DIMENSION = 8192;
const PALETTE_SCAN_BAND_HEIGHT = 128;

export type ImportTabId = "project" | "palette";

export interface ImportProjectData {
	name: string;
	/** Cropped, importable dimensions (never larger than MAX_IMPORT_DIMENSION). */
	width: number;
	height: number;
	originalWidth: number;
	originalHeight: number;
	/** Packed little-endian RGBA in the editor's cel format. */
	pixels: Uint32Array;
	/** Object URL for the original file, owned by the import dialog. */
	previewUrl: string;
}

export interface ImportPaletteData {
	name: string;
	colors: string[];
	/** True when the source had more than MAX_PALETTE_COLORS unique colors. */
	truncated: boolean;
	source: "png" | "pal" | "gpl" | "hex";
}

export interface ImportAnalysis {
	fileName: string;
	project: ImportProjectData | null;
	palette: ImportPaletteData | null;
	error: string | null;
}

interface ParsedPalette {
	name?: string;
	colors: string[];
	truncated: boolean;
}

interface DecodedImage {
	source: ImageBitmap | HTMLImageElement;
	width: number;
	height: number;
	previewUrl: string;
	close: () => void;
}

const UNSUPPORTED_MESSAGE =
	"This file type can't be imported. Choose an image (PNG, JPEG, GIF, WebP, BMP, AVIF, ICO, SVG) or a palette (JASC .pal, GIMP .gpl, or .hex).";

function fileExtension(name: string): string {
	const base = name.split(/[\\/]/).pop() ?? name;
	const dot = base.lastIndexOf(".");
	return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

function mimeExtension(type: string): string {
	switch (type.toLowerCase()) {
		case "image/png":
			return "png";
		case "image/jpeg":
			return "jpg";
		case "image/gif":
			return "gif";
		case "image/webp":
			return "webp";
		case "image/bmp":
			return "bmp";
		case "image/avif":
			return "avif";
		case "image/x-icon":
		case "image/vnd.microsoft.icon":
			return "ico";
		case "image/svg+xml":
			return "svg";
		default:
			return "";
	}
}

function resolvedExtension(file: File): string {
	return fileExtension(file.name) || mimeExtension(file.type);
}

/** File name without its extension, used as the default import name. */
export function importNameFromFile(name: string): string {
	const base = name.split(/[\\/]/).pop() ?? name;
	const dot = base.lastIndexOf(".");
	const stem = dot > 0 ? base.slice(0, dot) : base;
	return stem.trim() || "Imported";
}

async function decodeImage(file: File): Promise<DecodedImage> {
	const previewUrl = URL.createObjectURL(file);

	try {
		if (typeof createImageBitmap === "function") {
			const bitmap = await createImageBitmap(file);
			if (bitmap.width > 0 && bitmap.height > 0) {
				return {
					source: bitmap,
					width: bitmap.width,
					height: bitmap.height,
					previewUrl,
					close: () => bitmap.close(),
				};
			}
			bitmap.close();
		}
	} catch {
		// Some formats (notably SVG in some browsers) only work through <img>.
	}

	try {
		const image = new Image();
		image.decoding = "async";
		image.src = previewUrl;
		await image.decode();
		const width = image.naturalWidth || image.width;
		const height = image.naturalHeight || image.height;
		if (width <= 0 || height <= 0) throw new Error("Image has no dimensions");
		return {
			source: image,
			width,
			height,
			previewUrl,
			close: () => {},
		};
	} catch (error) {
		URL.revokeObjectURL(previewUrl);
		throw error;
	}
}

function readProjectPixels(
	source: CanvasImageSource,
	width: number,
	height: number,
): { width: number; height: number; pixels: Uint32Array } {
	const cropWidth = Math.max(1, Math.min(width, MAX_IMPORT_DIMENSION));
	const cropHeight = Math.max(1, Math.min(height, MAX_IMPORT_DIMENSION));

	const canvas = document.createElement("canvas");
	canvas.width = cropWidth;
	canvas.height = cropHeight;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context) throw new Error("Canvas 2D is not available");

	context.imageSmoothingEnabled = false;
	context.drawImage(source, 0, 0, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

	const image = context.getImageData(0, 0, cropWidth, cropHeight);
	const pixels = new Uint32Array(cropWidth * cropHeight);
	const view = new Uint32Array(image.data.buffer, image.data.byteOffset, pixels.length);
	pixels.set(view);

	return { width: cropWidth, height: cropHeight, pixels };
}

function collectPaletteColors(
	source: CanvasImageSource,
	width: number,
	height: number,
): { colors: string[]; truncated: boolean } {
	const colors: string[] = [];
	const seen = new Set<number>();
	let truncated = false;

	const totalPixels = width * height;
	const scale = Math.min(
		1,
		Math.sqrt(MAX_PALETTE_SCAN_PIXELS / totalPixels),
		MAX_PALETTE_SCAN_DIMENSION / width,
		MAX_PALETTE_SCAN_DIMENSION / height,
	);
	const scanWidth = Math.max(1, Math.floor(width * scale));
	const scanHeight = Math.max(1, Math.floor(height * scale));
	const scaleY = height / scanHeight;

	const canvas = document.createElement("canvas");
	canvas.width = scanWidth;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context) return { colors, truncated };

	// Full-width bands keep temporary ImageData small while preserving the
	// image's row-major pixel order.
	scan: for (let y = 0; y < scanHeight; y += PALETTE_SCAN_BAND_HEIGHT) {
		const bandHeight = Math.min(PALETTE_SCAN_BAND_HEIGHT, scanHeight - y);
		canvas.height = bandHeight;
		context.imageSmoothingEnabled = false;
		context.drawImage(
			source,
			0,
			y * scaleY,
			width,
			bandHeight * scaleY,
			0,
			0,
			scanWidth,
			bandHeight,
		);

		const data = context.getImageData(0, 0, scanWidth, bandHeight).data;
		for (let index = 0; index < data.length; index += 4) {
			// Fully transparent pixels do not describe a usable palette color.
			if (data[index + 3] === 0) continue;

			const r = data[index]!;
			const g = data[index + 1]!;
			const b = data[index + 2]!;
			const key = (r | (g << 8) | (b << 16)) >>> 0;
			if (seen.has(key)) continue;

			seen.add(key);
			if (colors.length >= MAX_PALETTE_COLORS) {
				truncated = true;
				break scan;
			}
			colors.push(rgbToHex(r, g, b));
		}
	}

	return { colors, truncated };
}

function finalizePalette(rawColors: string[], name?: string): ParsedPalette | null {
	const colors: string[] = [];
	let truncated = false;

	for (const raw of rawColors) {
		const color = normalizeHex(raw);
		if (!color || colors.includes(color)) continue;
		if (colors.length >= MAX_PALETTE_COLORS) {
			truncated = true;
			break;
		}
		colors.push(color);
	}

	if (colors.length === 0) return null;
	return {
		name: name?.trim() || undefined,
		colors,
		truncated,
	};
}

function parseJascPal(text: string): ParsedPalette | null {
	const lines = text
		.replace(/^\uFEFF/, "")
		.split(/\r?\n/)
		.map((line) => line.trim());

	if (lines[0]?.toUpperCase() !== "JASC-PAL") return null;

	const declaredCount = Number.parseInt(lines[2] ?? "", 10);
	const colors: string[] = [];

	for (let index = 3; index < lines.length; index++) {
		const line = lines[index]!;
		if (!line) continue;

		const parts = line.split(/\s+/);
		if (parts.length < 3) continue;

		const r = Number.parseInt(parts[0]!, 10);
		const g = Number.parseInt(parts[1]!, 10);
		const b = Number.parseInt(parts[2]!, 10);
		if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) continue;

		colors.push(rgbToHex(r, g, b));
		if (Number.isFinite(declaredCount) && colors.length >= declaredCount) break;
	}

	return finalizePalette(colors);
}

function parseGimpGpl(text: string): ParsedPalette | null {
	const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
	if (!/^\s*GIMP Palette/i.test(lines[0] ?? "")) return null;

	let name: string | undefined;
	const colors: string[] = [];

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]!.trim();
		if (!line || line.startsWith("#") || index === 0) continue;

		const nameMatch = /^Name:\s*(.+)$/i.exec(line);
		if (nameMatch) {
			name = nameMatch[1]!.trim();
			continue;
		}
		if (/^Columns:/i.test(line)) continue;

		const parts = line.split(/\s+/);
		if (parts.length < 3) continue;

		const r = Number.parseInt(parts[0]!, 10);
		const g = Number.parseInt(parts[1]!, 10);
		const b = Number.parseInt(parts[2]!, 10);
		if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) continue;

		colors.push(rgbToHex(r, g, b));
	}

	return finalizePalette(colors, name);
}

function parseHexToken(token: string): string | null {
	let value = token.trim().toLowerCase();
	if (value.startsWith("#")) value = value.slice(1);
	if (value.startsWith("0x")) value = value.slice(2);

	if (/^[0-9a-f]{3}$/.test(value)) {
		return `#${value[0]}${value[0]}${value[1]}${value[1]}${value[2]}${value[2]}`;
	}
	if (/^[0-9a-f]{6}$/.test(value)) return `#${value}`;
	// Some tools include an alpha channel; palette entries are opaque hex.
	if (/^[0-9a-f]{8}$/.test(value)) return `#${value.slice(0, 6)}`;

	return null;
}

function parseHexPalette(text: string): ParsedPalette | null {
	const colors: string[] = [];

	for (const rawLine of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith(";") || line.startsWith("//")) continue;

		// Accept both "RRGGBB" and "#RRGGBB"; ignore trailing color names.
		const token = line.split(/[\s,]+/)[0]!;
		const color = parseHexToken(token);
		if (color) colors.push(color);
	}

	return finalizePalette(colors);
}

/**
 * Inspects a dropped or selected file and reports every way it can be
 * imported. Files that are not supported return no tabs and an error message.
 */
export async function analyzeImportFile(file: File): Promise<ImportAnalysis> {
	const extension = resolvedExtension(file);
	const isImage = IMAGE_EXTENSIONS.has(extension);
	const isPalette = PALETTE_EXTENSIONS.has(extension);

	let project: ImportProjectData | null = null;
	let palette: ImportPaletteData | null = null;
	let error: string | null = null;

	if (isImage) {
		let decoded: DecodedImage | null = null;
		try {
			decoded = await decodeImage(file);
			const cropped = readProjectPixels(decoded.source, decoded.width, decoded.height);
			project = {
				name: importNameFromFile(file.name),
				width: cropped.width,
				height: cropped.height,
				originalWidth: decoded.width,
				originalHeight: decoded.height,
				pixels: cropped.pixels,
				previewUrl: decoded.previewUrl,
			};

			if (extension === "png") {
				const collected = collectPaletteColors(
					decoded.source,
					decoded.width,
					decoded.height,
				);
				if (collected.colors.length > 0) {
					palette = {
						name: importNameFromFile(file.name),
						colors: collected.colors,
						truncated: collected.truncated,
						source: "png",
					};
				}
			}
		} catch {
			// If decoding or pixel extraction failed there is no project to own
			// the preview URL, so release it immediately.
			if (!project && decoded) URL.revokeObjectURL(decoded.previewUrl);
			error =
				"This image could not be read. It may be corrupted or use a format this browser cannot decode.";
		} finally {
			decoded?.close();
		}
	} else if (isPalette) {
		try {
			const text = await file.text();
			const parsed =
				extension === "gpl"
					? parseGimpGpl(text)
					: extension === "pal"
						? parseJascPal(text)
						: parseHexPalette(text);

			if (parsed) {
				palette = {
					name: parsed.name || importNameFromFile(file.name),
					colors: parsed.colors,
					truncated: parsed.truncated,
					source: extension as "pal" | "gpl" | "hex",
				};
			} else {
				error = `This file could not be read as a ${extension.toUpperCase()} palette.`;
			}
		} catch {
			error = "This palette file could not be read.";
		}
	} else {
		error = UNSUPPORTED_MESSAGE;
	}

	if (!project && !palette) {
		error ??= UNSUPPORTED_MESSAGE;
	}

	return { fileName: file.name, project, palette, error };
}
