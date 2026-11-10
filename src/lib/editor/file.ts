import { normalizeHex } from "./color.js";
import { uid } from "./doc.js";
import type { Layer, PixelDoc } from "./types.js";

interface SerializedLayer {
	id: string;
	name: string;
	visible: boolean;
	locked: boolean;
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

export function fileBase(name: string): string {
	const slug = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "pixel-spell";
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
			locked: layer.locked,
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
	download(`${fileBase(name)}.pixelspell`, url);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseProject(raw: string): LoadedProject | null {
	try {
		const data = JSON.parse(raw) as Partial<SerializedProject>;
		if (data.format !== "pixel-spell" || !Array.isArray(data.layers)) return null;

		const width = clamp(Math.round(Number(data.width) || 0), 1, 1024);
		const height = clamp(Math.round(Number(data.height) || 0), 1, 1024);
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
				locked: rawLayer?.locked === true,
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
