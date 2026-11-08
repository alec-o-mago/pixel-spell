<script lang="ts">
	import * as Tooltip from "$lib/components/ui/tooltip/index.js";
	import AboutDialog from "$lib/components/editor/AboutDialog.svelte";
	import TimelineDock from "$lib/components/editor/TimelineDock.svelte";
	import CanvasStage from "$lib/components/editor/CanvasStage.svelte";
	import LeftPanel from "$lib/components/editor/LeftPanel.svelte";
	import MenuBar from "$lib/components/editor/MenuBar.svelte";
	import NewDocumentDialog from "$lib/components/editor/NewDocumentDialog.svelte";
	import ProjectTabs from "$lib/components/editor/ProjectTabs.svelte";
	import ShortcutsDialog from "$lib/components/editor/ShortcutsDialog.svelte";
	import ToolStrip from "$lib/components/editor/ToolStrip.svelte";
	import { editor } from "$lib/editor/editor.svelte.js";
	import { TOOL_SHIFT_SHORTCUTS, TOOL_SHORTCUTS } from "$lib/editor/tools.js";

	let newDialogOpen = $state(false);
	let shortcutsOpen = $state(false);
	let aboutOpen = $state(false);

	$effect(() => {
		document.documentElement.classList.toggle("dark", editor.theme === "dark");
		try {
			localStorage.setItem("pixel-spell-theme", editor.theme);
		} catch {
			// Storage can be unavailable in private browsing contexts.
		}
	});

	function isTypingTarget(target: EventTarget | null): boolean {
		const element = target as HTMLElement | null;
		if (!element) return false;
		return (
			element.tagName === "INPUT" ||
			element.tagName === "TEXTAREA" ||
			element.tagName === "SELECT" ||
			element.isContentEditable
		);
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (isTypingTarget(event.target)) return;

		const modifier = event.ctrlKey || event.metaKey;
		const key = event.key.toLowerCase();

		if (modifier) {
			if (key === "z") {
				event.preventDefault();
				if (event.shiftKey) editor.redo();
				else editor.undo();
				return;
			}
			if (key === "y") {
				event.preventDefault();
				editor.redo();
				return;
			}
			if (key === "n") {
				event.preventDefault();
				newDialogOpen = true;
				return;
			}
			if (key === "s") {
				event.preventDefault();
				editor.saveToFile();
				return;
			}
			return;
		}

		if (event.altKey) return;

		if (event.key === "Delete") {
			event.preventDefault();
			editor.deleteSelection();
			return;
		}

		if (event.shiftKey && key === "g") {
			event.preventDefault();
			editor.showGrid = !editor.showGrid;
			return;
		}

		if (event.shiftKey) {
			const shiftTool = TOOL_SHIFT_SHORTCUTS[key];
			if (shiftTool) {
				editor.setTool(shiftTool);
				return;
			}
		}

		const tool = TOOL_SHORTCUTS[key];
		if (tool) {
			editor.setTool(tool);
			return;
		}

		if (event.key === " ") {
			event.preventDefault();
			editor.togglePlayback();
			return;
		}
		if (key === "[" || key === ",") {
			editor.previousFrame();
			return;
		}
		if (key === "]" || key === ".") {
			editor.nextFrame();
			return;
		}
		if (event.key === "Escape") {
			editor.playing = false;
			editor.clearSelection();
		}
	}
</script>

<Tooltip.Provider delayDuration={300}>
	<div class="flex h-svh flex-col overflow-hidden bg-background text-foreground">
		<MenuBar
			onNew={() => (newDialogOpen = true)}
			onShortcuts={() => (shortcutsOpen = true)}
			onAbout={() => (aboutOpen = true)}
		/>

		<div class="flex min-h-0 flex-1">
			<ToolStrip />
			<LeftPanel />

			<main class="flex min-w-0 flex-1 flex-col">
				<ProjectTabs onNew={() => (newDialogOpen = true)} />
				<CanvasStage />
				<TimelineDock />
			</main>
		</div>
	</div>

	<NewDocumentDialog bind:open={newDialogOpen} />
	<ShortcutsDialog bind:open={shortcutsOpen} />
	<AboutDialog bind:open={aboutOpen} />
</Tooltip.Provider>

<svelte:window onkeydown={handleKeydown} />
