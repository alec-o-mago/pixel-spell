export interface Rgb {
	r: number;
	g: number;
	b: number;
}

export interface Rgba extends Rgb {
	a: number;
}

const HEX_RE = /^#?([0-9a-f]{6})$/i;

/** Accepts `#rrggbb` or `rrggbb` and returns a normalized lowercase hex color. */
export function normalizeHex(input: string): string | null {
	const match = input.trim().match(HEX_RE);
	return match ? `#${match[1].toLowerCase()}` : null;
}

export function hexToRgb(hex: string): Rgb {
	const normalized = normalizeHex(hex) ?? "#000000";
	const value = Number.parseInt(normalized.slice(1), 16);
	return {
		r: (value >> 16) & 0xff,
		g: (value >> 8) & 0xff,
		b: value & 0xff,
	};
}

export function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
	return `#${((1 << 24) | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).slice(1)}`;
}

/** Packs a hex color and alpha into the editor's little-endian RGBA buffer format. */
export function packColor(hex: string, alpha = 255): number {
	const { r, g, b } = hexToRgb(hex);
	return (((alpha & 0xff) << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function unpackColor(value: number): Rgba {
	return {
		r: value & 0xff,
		g: (value >>> 8) & 0xff,
		b: (value >>> 16) & 0xff,
		a: (value >>> 24) & 0xff,
	};
}

export function isTransparent(value: number): boolean {
	return (value >>> 24) === 0;
}

export function colorWithAlpha(hex: string, alpha: number): string {
	const { r, g, b } = hexToRgb(hex);
	const a = Math.max(0, Math.min(1, alpha));
	return `rgba(${r}, ${g}, ${b}, ${a})`;
}
