import { COMMANDS, COMMAND_BY_ID, type CommandDef } from "./commands.js";

export const KEYBINDINGS_STORAGE_KEY = "pixel-spell-keybindings";

const MODIFIER_TOKENS = new Set(["mod", "ctrl", "meta", "alt", "shift"]);
const IGNORED_KEYS = new Set([
	"Control",
	"Shift",
	"Alt",
	"Meta",
	"CapsLock",
	"Dead",
	"Process",
	"Unidentified",
]);

const IS_MAC =
	typeof navigator !== "undefined" &&
	/Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

const KEY_TO_TOKEN: Record<string, string> = {
	" ": "space",
	ArrowLeft: "left",
	ArrowRight: "right",
	ArrowUp: "up",
	ArrowDown: "down",
	Escape: "escape",
	Delete: "delete",
	Backspace: "backspace",
	Enter: "enter",
	Tab: "tab",
	Home: "home",
	End: "end",
	PageUp: "pageup",
	PageDown: "pagedown",
	"+": "plus",
};

const KEY_LABELS: Record<string, string> = {
	left: "←",
	right: "→",
	up: "↑",
	down: "↓",
	space: "Space",
	escape: "Esc",
	delete: "Delete",
	backspace: "Backspace",
	enter: "Enter",
	tab: "Tab",
	home: "Home",
	end: "End",
	pageup: "PageUp",
	pagedown: "PageDown",
	plus: "+",
};

function keyTokenFromEvent(event: KeyboardEvent): string | null {
	if (IGNORED_KEYS.has(event.key)) return null;
	const mapped = KEY_TO_TOKEN[event.key];
	if (mapped) return mapped;
	if (event.key.length === 1) return event.key.toLowerCase();
	return event.key.toLowerCase();
}

/** Converts a keyboard event into the normalized token used by bindings. */
export function comboFromEvent(event: KeyboardEvent): string | null {
	const key = keyTokenFromEvent(event);
	if (!key) return null;

	const parts: string[] = [];
	if (event.ctrlKey || event.metaKey) parts.push("mod");
	if (event.altKey) parts.push("alt");
	if (event.shiftKey) parts.push("shift");
	parts.push(key);
	return parts.join("+");
}

function isModifierToken(token: string): boolean {
	return MODIFIER_TOKENS.has(token);
}

export function isCombo(value: unknown): value is string {
	if (typeof value !== "string" || value.length === 0) return false;
	const parts = value.split("+");
	const key = parts.pop();
	if (!key || key.length === 0) return false;
	if (isModifierToken(key)) return false;
	return parts.every(isModifierToken);
}

/** Human-readable label, e.g. "Ctrl ⇧ Z" or "Alt ←". */
export function formatCombo(combo: string): string {
	const parts = combo.split("+");
	const key = parts.pop() ?? "";
	const labels = parts.map((part) => {
		if (part === "mod") return IS_MAC ? "⌘" : "Ctrl";
		if (part === "alt") return IS_MAC ? "⌥" : "Alt";
		if (part === "shift") return "⇧";
		if (part === "ctrl") return "Ctrl";
		if (part === "meta") return IS_MAC ? "⌘" : "Meta";
		return part;
	});
	const keyLabel =
		KEY_LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
	return [...labels, keyLabel].join(" ");
}

export function defaultBindings(): Record<string, string[]> {
	const result: Record<string, string[]> = {};
	for (const command of COMMANDS) {
		result[command.id] = [...(command.defaultKeys ?? [])];
	}
	return result;
}

/**
 * Merge stored overrides with the command catalog. Unknown commands and
 * malformed combos are dropped, and the first command that claims a combo
 * keeps it so a corrupted store cannot create conflicts.
 */
function sanitizeBindings(raw: unknown): Record<string, string[]> {
	const defaults = defaultBindings();
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;

	const source = raw as Record<string, unknown>;
	const result: Record<string, string[]> = {};
	const used = new Set<string>();

	for (const command of COMMANDS) {
		const stored = source[command.id];
		const candidate = Array.isArray(stored)
			? stored.filter(isCombo)
			: (defaults[command.id] ?? []);
		const accepted: string[] = [];
		for (const combo of candidate) {
			if (used.has(combo)) continue;
			used.add(combo);
			accepted.push(combo);
		}
		result[command.id] = accepted;
	}
	return result;
}

function loadBindings(): Record<string, string[]> {
	try {
		const raw = localStorage.getItem(KEYBINDINGS_STORAGE_KEY);
		if (!raw) return defaultBindings();
		return sanitizeBindings(JSON.parse(raw));
	} catch {
		return defaultBindings();
	}
}

class KeybindingState {
	bindings = $state<Record<string, string[]>>(loadBindings());

	labels(commandId: string): string[] {
		return (this.bindings[commandId] ?? []).map(formatCombo);
	}

	primaryLabel(commandId: string): string {
		return this.labels(commandId)[0] ?? "";
	}

	commandForCombo(combo: string): string | null {
		for (const command of COMMANDS) {
			if (this.bindings[command.id]?.includes(combo)) return command.id;
		}
		return null;
	}

	conflictFor(combo: string, exceptCommandId?: string): CommandDef | null {
		for (const command of COMMANDS) {
			if (command.id === exceptCommandId) continue;
			if (this.bindings[command.id]?.includes(combo)) return command;
		}
		return null;
	}

	/**
	 * Assigns a combo to a command, or returns a human-readable conflict
	 * message when another action already owns it.
	 */
	assign(
		commandId: string,
		index: number | null,
		combo: string,
	): string | null {
		const current = this.bindings[commandId] ?? [];
		const existing = current.indexOf(combo);
		if (existing !== -1 && existing !== index) {
			return `“${COMMAND_BY_ID[commandId]?.label ?? commandId}” already uses ${formatCombo(combo)}.`;
		}

		const conflict = this.conflictFor(combo, commandId);
		if (conflict) {
			return `Already used by “${conflict.label}”. Choose a different shortcut.`;
		}

		const next = [...current];
		if (index === null) next.push(combo);
		else next[index] = combo;
		this.#commit({ ...this.bindings, [commandId]: next });
		return null;
	}

	removeBinding(commandId: string, index: number): void {
		const current = this.bindings[commandId] ?? [];
		if (index < 0 || index >= current.length) return;
		const next = current.filter((_, slot) => slot !== index);
		this.#commit({ ...this.bindings, [commandId]: next });
	}

	resetAll(): void {
		const defaults = defaultBindings();
		this.bindings = defaults;
		try {
			localStorage.removeItem(KEYBINDINGS_STORAGE_KEY);
		} catch {
			// Storage can be unavailable in private browsing contexts.
		}
	}

	#commit(next: Record<string, string[]>): void {
		this.bindings = next;
		try {
			localStorage.setItem(KEYBINDINGS_STORAGE_KEY, JSON.stringify(next));
		} catch {
			// Storage can be unavailable in private browsing contexts.
		}
	}
}

export const keybindings = new KeybindingState();
