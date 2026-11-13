<script lang="ts">
	import { onMount } from "svelte";
	import FileUp from "@lucide/svelte/icons/file-up";
	import * as Tooltip from "$lib/components/ui/tooltip/index.js";
	import AboutDialog from "$lib/components/editor/AboutDialog.svelte";
	import CommandPalette from "$lib/components/editor/CommandPalette.svelte";
	import ExportDialog from "$lib/components/editor/ExportDialog.svelte";
	import ImportDialog from "$lib/components/editor/ImportDialog.svelte";
	import RecoveryDialog from "$lib/components/editor/RecoveryDialog.svelte";
	import TimelineDock from "$lib/components/editor/TimelineDock.svelte";
	import CanvasStage from "$lib/components/editor/CanvasStage.svelte";
	import LeftPanel from "$lib/components/editor/LeftPanel.svelte";
	import MenuBar from "$lib/components/editor/MenuBar.svelte";
	import NewDocumentDialog from "$lib/components/editor/NewDocumentDialog.svelte";
	import ProjectTabs from "$lib/components/editor/ProjectTabs.svelte";
	import ResizeCanvasDialog from "$lib/components/editor/ResizeCanvasDialog.svelte";
	import ScaleCanvasDialog from "$lib/components/editor/ScaleCanvasDialog.svelte";
	import ShortcutsDialog from "$lib/components/editor/ShortcutsDialog.svelte";
	import ToolStrip from "$lib/components/editor/ToolStrip.svelte";
	import {
		AUTOSAVE_INTERVAL_MS,
		clearAutosaves,
		loadRecoveryProjects,
		type RecoveredProject,
	} from "$lib/editor/autosave.js";
	import { COMMAND_BY_ID, setCommandHost } from "$lib/editor/commands.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import { readProjectFile } from "$lib/editor/file.js";
	import { IMPORT_ACCEPT } from "$lib/editor/import.js";
	import { comboFromEvent, keybindings } from "$lib/editor/keybindings.svelte.js";

	let newDialogOpen = $state(false);
	let commandPaletteOpen = $state(false);
	let shortcutsOpen = $state(false);
	let aboutOpen = $state(false);
	let importDialogOpen = $state(false);
	let exportDialogOpen = $state(false);
	let scaleCanvasOpen = $state(false);
	let resizeCanvasOpen = $state(false);
	let importFile = $state<File | null>(null);
	let importInput: HTMLInputElement | undefined;
	let projectInput: HTMLInputElement | undefined;
	let draggingFile = $state(false);
	let dragDepth = 0;
	let recoveryOpen = $state(false);
	let recoveredProjects = $state<RecoveredProject[]>([]);
	let initialProjectIds: string[] = [];

	onMount(() => {
		let disposed = false;
		initialProjectIds = editor.projects.map((project) => project.id);

		const autosaveTimer = window.setInterval(
			() => editor.autosaveNow(),
			AUTOSAVE_INTERVAL_MS,
		);
		const flushAutosave = (): void => editor.autosaveNow();
		const flushWhenHidden = (): void => {
			if (document.visibilityState === "hidden") editor.autosaveNow();
		};

		window.addEventListener("pagehide", flushAutosave);
		document.addEventListener("visibilitychange", flushWhenHidden);

		void loadRecoveryProjects().then((projects) => {
			if (disposed || projects.length === 0) return;
			recoveredProjects = projects;
			recoveryOpen = true;
		});

		return () => {
			disposed = true;
			window.clearInterval(autosaveTimer);
			window.removeEventListener("pagehide", flushAutosave);
			document.removeEventListener("visibilitychange", flushWhenHidden);
		};
	});

	async function restoreRecoveredProjects(): Promise<void> {
		const recovered = recoveredProjects;
		if (recovered.length === 0) {
			recoveryOpen = false;
			return;
		}

		const preferred =
			recovered.find((entry) => entry.record.active) ?? recovered[0]!;
		let preferredId: string | null = null;

		for (const entry of recovered) {
			const id = editor.openProject(entry.project, { dirty: true });
			if (entry === preferred) preferredId = id;
		}

		// The untouched project from this launch is replaced by the recovery tabs.
		for (const id of initialProjectIds) {
			if (
				editor.projects.some((project) => project.id === id) &&
				!editor.isProjectModified(id)
			) {
				editor.closeProject(id);
			}
		}
		if (preferredId) editor.selectProject(preferredId);

		await clearAutosaves();
		recoveryOpen = false;
		recoveredProjects = [];
		editor.autosaveAll();
	}

	async function discardRecoveredProjects(): Promise<void> {
		recoveryOpen = false;
		recoveredProjects = [];
		await clearAutosaves();
	}

	function showImport(file: File): void {
		importFile = file;
		importDialogOpen = true;
	}

	function openImportPicker(): void {
		importInput?.click();
	}

	function openProjectPicker(): void {
		projectInput?.click();
	}

	async function onProjectInput(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = "";
		if (!file) return;

		try {
			const project = await readProjectFile(file);
			if (!project) {
				window.alert("That file could not be opened as a Pixel Spell project.");
				return;
			}
			editor.openProject(project);
		} catch {
			window.alert("That file could not be read. It may be corrupted or too large.");
		}
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

	$effect(() => {
		// Capture a recovery snapshot shortly after drawing pauses. The interval
		// in onMount covers longer, continuous editing sessions.
		editor.revision;
		editor.structureRevision;
		if (!editor.dirty) return;
		const timer = window.setTimeout(() => editor.autosaveNow(), 1200);
		return () => window.clearTimeout(timer);
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

	setCommandHost({
		openNewProject: () => (newDialogOpen = true),
		openProject: openProjectPicker,
		openImport: openImportPicker,
		openExport: () => (exportDialogOpen = true),
		openScaleCanvas: () => (scaleCanvasOpen = true),
		openResizeCanvas: () => (resizeCanvasOpen = true),
		openShortcuts: () => (shortcutsOpen = true),
		openAbout: () => (aboutOpen = true),
		openCommandPalette: () => (commandPaletteOpen = true),
	});

	function handleKeydown(event: KeyboardEvent): void {
		const combo = comboFromEvent(event);
		if (!combo) return;

		const commandId = keybindings.commandForCombo(combo);
		if (!commandId) return;
		const command = COMMAND_BY_ID[commandId];
		if (!command) return;

		const isPalette = commandId === "app.command-palette";
		if (isTypingTarget(event.target) && !isPalette) return;

		const element = event.target as HTMLElement | null;
		// Let focused buttons and links handle Space/Enter themselves instead
		// of also toggling playback or a tool.
		if (
			(element?.tagName === "BUTTON" || element?.tagName === "A") &&
			(event.key === " " || event.key === "Enter")
		) {
			return;
		}
		// A dialog owns its own keyboard interactions.
		if (
			element instanceof Element &&
			element.closest('[role="dialog"], [role="menu"]')
		) {
			return;
		}

		if (command.ignoreRepeat && event.repeat) {
			event.preventDefault();
			return;
		}
		if (command.enabled && !command.enabled()) return;

		event.preventDefault();
		command.run();
	}
</script>

<Tooltip.Provider delayDuration={300}>
	<div class="flex h-svh flex-col overflow-hidden bg-background text-foreground">
		<MenuBar
			onNew={() => (newDialogOpen = true)}
			onOpen={openProjectPicker}
			onImport={openImportPicker}
			onExport={() => (exportDialogOpen = true)}
			onCommandPalette={() => (commandPaletteOpen = true)}
			onShortcuts={() => (shortcutsOpen = true)}
			onAbout={() => (aboutOpen = true)}
			onScaleCanvas={() => (scaleCanvasOpen = true)}
			onResizeCanvas={() => (resizeCanvasOpen = true)}
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
	<CommandPalette bind:open={commandPaletteOpen} />
	<ShortcutsDialog bind:open={shortcutsOpen} />
	<AboutDialog bind:open={aboutOpen} />
	<ImportDialog bind:open={importDialogOpen} file={importFile} />
	<ExportDialog bind:open={exportDialogOpen} />
	<ScaleCanvasDialog bind:open={scaleCanvasOpen} />
	<ResizeCanvasDialog bind:open={resizeCanvasOpen} />
	<RecoveryDialog
		bind:open={recoveryOpen}
		projects={recoveredProjects}
		onRestore={restoreRecoveredProjects}
		onDiscard={discardRecoveredProjects}
	/>

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
	<input
		bind:this={projectInput}
		type="file"
		accept=".pixelspell,application/octet-stream"
		class="hidden"
		onchange={onProjectInput}
	/>
</Tooltip.Provider>

<svelte:window
	onkeydown={handleKeydown}
	oncontextmenucapture={(event) => event.preventDefault()}
	ondragenter={handleDragEnter}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
/>
