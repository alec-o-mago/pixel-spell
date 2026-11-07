import type { ToolId } from "./types.js";

export interface ToolDef {
	id: ToolId;
	label: string;
	description: string;
	shortcut: string;
}

export const TOOLS: ToolDef[] = [
	{
		id: "pencil",
		label: "Pencil",
		description: "Draw freehand pixels",
		shortcut: "B",
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
		id: "rectangle",
		label: "Rectangle",
		description: "Draw a rectangle or filled block",
		shortcut: "R",
	},
	{
		id: "ellipse",
		label: "Ellipse",
		description: "Draw an ellipse or filled shape",
		shortcut: "O",
	},
	{
		id: "fill",
		label: "Fill",
		description: "Fill a connected area with color",
		shortcut: "G",
	},
	{
		id: "eyedropper",
		label: "Eyedropper",
		description: "Pick a color from the canvas",
		shortcut: "I",
	},
];

export const TOOL_BY_ID = Object.fromEntries(
	TOOLS.map((tool) => [tool.id, tool]),
) as Record<ToolId, ToolDef>;

export const TOOL_SHORTCUTS = Object.fromEntries(
	TOOLS.map((tool) => [tool.shortcut.toLowerCase(), tool.id]),
) as Record<string, ToolId>;
