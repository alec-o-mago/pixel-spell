import { packColor } from "./color.js";
import type { BackgroundKind, Layer, PixelDoc } from "./types.js";

let idCounter = 0;

export function uid(prefix: string): string {
	idCounter = (idCounter + 1) % 1_000_000;
	return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function createLayer(
	name: string,
	width: number,
	height: number,
	frameCount: number,
): Layer {
	return {
		id: uid("layer"),
		name,
		visible: true,
		locked: false,
		opacity: 1,
		cels: Array.from({ length: frameCount }, () => new Uint32Array(width * height)),
	};
}

export function createDoc(
	width = 32,
	height = 32,
	background: BackgroundKind = "transparent",
): PixelDoc {
	const layer = createLayer(
		background === "transparent" ? "Layer 1" : "Background",
		width,
		height,
		1,
	);

	if (background !== "transparent") {
		layer.cels[0]!.fill(
			packColor(background === "white" ? "#ffffff" : "#000000"),
		);
	}

	return {
		width,
		height,
		fps: 12,
		frames: [{ id: uid("frame") }],
		layers: [layer],
	};
}

/** Deep-clones a document into plain (non-reactive) objects. */
export function cloneDoc(doc: PixelDoc): PixelDoc {
	return {
		width: doc.width,
		height: doc.height,
		fps: doc.fps,
		frames: doc.frames.map((frame) => ({ id: frame.id })),
		layers: doc.layers.map((layer) => ({
			id: layer.id,
			name: layer.name,
			visible: layer.visible,
			locked: layer.locked,
			opacity: layer.opacity,
			cels: layer.cels.map((cel) => new Uint32Array(cel)),
		})),
	};
}

/**
 * 256×256 lookup for `sourceAlpha * layerOpacity / 255`. Index is
 * `(sourceAlpha << 8) | opacityByte`. Keeps the compositing inner loop free of
 * floating point multiplication for the common opaque case.
 */
const ALPHA_PRODUCT = new Uint8Array(256 * 256);
for (let alpha = 0; alpha < 256; alpha++) {
	for (let opacity = 0; opacity < 256; opacity++) {
		ALPHA_PRODUCT[(alpha << 8) | opacity] = Math.round((alpha * opacity) / 255);
	}
}

/** Full alpha blend for the uncommon partially transparent case. */
function blendPixelSlow(
	source: number,
	destination: number,
	sa: number,
): number {
	const saF = sa / 255;
	const daF = (destination >>> 24) / 255;
	const oaF = saF + daF * (1 - saF);
	if (oaF <= 0) return destination;

	const inverse = 1 / oaF;
	const sr = source & 0xff;
	const sg = (source >>> 8) & 0xff;
	const sb = (source >>> 16) & 0xff;
	const dr = destination & 0xff;
	const dg = (destination >>> 8) & 0xff;
	const db = (destination >>> 16) & 0xff;

	const r = ((sr * saF + dr * daF * (1 - saF)) * inverse + 0.5) | 0;
	const g = ((sg * saF + dg * daF * (1 - saF)) * inverse + 0.5) | 0;
	const b = ((sb * saF + db * daF * (1 - saF)) * inverse + 0.5) | 0;
	const a = (oaF * 255 + 0.5) | 0;

	return (((a & 0xff) << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/**
 * Flattens every visible layer of a frame into a single RGBA pixel buffer.
 * The buffer uses the same packed little-endian format as layer cels.
 */
export function compositeFrame(doc: PixelDoc, frameIndex: number): Uint32Array {
	const count = doc.width * doc.height;
	const output = new Uint32Array(count);

	for (const layer of doc.layers) {
		if (!layer.visible || layer.opacity <= 0) continue;
		const cel = layer.cels[frameIndex];
		if (!cel) continue;
		const opacityByte = Math.max(
			0,
			Math.min(255, Math.round(layer.opacity * 255)),
		);

		for (let index = 0; index < count; index++) {
			const source = cel[index]!;
			const sourceAlpha = source >>> 24;
			if (sourceAlpha === 0) continue;
			const sa = ALPHA_PRODUCT[(sourceAlpha << 8) | opacityByte]!;
			if (sa === 0) continue;

			const destination = output[index]!;
			const destinationAlpha = destination >>> 24;
			if (destinationAlpha === 0) {
				output[index] = ((sa << 24) | (source & 0x00ffffff)) >>> 0;
				continue;
			}
			if (sa === 255) {
				output[index] = (0xff000000 | (source & 0x00ffffff)) >>> 0;
				continue;
			}
			output[index] = blendPixelSlow(source, destination, sa);
		}
	}

	return output;
}

/** Composites a single pixel; used by the eyedropper instead of a full frame. */
export function compositePixel(
	doc: PixelDoc,
	frameIndex: number,
	x: number,
	y: number,
): number {
	if (x < 0 || x >= doc.width || y < 0 || y >= doc.height) return 0;
	const index = y * doc.width + x;
	let output = 0;

	for (const layer of doc.layers) {
		if (!layer.visible || layer.opacity <= 0) continue;
		const cel = layer.cels[frameIndex];
		if (!cel) continue;
		const source = cel[index]!;
		const sourceAlpha = source >>> 24;
		if (sourceAlpha === 0) continue;
		const opacityByte = Math.max(
			0,
			Math.min(255, Math.round(layer.opacity * 255)),
		);
		const sa = ALPHA_PRODUCT[(sourceAlpha << 8) | opacityByte]!;
		if (sa === 0) continue;
		const destinationAlpha = output >>> 24;
		if (destinationAlpha === 0) {
			output = ((sa << 24) | (source & 0x00ffffff)) >>> 0;
			continue;
		}
		if (sa === 255) {
			output = (0xff000000 | (source & 0x00ffffff)) >>> 0;
			continue;
		}
		output = blendPixelSlow(source, output, sa);
	}

	return output;
}

interface CompositeCache {
	revision: number;
	frames: Map<number, Uint32Array>;
}

const COMPOSITE_CACHE_LIMIT = 8;
const compositeCaches = new WeakMap<PixelDoc, CompositeCache>();

/**
 * Memoized `compositeFrame` for the viewport and preview. The returned buffer
 * is shared and must be treated as read-only. Caches at most four frames per
 * document and drops everything when the document revision changes.
 */
export function compositeFrameCached(
	doc: PixelDoc,
	frameIndex: number,
	revision: number,
): Uint32Array {
	let cache = compositeCaches.get(doc);
	if (!cache || cache.revision !== revision) {
		cache = { revision, frames: new Map() };
		compositeCaches.set(doc, cache);
	}

	const existing = cache.frames.get(frameIndex);
	if (existing) return existing;

	const pixels = compositeFrame(doc, frameIndex);
	cache.frames.set(frameIndex, pixels);
	if (cache.frames.size > COMPOSITE_CACHE_LIMIT) {
		const oldest = cache.frames.keys().next().value;
		if (oldest !== undefined) cache.frames.delete(oldest);
	}
	return pixels;
}
