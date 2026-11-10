import type { ToolId } from "./types.js";

export interface ToolDef {
	id: ToolId;
	label: string;
	description: string;
	shortcut: string;
}

export const TOOLS: ToolDef[] = [
	{
		id: "pan",
		label: "Pan",
		description: "Drag the canvas to pan around",
		shortcut: "H",
	},
	{
		id: "zoom",
		label: "Zoom",
		description: "Left-click to zoom in, right-click to zoom out; the view moves halfway toward the clicked point",
		shortcut: "Z",
	},
	{
		id: "magic-wand",
		label: "Magic wand",
		description: "Select a connected area of matching pixels",
		shortcut: "W",
	},
	{
		id: "shape-select",
		label: "Shape select",
		description: "Select a rectangle, ellipse, star, or heart",
		shortcut: "M",
	},
	{
		id: "lasso",
		label: "Lasso",
		description: "Draw a freehand or polygonal selection",
		shortcut: "Q",
	},
	{
		id: "select-color",
		label: "Select by color",
		description: "Select every pixel matching the clicked color",
		shortcut: "C",
	},
	{
		id: "pencil",
		label: "Pencil",
		description: "Draw freehand pixels",
		shortcut: "B",
	},
	{
		id: "spray",
		label: "Spray",
		description: "Scatter random pixels in a round area",
		shortcut: "S",
	},
	{
		id: "eraser",
		label: "Eraser",
		description: "Erase pixels to transparency",
		shortcut: "E",
	},
	{
		id: "line",
		label: "Line",
		description: "Draw a straight line",
		shortcut: "L",
	},
	{
		id: "curve",
		label: "Curve",
		description: "Drag a base line, then click twice to bend it",
		shortcut: "U",
	},
	{
		id: "shape",
		label: "Shape",
		description: "Draw a rectangle, ellipse, star, or heart",
		shortcut: "R",
	},
	{
		id: "fill",
		label: "Fill",
		description: "Fill a connected area with color",
		shortcut: "G",
	},
	{
		id: "gradient",
		label: "Gradient",
		description: "Fill an area with a linear or radial gradient",
		shortcut: "D",
	},
	{
		id: "eyedropper",
		label: "Eyedropper",
		description: "Pick a color from the canvas",
		shortcut: "I",
	},
	{
		id: "blur",
		label: "Blur",
		description: "Soften pixels in a round area",
		shortcut: "K",
	},
	{
		id: "jumble",
		label: "Jumble",
		description: "Scramble pixels in a round area",
		shortcut: "J",
	},
];

export const TOOL_BY_ID = Object.fromEntries(
	TOOLS.map((tool) => [tool.id, tool]),
) as Record<ToolId, ToolDef>;

export const TOOL_SHORTCUTS = Object.fromEntries(
	TOOLS.filter((tool) => !tool.shortcut.startsWith("⇧")).map((tool) => [
		tool.shortcut.toLowerCase(),
		tool.id,
	]),
) as Record<string, ToolId>;

export const TOOL_SHIFT_SHORTCUTS = Object.fromEntries(
	TOOLS.filter((tool) => tool.shortcut.startsWith("⇧")).map((tool) => [
		tool.shortcut.slice(1).toLowerCase(),
		tool.id,
	]),
) as Record<string, ToolId>;

const SELECTION_TOOL_IDS = new Set<ToolId>([
	"magic-wand",
	"shape-select",
	"lasso",
	"select-color",
]);

export function isSelectionTool(tool: ToolId): boolean {
	return SELECTION_TOOL_IDS.has(tool);
}

const PIXEL_PERFECT_TOOLS = new Set<ToolId>(["pencil", "eraser", "curve"]);

/** Tools whose freehand strokes support pixel-perfect corner removal. */
export function usesPixelPerfect(tool: ToolId): boolean {
	return PIXEL_PERFECT_TOOLS.has(tool);
}
