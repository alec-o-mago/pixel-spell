<script lang="ts">
	import ClipboardPaste from "@lucide/svelte/icons/clipboard-paste";
	import Copy from "@lucide/svelte/icons/copy";
	import Eraser from "@lucide/svelte/icons/eraser";
	import FileDown from "@lucide/svelte/icons/file-down";
	import FileInput from "@lucide/svelte/icons/file-input";
	import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
	import FlipHorizontal2 from "@lucide/svelte/icons/flip-horizontal-2";
	import FlipVertical2 from "@lucide/svelte/icons/flip-vertical-2";
	import FolderOpen from "@lucide/svelte/icons/folder-open";
	import Grid3x3 from "@lucide/svelte/icons/grid-3x3";
	import Info from "@lucide/svelte/icons/info";
	import Keyboard from "@lucide/svelte/icons/keyboard";
	import LineSquiggle from "@lucide/svelte/icons/line-squiggle";
	import Lock from "@lucide/svelte/icons/lock";
	import Maximize2 from "@lucide/svelte/icons/maximize-2";
	import Moon from "@lucide/svelte/icons/moon";
	import Redo2 from "@lucide/svelte/icons/redo-2";
	import Save from "@lucide/svelte/icons/save";
	import ScanEye from "@lucide/svelte/icons/scan-eye";
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
	import { readProjectFile } from "$lib/editor/file.js";
	import { editor } from "$lib/editor/editor.svelte.js";

	let {
		onNew,
		onImport,
		onExport,
		onShortcuts,
		onAbout,
	}: {
		onNew: () => void;
		onImport: () => void;
		onExport: () => void;
		onShortcuts: () => void;
		onAbout: () => void;
	} = $props();

	let fileInput: HTMLInputElement | undefined;
	let cursor = $derived(editor.cursor ?? editor.lastCursor);

	function activeRing(active: boolean): string {
		return active ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "";
	}

	function openProject(): void {
		fileInput?.click();
	}

	async function handleFileChange(event: Event): Promise<void> {
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
					New project…
					<DropdownMenu.Shortcut>Ctrl N</DropdownMenu.Shortcut>
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={openProject}>
					<FolderOpen class="size-4" />
					Open project…
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={onImport}>
					<FileInput class="size-4" />
					Import…
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => editor.saveToFile()}>
					<Save class="size-4" />
					Save project
					<DropdownMenu.Shortcut>Ctrl S</DropdownMenu.Shortcut>
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onSelect={onExport}>
					<FileDown class="size-4" />
					Export…
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
				<DropdownMenu.Item
					onSelect={() => editor.copySelection()}
					disabled={!editor.hasSelection}
				>
					<Copy class="size-4" />
					Copy selection
					<DropdownMenu.Shortcut>Ctrl C</DropdownMenu.Shortcut>
				</DropdownMenu.Item>
				<DropdownMenu.Item
					onSelect={() => editor.pasteSelection()}
					disabled={!editor.hasClipboard}
				>
					<ClipboardPaste class="size-4" />
					Paste selection
					<DropdownMenu.Shortcut>Ctrl V</DropdownMenu.Shortcut>
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
				<DropdownMenu.CheckboxItem bind:checked={editor.showPreview}>
					<ScanEye class="size-4" />
					Show preview
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

	<div class="flex min-w-0 flex-1 items-center justify-center px-3">
		<div
			class="flex min-w-0 items-center gap-2 rounded-md border bg-muted/20 px-2.5 py-1 font-mono text-[10px] tabular-nums text-muted-foreground shadow-sm"
		>
			<span class="shrink-0 font-medium text-foreground">
				{editor.doc.width} × {editor.doc.height}
			</span>
			<span class="h-3 w-px shrink-0 bg-border" aria-hidden="true"></span>
			<span class="shrink-0" title="Cursor position">
				{cursor ? `${cursor.x}, ${cursor.y}` : "—, —"}
			</span>
			<span class="h-3 w-px shrink-0 bg-border" aria-hidden="true"></span>
			<span class="shrink-0">Frame {editor.activeFrame + 1} / {editor.frameCount}</span>
			<span class="h-3 w-px shrink-0 bg-border" aria-hidden="true"></span>
			<span class="max-w-36 truncate" title="Current layer">
				Layer: {editor.activeLayer.name}
			</span>
		</div>
	</div>

	<div class="flex shrink-0 items-center gap-3 pr-1">
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="icon-sm"
						class={`text-muted-foreground ${activeRing(editor.pixelPerfect)}`}
						onclick={() => (editor.pixelPerfect = !editor.pixelPerfect)}
						aria-label="Toggle pixel perfect"
						aria-pressed={editor.pixelPerfect}
					>
						<LineSquiggle class="size-4" />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" sideOffset={8} class="px-2 py-1 text-xs">
				Pixel perfect — remove extra corner pixels
			</Tooltip.Content>
		</Tooltip.Root>

		<Separator orientation="vertical" class="mx-1 h-5" />

		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant={editor.lockAlpha ? "secondary" : "ghost"}
						size="icon-sm"
						class={`relative overflow-hidden text-muted-foreground ${activeRing(editor.lockAlpha)}`}
						onclick={() => (editor.lockAlpha = !editor.lockAlpha)}
						aria-label="Toggle alpha lock"
						aria-pressed={editor.lockAlpha}
					>
						<span class="alpha-checker pointer-events-none absolute inset-0" aria-hidden="true"
						></span>
						{#if editor.lockAlpha}
							<span
								class="pointer-events-none absolute inset-0 bg-primary/20"
								aria-hidden="true"
							></span>
						{/if}
						<Lock class="relative size-4 text-foreground" />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" sideOffset={8} class="px-2 py-1 text-xs">
				Lock alpha — transparent pixels cannot be modified
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
						class={`text-muted-foreground ${activeRing(editor.mirrorX)}`}
						onclick={() => editor.toggleMirror("x")}
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
						variant="ghost"
						size="icon-sm"
						class={`text-muted-foreground ${activeRing(editor.mirrorY)}`}
						onclick={() => editor.toggleMirror("y")}
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

		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="icon-sm"
						class={`text-muted-foreground ${activeRing(editor.mirrorDiagonalDown)}`}
						onclick={() => editor.toggleMirror("diagonal-down")}
						aria-label="Toggle diagonal \ mirror"
						aria-pressed={editor.mirrorDiagonalDown}
					>
						<FlipHorizontal2 class="size-4 rotate-45" />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" sideOffset={8} class="px-2 py-1 text-xs">
				Diagonal \ mirror
			</Tooltip.Content>
		</Tooltip.Root>

		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="icon-sm"
						class={`text-muted-foreground ${activeRing(editor.mirrorDiagonalUp)}`}
						onclick={() => editor.toggleMirror("diagonal-up")}
						aria-label="Toggle diagonal / mirror"
						aria-pressed={editor.mirrorDiagonalUp}
					>
						<FlipHorizontal2 class="size-4 -rotate-45" />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" sideOffset={8} class="px-2 py-1 text-xs">
				Diagonal / mirror
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
		accept=".pixelspell,application/json,application/octet-stream"
		class="hidden"
		onchange={handleFileChange}
	/>
</header>
