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

export interface Hsv {
	/** Hue in degrees, 0..360. */
	h: number;
	/** Saturation, 0..1. */
	s: number;
	/** Value/brightness, 0..1. */
	v: number;
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const delta = max - min;

	let h = 0;
	if (delta !== 0) {
		if (max === rn) h = ((gn - bn) / delta) % 6;
		else if (max === gn) h = (bn - rn) / delta + 2;
		else h = (rn - gn) / delta + 4;
		h *= 60;
		if (h < 0) h += 360;
	}

	return { h, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToRgb(h: number, s: number, v: number): Rgb {
	const hue = ((h % 360) + 360) % 360;
	const saturation = Math.max(0, Math.min(1, s));
	const value = Math.max(0, Math.min(1, v));
	const chroma = value * saturation;
	const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
	const m = value - chroma;

	let rp = 0;
	let gp = 0;
	let bp = 0;
	if (hue < 60) {
		rp = chroma;
		gp = x;
	} else if (hue < 120) {
		rp = x;
		gp = chroma;
	} else if (hue < 180) {
		gp = chroma;
		bp = x;
	} else if (hue < 240) {
		gp = x;
		bp = chroma;
	} else if (hue < 300) {
		rp = x;
		bp = chroma;
	} else {
		rp = chroma;
		bp = x;
	}

	return { r: (rp + m) * 255, g: (gp + m) * 255, b: (bp + m) * 255 };
}
