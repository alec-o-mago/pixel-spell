import { hexToRgb, normalizeHex, rgbToHsv } from "./color.js";
import { uid } from "./doc.js";

/**
 * A compact 32-color palette based on PICO-8 plus a handful of useful
 * low-saturation tones for UI-friendly pixel work.
 */
export const DEFAULT_PALETTE = [
	"#000000",
	"#1d2b53",
	"#7e2553",
	"#008751",
	"#ab5236",
	"#5f574f",
	"#c2c3c7",
	"#fff1e8",
	"#ff004d",
	"#ffa300",
	"#ffec27",
	"#00e436",
	"#29adff",
	"#83769c",
	"#ff77a8",
	"#ffccaa",
	"#291814",
	"#111d35",
	"#422136",
	"#125359",
	"#742f29",
	"#49333b",
	"#a28879",
	"#f3ef7d",
	"#be1250",
	"#ff6c24",
	"#a8e72e",
	"#00b543",
	"#065ab5",
	"#754665",
	"#ff6e59",
	"#ff9d81",
];

export const MAX_PALETTE_COLORS = 256;
export const DEFAULT_PALETTE_ID = "default";
const STORAGE_KEY = "pixel-spell-palettes";

/** How the color list is ordered. `original` is the add/import order. */
export type PaletteSortMode = "original" | "hue" | "saturation" | "lightness";

export interface Palette {
	id: string;
	name: string;
	colors: string[];
	/** Original add/import order, used by the "Original order" sort option. */
	originalColors?: string[];
	/** Last applied sort mode; missing means original order. */
	sortMode?: PaletteSortMode;
	/** The built-in palette cannot be renamed, deleted, or edited. */
	builtin?: boolean;
}

export function createDefaultPalette(): Palette {
	return {
		id: DEFAULT_PALETTE_ID,
		name: "Default",
		colors: [...DEFAULT_PALETTE],
		originalColors: [...DEFAULT_PALETTE],
		sortMode: "original",
		builtin: true,
	};
}

export function isPaletteSortMode(value: unknown): value is PaletteSortMode {
	return (
		value === "original" ||
		value === "hue" ||
		value === "saturation" ||
		value === "lightness"
	);
}

/**
 * Returns a sorted copy of a palette. Sorting is always based on the original
 * add/import order, so choosing another mode does not depend on the previous
 * sort. `original` simply returns a copy of that order.
 */
export function sortPaletteColors(
	colors: string[],
	mode: PaletteSortMode,
): string[] {
	if (mode === "original") return [...colors];

	return colors
		.map((color, index) => {
			const hsv = rgbToHsv(hexToRgb(color));
			const key: [number, number, number] =
				mode === "hue"
					? [hsv.h, hsv.s, hsv.v]
					: mode === "saturation"
						? [hsv.s, hsv.h, hsv.v]
						: [hsv.v, hsv.h, hsv.s];
			return { color, index, key };
		})
		.sort(
			(a, b) =>
				a.key[0] - b.key[0] ||
				a.key[1] - b.key[1] ||
				a.key[2] - b.key[2] ||
				a.index - b.index,
		)
		.map((entry) => entry.color);
}

/** True when both arrays contain the same colors, regardless of order. */
function sameColorSet(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	const set = new Set(a);
	return b.every((color) => set.has(color));
}

function normalizePaletteColors(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const colors: string[] = [];
	for (const entry of value) {
		if (typeof entry !== "string") continue;
		const normalized = normalizeHex(entry);
		if (!normalized || colors.includes(normalized)) continue;
		colors.push(normalized);
		if (colors.length >= MAX_PALETTE_COLORS) break;
	}
	return colors;
}

/** Loads custom palettes from localStorage, always including the built-in palette. */
export function loadPaletteState(): { palettes: Palette[]; activeId: string } {
	const defaultPalette = createDefaultPalette();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return { palettes: [defaultPalette], activeId: DEFAULT_PALETTE_ID };
		}

		const parsed = JSON.parse(raw) as {
			palettes?: unknown;
			activeId?: unknown;
		};
		const palettes: Palette[] = [defaultPalette];
		const usedIds = new Set([DEFAULT_PALETTE_ID]);

		if (Array.isArray(parsed.palettes)) {
			for (const entry of parsed.palettes) {
				if (palettes.length >= 100) break;
				if (!entry || typeof entry !== "object") continue;
				const rawPalette = entry as Partial<Palette>;
				const id =
					typeof rawPalette.id === "string" &&
					rawPalette.id &&
					!usedIds.has(rawPalette.id)
						? rawPalette.id
						: uid("palette");
				if (usedIds.has(id)) continue;
				usedIds.add(id);

				const name =
					typeof rawPalette.name === "string" && rawPalette.name.trim()
						? rawPalette.name.trim().slice(0, 40)
						: `Palette ${palettes.length}`;
				const colors = normalizePaletteColors(rawPalette.colors);
				const savedOriginal = normalizePaletteColors(
					rawPalette.originalColors,
				);
				const originalColors = sameColorSet(colors, savedOriginal)
					? savedOriginal
					: [...colors];
				const sortMode = isPaletteSortMode(rawPalette.sortMode)
					? rawPalette.sortMode
					: "original";
				palettes.push({
					id,
					name,
					colors,
					originalColors,
					sortMode,
				});
			}
		}

		const activeId =
			typeof parsed.activeId === "string" &&
			palettes.some((palette) => palette.id === parsed.activeId)
				? parsed.activeId
				: DEFAULT_PALETTE_ID;
		return { palettes, activeId };
	} catch {
		return { palettes: [defaultPalette], activeId: DEFAULT_PALETTE_ID };
	}
}

/** Persists custom palettes (the built-in palette is recreated on load). */
export function savePaletteState(palettes: Palette[], activeId: string): void {
	try {
		const custom = palettes
			.filter((palette) => !palette.builtin)
			.map((palette) => ({
				id: palette.id,
				name: palette.name,
				colors: [...palette.colors],
				originalColors: [...(palette.originalColors ?? palette.colors)],
				sortMode: palette.sortMode ?? "original",
			}));
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ palettes: custom, activeId }));
	} catch {
		// Storage can be unavailable in private browsing contexts.
	}
}
