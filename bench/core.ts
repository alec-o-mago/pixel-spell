/**
 * Deterministic core benchmarks for Pixel Spell.
 *
 * These exercise the pure editor modules (no DOM). Run with:
 *   node bench/run.mjs
 *
 * The harness bundles this file with rolldown and executes it in Node so the
 * exact TypeScript sources used by the app are measured.
 */
import { MAX_CANVAS_SIZE } from "../src/lib/editor/canvas.js";
import { CANVAS_SIZE_PRESETS } from "../src/lib/editor/canvas-presets.js";
import { packColor } from "../src/lib/editor/color.js";
import {
	cloneDoc,
	compositeFrame,
	createDoc,
	createLayer,
} from "../src/lib/editor/doc.js";
import {
	blurPixels,
	fillPixels,
	gradientPixels,
	jumblePixels,
	paintBrush,
	plotShape,
	sprayPixels,
} from "../src/lib/editor/draw.js";
import { exportGif } from "../src/lib/editor/export.js";
import { parseProject, serializeProject } from "../src/lib/editor/file.js";
import {
	lassoSelectionMask,
	magicWandMask,
	selectionBounds,
} from "../src/lib/editor/selection.js";
import type { MirrorAxis, PixelDoc } from "../src/lib/editor/types.js";

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function makeDoc(
	width: number,
	height: number,
	layerCount: number,
	frameCount: number,
	seed = 1,
): PixelDoc {
	const random = mulberry32(seed);
	const doc = createDoc(width, height);
	doc.frames = Array.from({ length: frameCount }, (_, index) => ({
		id: `frame-${index}`,
	}));
	doc.layers = [];
	for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
		const cels: Uint32Array[] = [];
		for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
			const cel = new Uint32Array(width * height);
			// Sparse pixel-art style content: ~18% coverage, a few flat colors.
			for (let index = 0; index < cel.length; index++) {
				if (random() > 0.18) continue;
				const paletteIndex = Math.floor(random() * 8);
				const alpha = random() > 0.85 ? 128 : 255;
				cel[index] = packColor(
					["#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#ff004d", "#29adff", "#ffec27"][
						paletteIndex
					]!,
					alpha,
				);
			}
			cels.push(cel);
		}
		doc.layers.push({
			id: `layer-${layerIndex}`,
			name: `Layer ${layerIndex + 1}`,
			visible: true,
			locked: false,
			opacity: layerIndex === 1 ? 0.55 : 1,
			cels,
		});
	}
	return doc;
}

function makeFlatCel(width: number, height: number, seed = 2): Uint32Array {
	const random = mulberry32(seed);
	const cel = new Uint32Array(width * height);
	for (let index = 0; index < cel.length; index++) {
		if (random() > 0.45) continue;
		cel[index] = packColor(
			["#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236"][
				Math.floor(random() * 5)
			]!,
			255,
		);
	}
	return cel;
}

function measure(label: string, iterations: number, warmup: number, fn: () => void): number {
	for (let index = 0; index < warmup; index++) fn();
	const samples: number[] = [];
	for (let index = 0; index < iterations; index++) {
		const start = performance.now();
		fn();
		samples.push(performance.now() - start);
	}
	samples.sort((a, b) => a - b);
	const median = samples[Math.floor(samples.length / 2)]!;
	const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
	results[label] = { median, mean, min: samples[0]!, max: samples[samples.length - 1]! };
	return median;
}

const results: Record<string, { median: number; mean: number; min: number; max: number }> = {};

// --- Document compositing -------------------------------------------------
const compositeDoc = makeDoc(512, 512, 4, 6, 7);
measure("compositeFrame 512x512x4 (per frame)", 12, 3, () => {
	for (let frame = 0; frame < compositeDoc.frames.length; frame++) {
		compositeFrame(compositeDoc, frame);
	}
});

const smallCompositeDoc = makeDoc(128, 128, 6, 20, 11);
measure("compositeFrame 128x128x6 (per frame)", 20, 5, () => {
	for (let frame = 0; frame < smallCompositeDoc.frames.length; frame++) {
		compositeFrame(smallCompositeDoc, frame);
	}
});

measure("cloneDoc 512x512x4x6", 8, 2, () => {
	cloneDoc(compositeDoc);
});

// Reference layers must be opt-in for viewport compositing and excluded by default.
{
	const referenceDoc = createDoc(2, 1);
	referenceDoc.layers[0]!.cels[0]!.fill(packColor("#ff0000"));
	const reference = createLayer("Reference", 2, 1, 1, "reference");
	reference.cels[0]!.fill(packColor("#0000ff"));
	referenceDoc.layers.push(reference);

	const exported = compositeFrame(referenceDoc, 0);
	const viewport = compositeFrame(referenceDoc, 0, true);
	if (exported[0] !== packColor("#ff0000")) {
		throw new Error("reference layer leaked into the default composite");
	}
	if (viewport[0] !== packColor("#0000ff")) {
		throw new Error("reference layer missing from the viewport composite");
	}
}



// --- Drawing --------------------------------------------------------------
const width = 512;
const height = 512;
const cel = makeFlatCel(width, height);
const mirrors: MirrorAxis[] = [
	{ kind: "x", position: height / 2 },
	{ kind: "y", position: width / 2 },
];

measure("fillPixels full 512x512", 20, 3, () => {
	const working = new Uint32Array(cel);
	fillPixels(working, width, height, 0, 0, 0xffffffff, 0, true);
});

measure("gradientPixels full 512x512 bayer4", 10, 2, () => {
	const working = new Uint32Array(cel);
	gradientPixels(
		working,
		width,
		height,
		0,
		0,
		width,
		height,
		0xff0000ff,
		0xffff0000,
		0,
		true,
		"linear",
		"bayer4",
	);
});

measure("blurPixels r16 512x512", 20, 3, () => {
	const working = new Uint32Array(cel);
	blurPixels(working, width, height, 256, 256, 16, 50);
});

measure("jumblePixels r16 512x512", 20, 3, () => {
	const working = new Uint32Array(cel);
	jumblePixels(working, width, height, 256, 256, 16, 50);
});

measure("paintBrush 10k stamps size4 + 2 mirrors", 20, 3, () => {
	const working = new Uint32Array(cel);
	for (let index = 0; index < 10_000; index++) {
		paintBrush(
			working,
			width,
			height,
			index % width,
			(index * 7) % height,
			4,
			0xff00ff00,
			mirrors,
		);
	}
});

measure("plotShape star 256x256 outline", 100, 10, () => {
	const working = new Uint32Array(width * height);
	plotShape("star", 32, 32, 288, 288, false, (x, y) => {
		if (x >= 0 && x < width && y >= 0 && y < height) working[y * width + x] = 0xffffffff;
	});
});

measure("sprayPixels r16 400 shots", 50, 5, () => {
	const working = new Uint32Array(cel);
	sprayPixels(working, width, height, 256, 256, 16, 400, 0xff00ff00, mirrors);
});

// --- Selection ------------------------------------------------------------
measure("magicWandMask 512x512", 20, 3, () => {
	magicWandMask(cel, width, height, 10, 10, false);
});

const fullMask = new Uint8Array(width * height).fill(1);
measure("selectionBounds full 512x512", 100, 10, () => {
	selectionBounds(fullMask, width, height);
});

const lassoPoints = Array.from({ length: 240 }, (_, index) => {
	const angle = (index / 240) * Math.PI * 2;
	return { x: 256 + Math.cos(angle) * 200, y: 256 + Math.sin(angle) * 180 };
});
measure("lassoSelectionMask 240 points", 50, 5, () => {
	lassoSelectionMask(lassoPoints, width, height);
});

// --- Project files --------------------------------------------------------
const projectDoc = makeDoc(256, 256, 4, 12, 21);
const palette = [
	"#000000",
	"#1d2b53",
	"#7e2553",
	"#008751",
	"#ab5236",
	"#ff004d",
	"#29adff",
	"#ffec27",
];

let serialized = new Uint8Array();
measure("serializeProject 256x256x4x12", 6, 1, () => {
	serialized = serializeProject(projectDoc, palette, "Benchmark", 3, "layer-0");
});
results["serializeProject bytes"] = {
	median: serialized.byteLength,
	mean: serialized.byteLength,
	min: serialized.byteLength,
	max: serialized.byteLength,
};
measure("parseProject 256x256x4x12", 6, 1, () => {
	const parsed = parseProject(serialized);
	if (!parsed) throw new Error("parseProject failed");
});

function assertProjectRoundtrip(doc: PixelDoc, label: string): void {
	const bytes = serializeProject(doc, palette, label, 0, doc.layers[0]!.id);
	const parsed = parseProject(bytes);
	if (!parsed) throw new Error(`${label}: parse failed`);
	if (parsed.doc.width !== doc.width || parsed.doc.height !== doc.height) {
		throw new Error(`${label}: dimensions changed`);
	}
	if (parsed.doc.layers.length !== doc.layers.length) {
		throw new Error(`${label}: layer count changed`);
	}
	if (parsed.doc.references.length !== doc.references.length) {
		throw new Error(`${label}: reference count changed`);
	}
	if (parsed.doc.frames.length !== doc.frames.length) {
		throw new Error(`${label}: frame count changed`);
	}
	for (let index = 0; index < doc.frames.length; index++) {
		const original = doc.frames[index]!;
		const restored = parsed.doc.frames[index]!;
		if ((original.duration ?? null) !== (restored.duration ?? null)) {
			throw new Error(`${label}: frame duration changed`);
		}
		if ((original.tag ?? "") !== (restored.tag ?? "")) {
			throw new Error(`${label}: frame tag changed`);
		}
	}
	if (
		(doc.loopStart ?? null) !== (parsed.doc.loopStart ?? null) ||
		(doc.loopEnd ?? null) !== (parsed.doc.loopEnd ?? null)
	) {
		throw new Error(`${label}: loop range changed`);
	}
	for (let layerIndex = 0; layerIndex < doc.layers.length; layerIndex++) {
		const originalLayer = doc.layers[layerIndex]!;
		const restoredLayer = parsed.doc.layers[layerIndex]!;
		if (originalLayer.role !== restoredLayer.role) {
			throw new Error(`${label}: layer role changed`);
		}
		if (originalLayer.locked !== restoredLayer.locked) {
			throw new Error(`${label}: layer lock changed`);
		}
		for (let frame = 0; frame < doc.frames.length; frame++) {
			const original = originalLayer.cels[frame]!;
			const restored = restoredLayer.cels[frame]!;
			if (original.length !== restored.length) {
				throw new Error(`${label}: cel length changed`);
			}
			for (let index = 0; index < original.length; index++) {
				if (original[index] !== restored[index]) {
					throw new Error(`${label}: pixel mismatch`);
				}
			}
		}
	}
	for (let index = 0; index < doc.references.length; index++) {
		const original = doc.references[index]!;
		const restored = parsed.doc.references[index]!;
		if (original.id !== restored.id || original.name !== restored.name) {
			throw new Error(`${label}: reference identity changed`);
		}
		if (original.bytes.length !== restored.bytes.length) {
			throw new Error(`${label}: reference byte length changed`);
		}
		for (let byte = 0; byte < original.bytes.length; byte++) {
			if (original.bytes[byte] !== restored.bytes[byte]) {
				throw new Error(`${label}: reference bytes changed`);
			}
		}
		if (
			original.x !== restored.x ||
			original.y !== restored.y ||
			original.width !== restored.width ||
			original.height !== restored.height ||
			original.opacity !== restored.opacity
		) {
			throw new Error(`${label}: reference transform changed`);
		}
	}
}

function assertCanvasSizePresets(): void {
	const keys = new Set<string>();
	for (const preset of CANVAS_SIZE_PRESETS) {
		const key = `${preset.width}x${preset.height}`;
		if (keys.has(key)) throw new Error(`duplicate canvas size preset: ${key}`);
		keys.add(key);
		if (
			preset.width < 1 ||
			preset.height < 1 ||
			preset.width > MAX_CANVAS_SIZE ||
			preset.height > MAX_CANVAS_SIZE
		) {
			throw new Error(`canvas size preset out of range: ${key}`);
		}
	}
	for (let size = 8; size <= 1024; size *= 2) {
		if (!keys.has(`${size}x${size}`)) {
			throw new Error(`missing power-of-two canvas preset: ${size}x${size}`);
		}
	}
}

assertCanvasSizePresets();
assertProjectRoundtrip(makeDoc(64, 64, 2, 3, 41), "sparse");
const opaqueDoc = makeDoc(64, 64, 1, 1, 42);
for (const cel of opaqueDoc.layers[0]!.cels) cel.fill(0xff336699);
assertProjectRoundtrip(opaqueDoc, "flat");

const referenceDoc = makeDoc(64, 64, 2, 3, 43);
referenceDoc.layers[0]!.role = "reference";
referenceDoc.layers[0]!.locked = true;
referenceDoc.references.push({
	id: "reference-1",
	name: "Mood board",
	bytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6, 7, 8]),
	mime: "image/png",
	imageWidth: 1024,
	imageHeight: 768,
	x: -80,
	y: 24,
	width: 128,
	height: 96,
	rotation: 0,
	opacity: 0.75,
	visible: true,
	locked: false,
});
assertProjectRoundtrip(referenceDoc, "reference board");

const timingDoc = makeDoc(32, 32, 2, 4, 44);
timingDoc.frames[0]!.duration = 250;
timingDoc.frames[1]!.tag = "walk";
timingDoc.frames[2]!.tag = "walk";
timingDoc.frames[3]!.duration = 40;
timingDoc.frames[3]!.tag = "run";
timingDoc.loopStart = 1;
timingDoc.loopEnd = 2;
assertProjectRoundtrip(timingDoc, "frame metadata");

// --- GIF export -----------------------------------------------------------
const gifDoc = makeDoc(128, 128, 3, 12, 31);
measure("exportGif 128x128x12", 4, 1, () => {
	const blob = exportGif(gifDoc, {
		scale: 1,
		fps: 12,
		loop: true,
		background: "transparent",
	});
	results["exportGif bytes"] = {
		median: blob.size,
		mean: blob.size,
		min: blob.size,
		max: blob.size,
	};
});

// --- Report ---------------------------------------------------------------
const report = {
	generatedAt: new Date().toISOString(),
	node: process.version,
	results: Object.fromEntries(
		Object.entries(results).map(([label, value]) => [
			label,
			{
				medianMs: Number(value.median.toFixed(3)),
				meanMs: Number(value.mean.toFixed(3)),
				minMs: Number(value.min.toFixed(3)),
				maxMs: Number(value.max.toFixed(3)),
			},
		]),
	),
};

console.log(JSON.stringify(report, null, 2));
