<script lang="ts">
	import FileUp from "@lucide/svelte/icons/file-up";
	import * as Tooltip from "$lib/components/ui/tooltip/index.js";
	import AboutDialog from "$lib/components/editor/AboutDialog.svelte";
	import ImportDialog from "$lib/components/editor/ImportDialog.svelte";
	import TimelineDock from "$lib/components/editor/TimelineDock.svelte";
	import CanvasStage from "$lib/components/editor/CanvasStage.svelte";
	import LeftPanel from "$lib/components/editor/LeftPanel.svelte";
	import MenuBar from "$lib/components/editor/MenuBar.svelte";
	import NewDocumentDialog from "$lib/components/editor/NewDocumentDialog.svelte";
	import ProjectTabs from "$lib/components/editor/ProjectTabs.svelte";
	import ShortcutsDialog from "$lib/components/editor/ShortcutsDialog.svelte";
	import ToolStrip from "$lib/components/editor/ToolStrip.svelte";
	import { editor } from "$lib/editor/editor.svelte.js";
	import { IMPORT_ACCEPT } from "$lib/editor/import.js";
	import { TOOL_SHIFT_SHORTCUTS, TOOL_SHORTCUTS } from "$lib/editor/tools.js";

	let newDialogOpen = $state(false);
	let shortcutsOpen = $state(false);
	let aboutOpen = $state(false);
	let importDialogOpen = $state(false);
	let importFile = $state<File | null>(null);
	let importInput: HTMLInputElement | undefined;
	let draggingFile = $state(false);
	let dragDepth = 0;

	function showImport(file: File): void {
		importFile = file;
		importDialogOpen = true;
	}

	function openImportPicker(): void {
		importInput?.click();
	}

	function onImportInput(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = "";
		if (file) showImport(file);
	}

	function dragHasFiles(event: DragEvent): boolean {
		const types = event.dataTransfer?.types;
		return types ? Array.from(types).includes("Files") : false;
	}

	function handleDragEnter(event: DragEvent): void {
		if (!dragHasFiles(event)) return;
		event.preventDefault();
		dragDepth++;
		draggingFile = true;
	}

	function handleDragOver(event: DragEvent): void {
		if (!dragHasFiles(event)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
	}

	function handleDragLeave(event: DragEvent): void {
		if (!draggingFile) return;
		event.preventDefault();
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) draggingFile = false;
	}

	function handleDrop(event: DragEvent): void {
		if (!dragHasFiles(event)) return;
		event.preventDefault();
		dragDepth = 0;
		draggingFile = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) showImport(file);
	}

	$effect(() => {
		document.documentElement.classList.toggle("dark", editor.theme === "dark");
		try {
			localStorage.setItem("pixel-spell-theme", editor.theme);
		} catch {
			// Storage can be unavailable in private browsing contexts.
		}
	});

	const NON_TEXT_INPUT_TYPES = new Set([
		"button",
		"checkbox",
		"color",
		"file",
		"hidden",
		"image",
		"radio",
		"range",
		"reset",
		"submit",
	]);

	function isTypingTarget(target: EventTarget | null): boolean {
		const element = target as HTMLElement | null;
		if (!element) return false;
		if (element.isContentEditable) return true;

		if (element.tagName === "TEXTAREA" || element.tagName === "SELECT") return true;
		if (element.tagName !== "INPUT") return false;

		return !NON_TEXT_INPUT_TYPES.has((element as HTMLInputElement).type);
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
			if (key === "a") {
				event.preventDefault();
				editor.selectAll();
				return;
			}
			if (key === "c") {
				event.preventDefault();
				editor.copySelection();
				return;
			}
			if (key === "v") {
				event.preventDefault();
				editor.pasteSelection();
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
			onImport={openImportPicker}
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
	<ImportDialog bind:open={importDialogOpen} file={importFile} />

	{#if draggingFile}
		<div
			class="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-background/70 p-6 backdrop-blur-sm"
		>
			<div
				class="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary/60 bg-background/90 px-8 py-6 text-center shadow-lg"
			>
				<FileUp class="size-6 text-primary" />
				<p class="text-sm font-medium">Drop to import</p>
				<p class="max-w-xs text-xs text-muted-foreground">
					Images and GIMP, JASC, or HEX palettes
				</p>
			</div>
		</div>
	{/if}

	<input
		bind:this={importInput}
		type="file"
		accept={IMPORT_ACCEPT}
		class="hidden"
		onchange={onImportInput}
	/>
</Tooltip.Provider>

<svelte:window
	onkeydown={handleKeydown}
	ondragenter={handleDragEnter}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
/>
