import type { Layer, PixelDoc } from "./types.js";

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

export function createDoc(width = 32, height = 32): PixelDoc {
	return {
		width,
		height,
		fps: 12,
		frames: [{ id: uid("frame") }],
		layers: [createLayer("Layer 1", width, height, 1)],
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
		const opacity = layer.opacity;

		for (let i = 0; i < count; i++) {
			const src = cel[i];
			const srcAlpha = (src >>> 24) / 255;
			if (srcAlpha === 0) continue;

			const sa = srcAlpha * opacity;
			const dst = output[i];
			const da = (dst >>> 24) / 255;
			const oa = sa + da * (1 - sa);
			if (oa <= 0) continue;

			const sr = src & 0xff;
			const sg = (src >>> 8) & 0xff;
			const sb = (src >>> 16) & 0xff;

			if (da === 0) {
				output[i] =
					(((Math.round(sa * 255) & 0xff) << 24) | (sb << 16) | (sg << 8) | sr) >>> 0;
				continue;
			}

			const dr = dst & 0xff;
			const dg = (dst >>> 8) & 0xff;
			const db = (dst >>> 16) & 0xff;

			const r = Math.round((sr * sa + dr * da * (1 - sa)) / oa);
			const g = Math.round((sg * sa + dg * da * (1 - sa)) / oa);
			const b = Math.round((sb * sa + db * da * (1 - sa)) / oa);

			output[i] =
				(((Math.round(oa * 255) & 0xff) << 24) | (b << 16) | (g << 8) | r) >>> 0;
		}
	}

	return output;
}
