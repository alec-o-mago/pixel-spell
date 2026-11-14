import { MAX_CANVAS_SIZE } from "./canvas.js";
import { normalizeHex } from "./color.js";
import { MAX_FRAME_DURATION, MIN_FRAME_DURATION, uid } from "./doc.js";
import {
	MAX_REFERENCE_BYTES,
	MAX_REFERENCE_COUNT,
	MAX_TOTAL_REFERENCE_BYTES,
} from "./reference.js";
import type { Frame, Layer, PixelDoc, ReferenceImage } from "./types.js";

export interface LoadedProject {
	doc: PixelDoc;
	palette?: string[];
	activeFrame: number;
	activeLayerId: string;
	name: string;
}

const MAGIC = [0x50, 0x58, 0x53, 0x50]; // "PXSP"
/** Only the current format is accepted; this app has no released legacy files. */
const FORMAT_VERSION = 2;
const METHOD_RAW = 0;
const METHOD_RLE = 1;
const HEADER_SIZE = 4 + 1 + 1 + 2 + 2 + 1 + 2 + 2 + 4;
export const MAX_PROJECT_LAYERS = 1024;
export const MAX_PROJECT_FRAMES = 1000;
/** Refuse pathological files before allocating their cel buffers. */
const MAX_TOTAL_CEL_BYTES = 512 * 1024 * 1024;
const MAX_PROJECT_FILE_BYTES = 512 * 1024 * 1024;

interface ProjectMeta {
	name: string;
	palette: string[];
	activeFrame: number;
	activeLayerId: string;
	frames?: { duration?: number; tag?: string }[];
	loopStart?: number;
	loopEnd?: number;
	layers: {
		id: string;
		name: string;
		visible: boolean;
		locked: boolean;
		opacity: number;
		role?: "reference";
	}[];
}

interface ReferenceMeta {
	id: string;
	name: string;
	mime: string;
	imageWidth: number;
	imageHeight: number;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	opacity: number;
	visible: boolean;
	locked: boolean;
	byteLength: number;
}

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));

/**
 * Run-length encodes a cel. Pixel art is dominated by flat transparent and
 * repeated-color runs, so this is usually much smaller than raw RGBA.
 */
function encodeCelRle(pixels: Uint32Array): Uint8Array {
	let runCount = 0;
	for (let index = 0; index < pixels.length; ) {
		const value = pixels[index]!;
		let end = index + 1;
		while (
			end < pixels.length &&
			pixels[end] === value &&
			end - index < 0xffff
		) {
			end++;
		}
		runCount++;
		index = end;
	}

	const output = new Uint8Array(runCount * 6);
	let offset = 0;
	for (let index = 0; index < pixels.length; ) {
		const value = pixels[index]!;
		let end = index + 1;
		while (
			end < pixels.length &&
			pixels[end] === value &&
			end - index < 0xffff
		) {
			end++;
		}
		const count = end - index;
		output[offset] = count & 0xff;
		output[offset + 1] = (count >>> 8) & 0xff;
		output[offset + 2] = value & 0xff;
		output[offset + 3] = (value >>> 8) & 0xff;
		output[offset + 4] = (value >>> 16) & 0xff;
		output[offset + 5] = (value >>> 24) & 0xff;
		offset += 6;
		index = end;
	}
	return output;
}

interface EncodedCel {
	method: number;
	bytes: Uint8Array;
}

function encodeCel(pixels: Uint32Array): EncodedCel {
	const raw = new Uint8Array(
		pixels.buffer,
		pixels.byteOffset,
		pixels.byteLength,
	);
	const rle = encodeCelRle(pixels);
	if (rle.length < raw.length) {
		return { method: METHOD_RLE, bytes: rle };
	}
	return { method: METHOD_RAW, bytes: raw };
}

function decodeCel(
	bytes: Uint8Array,
	offset: number,
	length: number,
	method: number,
	pixelCount: number,
): { pixels: Uint32Array; nextOffset: number } {
	const end = offset + length;
	if (end > bytes.length) throw new Error("Cel data is truncated");

	if (method === METHOD_RAW) {
		if (length !== pixelCount * 4) throw new Error("Raw cel length mismatch");
		const pixels = new Uint32Array(pixelCount);
		new Uint8Array(pixels.buffer).set(bytes.subarray(offset, end));
		return { pixels, nextOffset: end };
	}

	if (method !== METHOD_RLE) throw new Error("Unknown cel encoding");
	const pixels = new Uint32Array(pixelCount);
	let written = 0;
	let cursor = offset;
	while (written < pixelCount) {
		if (cursor + 6 > end) throw new Error("RLE cel is truncated");
		const count = bytes[cursor]! | (bytes[cursor + 1]! << 8);
		const value =
			(bytes[cursor + 2]! |
				(bytes[cursor + 3]! << 8) |
				(bytes[cursor + 4]! << 16) |
				(bytes[cursor + 5]! << 24)) >>>
			0;
		cursor += 6;
		if (count === 0 || written + count > pixelCount) {
			throw new Error("Invalid RLE run");
		}
		if (count <= 16) {
			for (let index = 0; index < count; index++) {
				pixels[written + index] = value;
			}
		} else {
			pixels.fill(value, written, written + count);
		}
		written += count;
	}
	if (cursor !== end) throw new Error("RLE cel has trailing data");
	return { pixels, nextOffset: end };
}

function download(filename: string, url: string): void {
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.rel = "noopener";
	// Safari and some embedded browsers only honor programmatic downloads for
	// anchors that are attached to the document.
	document.body.appendChild(link);
	link.click();
	link.remove();
}

export function fileBase(name: string): string {
	const slug = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "pixel-spell";
}

/** Serializes a project to the compact binary container. */
export function serializeProject(
	doc: PixelDoc,
	palette: string[],
	name: string,
	activeFrame: number,
	activeLayerId: string,
): Uint8Array<ArrayBuffer> {
	const frameCount = doc.frames.length;
	const layerCount = doc.layers.length;
	if (
		frameCount < 1 ||
		frameCount > MAX_PROJECT_FRAMES ||
		layerCount < 1 ||
		layerCount > MAX_PROJECT_LAYERS
	) {
		throw new Error(
			`Projects are limited to ${MAX_PROJECT_LAYERS} layers and ${MAX_PROJECT_FRAMES} frames.`,
		);
	}
	if (doc.references.length > MAX_REFERENCE_COUNT) {
		throw new Error(`Projects are limited to ${MAX_REFERENCE_COUNT} reference board images.`);
	}

	const meta: ProjectMeta = {
		name,
		palette,
		activeFrame,
		activeLayerId,
		frames: doc.frames.map((frame) => ({
			...(frame.duration !== undefined ? { duration: frame.duration } : {}),
			...(frame.tag ? { tag: frame.tag } : {}),
		})),
		...(doc.loopStart !== undefined ? { loopStart: doc.loopStart } : {}),
		...(doc.loopEnd !== undefined ? { loopEnd: doc.loopEnd } : {}),
		layers: doc.layers.map((layer) => ({
			id: layer.id,
			name: layer.name,
			visible: layer.visible,
			locked: layer.locked,
			opacity: layer.opacity,
			...(layer.role ? { role: layer.role } : {}),
		})),
	};
	const metaBytes = new TextEncoder().encode(JSON.stringify(meta));

	const cels: EncodedCel[] = [];
	for (const layer of doc.layers) {
		for (let frame = 0; frame < frameCount; frame++) {
			const cel =
				layer.cels[frame] ?? new Uint32Array(doc.width * doc.height);
			cels.push(encodeCel(cel));
		}
	}

	let referenceBytes = 0;
	const referenceMeta: ReferenceMeta[] = doc.references.map((reference) => {
		if (reference.bytes.length > MAX_REFERENCE_BYTES) {
			throw new Error(
				`"${reference.name}" is too large to embed in a project file (limit ${Math.round(MAX_REFERENCE_BYTES / (1024 * 1024))} MB per reference).`,
			);
		}
		referenceBytes += reference.bytes.length;
		return {
			id: reference.id,
			name: reference.name,
			mime: reference.mime,
			imageWidth: reference.imageWidth,
			imageHeight: reference.imageHeight,
			x: reference.x,
			y: reference.y,
			width: reference.width,
			height: reference.height,
			rotation: reference.rotation,
			opacity: reference.opacity,
			visible: reference.visible,
			locked: reference.locked,
			byteLength: reference.bytes.length,
		};
	});
	if (referenceBytes > MAX_TOTAL_REFERENCE_BYTES) {
		throw new Error(
			`Reference board images exceed the ${Math.round(MAX_TOTAL_REFERENCE_BYTES / (1024 * 1024))} MB project limit.`,
		);
	}
	const referenceMetaBytes = new TextEncoder().encode(
		JSON.stringify(referenceMeta),
	);

	let total = HEADER_SIZE + metaBytes.length;
	for (const cel of cels) total += 1 + 4 + cel.bytes.length;
	total += 4 + referenceMetaBytes.length;
	for (const reference of doc.references) total += 4 + reference.bytes.length;
	if (total > 2_000_000_000) {
		throw new Error("This project is too large to save as a single file.");
	}

	const buffer = new ArrayBuffer(total);
	const view = new DataView(buffer);
	const bytes = new Uint8Array(buffer);
	let offset = 0;

	bytes.set(MAGIC, offset);
	offset += 4;
	view.setUint8(offset++, FORMAT_VERSION);
	view.setUint8(offset++, 0); // reserved flags
	view.setUint16(offset, doc.width, true);
	offset += 2;
	view.setUint16(offset, doc.height, true);
	offset += 2;
	view.setUint8(offset++, doc.fps);
	view.setUint16(offset, frameCount, true);
	offset += 2;
	view.setUint16(offset, layerCount, true);
	offset += 2;
	view.setUint32(offset, metaBytes.length, true);
	offset += 4;

	bytes.set(metaBytes, offset);
	offset += metaBytes.length;

	for (const cel of cels) {
		view.setUint8(offset++, cel.method);
		view.setUint32(offset, cel.bytes.length, true);
		offset += 4;
		bytes.set(cel.bytes, offset);
		offset += cel.bytes.length;
	}

	view.setUint32(offset, referenceMetaBytes.length, true);
	offset += 4;
	bytes.set(referenceMetaBytes, offset);
	offset += referenceMetaBytes.length;
	for (const reference of doc.references) {
		view.setUint32(offset, reference.bytes.length, true);
		offset += 4;
		bytes.set(reference.bytes, offset);
		offset += reference.bytes.length;
	}

	return bytes;
}

export function saveProjectFile(
	doc: PixelDoc,
	palette: string[],
	name: string,
	activeFrame: number,
	activeLayerId: string,
): void {
	const bytes = serializeProject(
		doc,
		palette,
		name,
		activeFrame,
		activeLayerId,
	);
	const blob = new Blob([bytes], { type: "application/octet-stream" });
	const url = URL.createObjectURL(blob);
	download(`${fileBase(name)}.pixelspell`, url);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizePalette(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const palette: string[] = [];
	let scanned = 0;
	for (const entry of value) {
		if (++scanned > 10_000) break;
		if (typeof entry !== "string") continue;
		const color = normalizeHex(entry);
		if (!color || palette.includes(color)) continue;
		palette.push(color);
		if (palette.length >= 256) break;
	}
	return palette.length > 0 ? palette : undefined;
}

function parseProjectBinary(bytes: Uint8Array): LoadedProject | null {
	if (bytes.length < HEADER_SIZE) return null;
	for (let index = 0; index < MAGIC.length; index++) {
		if (bytes[index] !== MAGIC[index]) return null;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let offset = 4;
	const version = view.getUint8(offset++);
	if (version !== FORMAT_VERSION) return null;
	offset++; // reserved flags

	const width = view.getUint16(offset, true);
	offset += 2;
	const height = view.getUint16(offset, true);
	offset += 2;
	const fps = clamp(view.getUint8(offset++), 1, 60);
	const frameCount = view.getUint16(offset, true);
	offset += 2;
	const layerCount = view.getUint16(offset, true);
	offset += 2;
	const metaLength = view.getUint32(offset, true);
	offset += 4;

	if (
		width < 1 ||
		width > MAX_CANVAS_SIZE ||
		height < 1 ||
		height > MAX_CANVAS_SIZE ||
		frameCount < 1 ||
		frameCount > MAX_PROJECT_FRAMES ||
		layerCount < 1 ||
		layerCount > MAX_PROJECT_LAYERS ||
		metaLength > bytes.length - offset
	) {
		return null;
	}

	let meta: ProjectMeta;
	try {
		const text = new TextDecoder().decode(
			bytes.subarray(offset, offset + metaLength),
		);
		meta = JSON.parse(text) as ProjectMeta;
	} catch {
		return null;
	}
	offset += metaLength;
	if (!meta || !Array.isArray(meta.layers) || meta.layers.length !== layerCount) {
		return null;
	}

	const pixelCount = width * height;
	if (pixelCount * 4 * frameCount * layerCount > MAX_TOTAL_CEL_BYTES) {
		return null;
	}
	const layers: Layer[] = [];
	const usedLayerIds = new Set<string>();
	for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
		const rawLayer = meta.layers[layerIndex];
		if (!rawLayer || typeof rawLayer !== "object") return null;
		const cels: Uint32Array[] = [];
		for (let frame = 0; frame < frameCount; frame++) {
			if (offset + 5 > bytes.length) return null;
			const method = view.getUint8(offset++);
			const length = view.getUint32(offset, true);
			offset += 4;
			if (length > bytes.length - offset) return null;
			const decoded = decodeCel(
				bytes,
				offset,
				length,
				method,
				pixelCount,
			);
			cels.push(decoded.pixels);
			offset = decoded.nextOffset;
		}

		let id =
			typeof rawLayer.id === "string" && rawLayer.id ? rawLayer.id : uid("layer");
		if (usedLayerIds.has(id)) id = uid("layer");
		usedLayerIds.add(id);

		layers.push({
			id,
			name:
				typeof rawLayer.name === "string" && rawLayer.name.trim()
					? rawLayer.name
					: `Layer ${layerIndex + 1}`,
			visible: rawLayer.visible !== false,
			locked: rawLayer.locked === true,
			opacity: clamp(Number(rawLayer.opacity ?? 1), 0, 1),
			cels,
			...(rawLayer.role === "reference" ? { role: "reference" as const } : {}),
		});
	}

	if (offset + 4 > bytes.length) return null;
	const referenceMetaLength = view.getUint32(offset, true);
	offset += 4;
	if (referenceMetaLength > bytes.length - offset) return null;

	let referenceMeta: ReferenceMeta[];
	try {
		referenceMeta = JSON.parse(
			new TextDecoder().decode(
				bytes.subarray(offset, offset + referenceMetaLength),
			),
		) as ReferenceMeta[];
	} catch {
		return null;
	}
	offset += referenceMetaLength;
	if (!Array.isArray(referenceMeta) || referenceMeta.length > MAX_REFERENCE_COUNT) {
		return null;
	}

	const references: ReferenceImage[] = [];
	let totalReferenceBytes = 0;
	for (const rawReference of referenceMeta) {
		if (!rawReference || typeof rawReference !== "object") return null;
		if (offset + 4 > bytes.length) return null;
		const length = view.getUint32(offset, true);
		offset += 4;
		if (
			length !== rawReference.byteLength ||
			length > MAX_REFERENCE_BYTES ||
			length > bytes.length - offset
		) {
			return null;
		}
		totalReferenceBytes += length;
		if (totalReferenceBytes > MAX_TOTAL_REFERENCE_BYTES) return null;

		const imageWidth = clamp(
			Math.round(Number(rawReference.imageWidth) || 1),
			1,
			16384,
		);
		const imageHeight = clamp(
			Math.round(Number(rawReference.imageHeight) || 1),
			1,
			16384,
		);
		const width = clamp(
			Number.isFinite(Number(rawReference.width))
				? Math.round(Number(rawReference.width))
				: imageWidth,
			1,
			16384,
		);
		const height = clamp(
			Number.isFinite(Number(rawReference.height))
				? Math.round(Number(rawReference.height))
				: imageHeight,
			1,
			16384,
		);

		references.push({
			id:
				typeof rawReference.id === "string" && rawReference.id
					? rawReference.id
					: uid("reference"),
			name:
				typeof rawReference.name === "string" && rawReference.name.trim()
					? rawReference.name
					: `Reference ${references.length + 1}`,
			bytes: bytes.slice(offset, offset + length),
			mime:
				typeof rawReference.mime === "string" && rawReference.mime
					? rawReference.mime.slice(0, 120)
					: "image/png",
			imageWidth,
			imageHeight,
			x: Number.isFinite(Number(rawReference.x)) ? Number(rawReference.x) : 0,
			y: Number.isFinite(Number(rawReference.y)) ? Number(rawReference.y) : 0,
			width,
			height,
			rotation: Number.isFinite(Number(rawReference.rotation))
				? Number(rawReference.rotation)
				: 0,
			opacity: clamp(Number(rawReference.opacity ?? 1), 0, 1),
			visible: rawReference.visible !== false,
			locked: rawReference.locked === true,
		});
		offset += length;
	}

	if (offset !== bytes.length) return null;

	const activeFrame = clamp(
		Math.round(Number(meta.activeFrame) || 0),
		0,
		frameCount - 1,
	);
	const activeLayerId =
		typeof meta.activeLayerId === "string" &&
		layers.some((layer) => layer.id === meta.activeLayerId)
			? meta.activeLayerId
			: layers[0]!.id;

	const rawFrames = Array.isArray(meta.frames) ? meta.frames : [];
	const frames: Frame[] = Array.from({ length: frameCount }, (_, index) => {
		const frame: Frame = { id: uid("frame") };
		const raw = rawFrames[index];
		if (raw && typeof raw === "object") {
			const duration = Number(raw.duration);
			if (Number.isFinite(duration)) {
				frame.duration = clamp(
					Math.round(duration),
					MIN_FRAME_DURATION,
					MAX_FRAME_DURATION,
				);
			}
			if (typeof raw.tag === "string") {
				const tag = raw.tag.trim().slice(0, 40);
				if (tag) frame.tag = tag;
			}
		}
		return frame;
	});

	const rawLoopStart = Number(meta.loopStart);
	const rawLoopEnd = Number(meta.loopEnd);
	let loopStart: number | undefined;
	let loopEnd: number | undefined;
	if (Number.isFinite(rawLoopStart) && Number.isFinite(rawLoopEnd)) {
		const start = clamp(Math.round(rawLoopStart), 0, frameCount - 1);
		const end = clamp(Math.round(rawLoopEnd), 0, frameCount - 1);
		loopStart = Math.min(start, end);
		loopEnd = Math.max(start, end);
	}

	return {
		doc: {
			width,
			height,
			fps,
			frames,
			layers,
			references,
			...(loopStart !== undefined ? { loopStart } : {}),
			...(loopEnd !== undefined ? { loopEnd } : {}),
		},
		palette: normalizePalette(meta.palette),
		activeFrame,
		activeLayerId,
		name: typeof meta.name === "string" ? meta.name : "Untitled",
	};
}

/** Parses a binary PXSP project. */
export function parseProject(
	raw: ArrayBuffer | Uint8Array,
): LoadedProject | null {
	const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
	if (bytes.length < HEADER_SIZE) return null;
	for (let index = 0; index < MAGIC.length; index++) {
		if (bytes[index] !== MAGIC[index]) return null;
	}
	try {
		return parseProjectBinary(bytes);
	} catch {
		return null;
	}
}

export async function readProjectFile(file: File): Promise<LoadedProject | null> {
	if (file.size > MAX_PROJECT_FILE_BYTES) return null;
	const buffer = await file.arrayBuffer();
	return parseProject(buffer);
}
