/**
 * Canvas size choices offered by the New Project dialog.
 *
 * The square sizes are every power-of-two resolution from 8×8 through
 * 1024×1024. The retro entries are a curated, deduplicated list of common
 * hardware resolutions. When a retro resolution is also a square size, the
 * square entry keeps both labels so the size still appears only once.
 */
export interface CanvasSizePreset {
	/** Stable key used by the dropdown. */
	id: string;
	width: number;
	height: number;
	/** Short human-readable label shown on the right side of the row. */
	name: string;
}

function preset(width: number, height: number, name: string): CanvasSizePreset {
	return { id: `${width}x${height}`, width, height, name };
}

/** Power-of-two square canvases, 8×8 through 1024×1024. */
export const SQUARE_CANVAS_PRESETS: CanvasSizePreset[] = [
	preset(8, 8, "Micro"),
	preset(16, 16, "Tiny"),
	preset(32, 32, "Small"),
	preset(64, 64, "Medium"),
	preset(128, 128, "Large / PICO-8"),
	preset(256, 256, "Extra large / Vectrex"),
	preset(512, 512, "Huge / X68000"),
	preset(1024, 1024, "Massive"),
];

/**
 * Retro hardware resolutions, ordered by width and then height. Sizes that
 * duplicate a square preset are intentionally omitted here; their hardware
 * names live on the square entries above.
 */
export const RETRO_CANVAS_PRESETS: CanvasSizePreset[] = [
	preset(48, 32, "GameKing"),
	preset(96, 64, "Pokémon Mini"),
	preset(128, 48, "TRS-80"),
	preset(128, 64, "Arduboy"),
	preset(160, 96, "Intellivision"),
	preset(160, 102, "Atari Lynx"),
	preset(160, 144, "Game Boy / Game Gear"),
	preset(160, 152, "Neo Geo Pocket"),
	preset(160, 160, "Watara Supervision"),
	preset(160, 192, "Atari 2600"),
	preset(224, 144, "WonderSwan"),
	preset(240, 136, "TIC-80"),
	preset(240, 160, "Game Boy Advance"),
	preset(256, 192, "Master System / ZX Spectrum / MSX"),
	preset(256, 224, "SNES / PC Engine"),
	preset(256, 240, "NES / Famicom"),
	preset(280, 192, "Apple II"),
	preset(320, 192, "Atari 8-bit"),
	preset(320, 200, "Commodore 64 / Amstrad CPC / Atari ST"),
	preset(320, 224, "Genesis / Neo Geo / Saturn"),
	preset(320, 240, "PlayStation / Nintendo 64"),
	preset(320, 256, "Amiga / BBC Micro"),
	preset(352, 240, "PC Engine"),
	preset(384, 224, "Virtual Boy"),
	preset(400, 240, "Nintendo 3DS"),
	preset(480, 272, "PSP"),
	preset(512, 212, "MSX2"),
	preset(512, 342, "Macintosh"),
	preset(512, 448, "SNES (hi-res)"),
	preset(640, 200, "Amstrad CPC (mode 2) / Sharp MZ"),
	preset(640, 256, "BBC Micro (mode 0) / Archimedes"),
	preset(640, 350, "EGA"),
	preset(640, 400, "PC-88 / PC-98"),
	preset(640, 448, "PlayStation 2"),
	preset(640, 480, "FM Towns / Dreamcast"),
	preset(720, 348, "Hercules"),
	preset(720, 400, "VGA text"),
	preset(768, 512, "X68000 (hi-res)"),
];

/** Every offered size, in dropdown order. */
export const CANVAS_SIZE_PRESETS: CanvasSizePreset[] = [
	...SQUARE_CANVAS_PRESETS,
	...RETRO_CANVAS_PRESETS,
];
