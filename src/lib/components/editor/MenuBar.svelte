<script lang="ts">
	import Eraser from "@lucide/svelte/icons/eraser";
	import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
	import FlipHorizontal2 from "@lucide/svelte/icons/flip-horizontal-2";
	import FlipVertical2 from "@lucide/svelte/icons/flip-vertical-2";
	import FolderOpen from "@lucide/svelte/icons/folder-open";
	import Grid3x3 from "@lucide/svelte/icons/grid-3x3";
	import ImageDown from "@lucide/svelte/icons/image-down";
	import Images from "@lucide/svelte/icons/images";
	import Info from "@lucide/svelte/icons/info";
	import Keyboard from "@lucide/svelte/icons/keyboard";
	import Maximize2 from "@lucide/svelte/icons/maximize-2";
	import Moon from "@lucide/svelte/icons/moon";
	import Redo2 from "@lucide/svelte/icons/redo-2";
	import Save from "@lucide/svelte/icons/save";
	import Sun from "@lucide/svelte/icons/sun";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import Undo2 from "@lucide/svelte/icons/undo-2";
	import WandSparkles from "@lucide/svelte/icons/wand-sparkles";
	import ZoomIn from "@lucide/svelte/icons/zoom-in";
	import ZoomOut from "@lucide/svelte/icons/zoom-out";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Tooltip from "$lib/components/ui/tooltip/index.js";
	import {
		exportFramePng,
		exportSpriteSheetPng,
		readProjectFile,
	} from "$lib/editor/file.js";
	import { editor } from "$lib/editor/editor.svelte.js";

	let {
		onNew,
		onShortcuts,
		onAbout,
	}: {
		onNew: () => void;
		onShortcuts: () => void;
		onAbout: () => void;
	} = $props();

	let fileInput: HTMLInputElement | undefined;

	function openProject(): void {
		fileInput?.click();
	}

	async function handleFileChange(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = "";
		if (!file) return;

		const project = await readProjectFile(file);
		if (!project) {
			window.alert("That file could not be opened as a Pixel Spell project.");
			return;
		}
		editor.openProject(project);
	}

	function exportPng(): void {
		exportFramePng(editor.doc, editor.activeFrame, editor.name);
	}

	function exportSheet(): void {
		exportSpriteSheetPng(editor.doc, editor.name);
	}
</script>

<header class="flex h-11 shrink-0 items-center border-b bg-background px-2">
	<div class="flex shrink-0 items-center gap-2 pl-1 pr-2">
		<div class="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
			<WandSparkles class="size-3.5" />
		</div>
		<span class="text-sm font-semibold tracking-tight">Pixel Spell</span>
	</div>

	<nav class="flex items-center" aria-label="Main menu">
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class="h-8 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground"
			>
				File
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="w-56">
				<DropdownMenu.Item onSelect={onNew}>
					<FilePlus2 class="size-4" />
					New sprite…
					<DropdownMenu.Shortcut>Ctrl N</DropdownMenu.Shortcut>
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={openProject}>
					<FolderOpen class="size-4" />
					Open project…
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => editor.saveToFile()}>
					<Save class="size-4" />
					Save project
					<DropdownMenu.Shortcut>Ctrl S</DropdownMenu.Shortcut>
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onSelect={exportPng}>
					<ImageDown class="size-4" />
					Export PNG
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={exportSheet}>
					<Images class="size-4" />
					Export sprite sheet
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class="h-8 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground"
			>
				Edit
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="w-56">
				<DropdownMenu.Item onSelect={() => editor.undo()} disabled={!editor.canUndo}>
					<Undo2 class="size-4" />
					Undo
					<DropdownMenu.Shortcut>Ctrl Z</DropdownMenu.Shortcut>
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => editor.redo()} disabled={!editor.canRedo}>
					<Redo2 class="size-4" />
					Redo
					<DropdownMenu.Shortcut>Ctrl ⇧ Z</DropdownMenu.Shortcut>
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onSelect={() => editor.clearLayer()}>
					<Eraser class="size-4" />
					Clear layer
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => editor.clearFrame()}>
					<Trash2 class="size-4" />
					Clear frame
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class="h-8 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground"
			>
				View
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="w-56">
				<DropdownMenu.Item onSelect={() => editor.zoomIn()}>
					<ZoomIn class="size-4" />
					Zoom in
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => editor.zoomOut()}>
					<ZoomOut class="size-4" />
					Zoom out
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => editor.fitToWindow()}>
					<Maximize2 class="size-4" />
					Fit to window
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.CheckboxItem bind:checked={editor.showGrid}>
					<Grid3x3 class="size-4" />
					Show pixel grid
				</DropdownMenu.CheckboxItem>
				<DropdownMenu.Item onSelect={() => editor.toggleTheme()}>
					{#if editor.theme === "dark"}
						<Sun class="size-4" />
						Switch to light mode
					{:else}
						<Moon class="size-4" />
						Switch to dark mode
					{/if}
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class="h-8 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground"
			>
				Help
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="w-56">
				<DropdownMenu.Item onSelect={onShortcuts}>
					<Keyboard class="size-4" />
					Keyboard shortcuts
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={onAbout}>
					<Info class="size-4" />
					About Pixel Spell
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</nav>

	<div class="ml-auto flex items-center gap-1 pr-1">
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant={editor.mirrorX ? "secondary" : "ghost"}
						size="icon-sm"
						class="text-muted-foreground"
						onclick={() => (editor.mirrorX = !editor.mirrorX)}
						aria-label="Toggle X axis mirror"
						aria-pressed={editor.mirrorX}
					>
						<FlipHorizontal2 class="size-4" />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" sideOffset={8} class="px-2 py-1 text-xs">
				X axis mirror
			</Tooltip.Content>
		</Tooltip.Root>

		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant={editor.mirrorY ? "secondary" : "ghost"}
						size="icon-sm"
						class="text-muted-foreground"
						onclick={() => (editor.mirrorY = !editor.mirrorY)}
						aria-label="Toggle Y axis mirror"
						aria-pressed={editor.mirrorY}
					>
						<FlipVertical2 class="size-4" />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" sideOffset={8} class="px-2 py-1 text-xs">
				Y axis mirror
			</Tooltip.Content>
		</Tooltip.Root>

		<Separator orientation="vertical" class="mx-1 h-5" />

		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="icon-sm"
						class="text-muted-foreground"
						onclick={() => editor.toggleTheme()}
						aria-label={editor.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
					>
						{#if editor.theme === "dark"}
							<Sun class="size-4" />
						{:else}
							<Moon class="size-4" />
						{/if}
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" sideOffset={8} class="px-2 py-1 text-xs">
				{editor.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
			</Tooltip.Content>
		</Tooltip.Root>
	</div>

	<input
		bind:this={fileInput}
		type="file"
		accept=".json,application/json"
		class="hidden"
		onchange={handleFileChange}
	/>
</header>
