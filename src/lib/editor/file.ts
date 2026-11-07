import { normalizeHex } from "./color.js";
import { compositeFrame, uid } from "./doc.js";
import { pixelsToImageData } from "./render.js";
import type { Layer, PixelDoc } from "./types.js";

interface SerializedLayer {
	id: string;
	name: string;
	visible: boolean;
	opacity: number;
	cels: string[];
}

interface SerializedProject {
	format: "pixel-spell";
	version: 1;
	name: string;
	width: number;
	height: number;
	fps: number;
	frameCount: number;
	activeFrame: number;
	activeLayerId: string;
	palette: string[];
	layers: SerializedLayer[];
}

export interface LoadedProject {
	doc: PixelDoc;
	palette?: string[];
	activeFrame: number;
	activeLayerId: string;
	name: string;
}

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));

function encodePixels(pixels: Uint32Array): string {
	const bytes = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
	let binary = "";
	const chunkSize = 0x8000;
	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
	}
	return btoa(binary);
}

function decodePixels(encoded: string, pixelCount: number): Uint32Array {
	const binary = atob(encoded);
	if (binary.length !== pixelCount * 4) {
		throw new Error("Pixel data length mismatch");
	}
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) {
		bytes[index] = binary.charCodeAt(index);
	}
	return new Uint32Array(bytes.buffer);
}

function download(filename: string, url: string): void {
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.rel = "noopener";
	link.click();
}

function fileBase(name: string): string {
	const slug = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "pixel-spell";
}

function pixelsToPngUrl(
	pixels: Uint32Array,
	width: number,
	height: number,
): string {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas 2D is not available");
	context.putImageData(pixelsToImageData(pixels, width, height), 0, 0);
	return canvas.toDataURL("image/png");
}

export function exportFramePng(doc: PixelDoc, frameIndex: number, name: string): void {
	const pixels = compositeFrame(doc, frameIndex);
	download(
		`${fileBase(name)}-frame-${frameIndex + 1}.png`,
		pixelsToPngUrl(pixels, doc.width, doc.height),
	);
}

export function exportSpriteSheetPng(doc: PixelDoc, name: string): void {
	const frames = doc.frames.length;
	const sheetWidth = doc.width * frames;
	const sheetHeight = doc.height;
	const sheet = new Uint32Array(sheetWidth * sheetHeight);

	for (let frame = 0; frame < frames; frame++) {
		const pixels = compositeFrame(doc, frame);
		for (let y = 0; y < doc.height; y++) {
			const sourceOffset = y * doc.width;
			const targetOffset = y * sheetWidth + frame * doc.width;
			sheet.set(pixels.subarray(sourceOffset, sourceOffset + doc.width), targetOffset);
		}
	}

	download(
		`${fileBase(name)}-spritesheet.png`,
		pixelsToPngUrl(sheet, sheetWidth, sheetHeight),
	);
}

export function serializeProject(
	doc: PixelDoc,
	palette: string[],
	name: string,
	activeFrame: number,
	activeLayerId: string,
): string {
	const project: SerializedProject = {
		format: "pixel-spell",
		version: 1,
		name,
		width: doc.width,
		height: doc.height,
		fps: doc.fps,
		frameCount: doc.frames.length,
		activeFrame,
		activeLayerId,
		palette,
		layers: doc.layers.map((layer) => ({
			id: layer.id,
			name: layer.name,
			visible: layer.visible,
			opacity: layer.opacity,
			cels: layer.cels.map(encodePixels),
		})),
	};
	return JSON.stringify(project, null, 2);
}

export function saveProjectFile(
	doc: PixelDoc,
	palette: string[],
	name: string,
	activeFrame: number,
	activeLayerId: string,
): void {
	const json = serializeProject(doc, palette, name, activeFrame, activeLayerId);
	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	download(`${fileBase(name)}.pixelspell.json`, url);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseProject(raw: string): LoadedProject | null {
	try {
		const data = JSON.parse(raw) as Partial<SerializedProject>;
		if (data.format !== "pixel-spell" || !Array.isArray(data.layers)) return null;

		const width = clamp(Math.round(Number(data.width) || 0), 1, 256);
		const height = clamp(Math.round(Number(data.height) || 0), 1, 256);
		const frameCount = clamp(Math.round(Number(data.frameCount) || 1), 1, 120);
		const fps = clamp(Math.round(Number(data.fps) || 12), 1, 60);
		const pixelCount = width * height;

		const layers: Layer[] = data.layers.map((rawLayer, index) => {
			const cels = Array.from({ length: frameCount }, (_, frame) => {
				const encoded = rawLayer?.cels?.[frame];
				if (typeof encoded !== "string") {
					throw new Error("Missing cel data");
				}
				return decodePixels(encoded, pixelCount);
			});

			return {
				id: typeof rawLayer?.id === "string" ? rawLayer.id : uid("layer"),
				name:
					typeof rawLayer?.name === "string" && rawLayer.name.trim()
						? rawLayer.name
						: `Layer ${index + 1}`,
				visible: rawLayer?.visible !== false,
				locked: false,
				opacity: clamp(Number(rawLayer?.opacity ?? 1), 0, 1),
				cels,
			};
		});

		if (layers.length === 0) return null;

		const palette = Array.isArray(data.palette)
			? data.palette
					.map((color) => (typeof color === "string" ? normalizeHex(color) : null))
					.filter((color): color is string => color !== null)
			: undefined;

		return {
			doc: {
				width,
				height,
				fps,
				frames: Array.from({ length: frameCount }, () => ({ id: uid("frame") })),
				layers,
			},
			palette: palette?.length ? palette : undefined,
			activeFrame: clamp(Math.round(Number(data.activeFrame) || 0), 0, frameCount - 1),
			activeLayerId:
				typeof data.activeLayerId === "string" ? data.activeLayerId : layers[0]!.id,
			name: typeof data.name === "string" ? data.name : "Untitled",
		};
	} catch {
		return null;
	}
}

export async function readProjectFile(file: File): Promise<LoadedProject | null> {
	const text = await file.text();
	return parseProject(text);
}
