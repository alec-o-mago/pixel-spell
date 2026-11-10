<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import type { BackgroundKind } from "$lib/editor/types.js";

	let { open = $bindable(false) } = $props();

	const presets = [16, 32, 64, 128];
	const backgrounds: { id: BackgroundKind; label: string; swatch: string }[] = [
		{ id: "transparent", label: "Transparent", swatch: "alpha-checker" },
		{ id: "white", label: "White", swatch: "bg-white" },
		{ id: "black", label: "Black", swatch: "bg-black" },
	];
	let name = $state("");
	let width = $state(32);
	let height = $state(32);
	let background = $state<BackgroundKind>("transparent");

	$effect(() => {
		if (!open) return;
		name = "";
		width = editor.doc.width;
		height = editor.doc.height;
		background = "transparent";
	});

	function create(): void {
		const w = Number.isFinite(width) ? width : 32;
		const h = Number.isFinite(height) ? height : 32;
		editor.newProject(w, h, { name, background });
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>New project</Dialog.Title>
			<Dialog.Description>
				Name your project, pick a canvas size, and choose how the canvas starts. Small sizes
				are your friend.
			</Dialog.Description>
		</Dialog.Header>

		<div class="grid gap-4 py-1">
			<div class="grid gap-1.5">
				<Label for="new-name">Name</Label>
				<Input
					id="new-name"
					bind:value={name}
					maxlength={60}
					placeholder="Untitled"
					autocomplete="off"
				/>
			</div>

			<div class="grid grid-cols-4 gap-2">
				{#each presets as preset (preset)}
					<Button
						variant={width === preset && height === preset ? "default" : "outline"}
						size="sm"
						class="tabular-nums"
						onclick={() => {
							width = preset;
							height = preset;
						}}
					>
						{preset}×{preset}
					</Button>
				{/each}
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="grid gap-1.5">
					<Label for="new-width">Width</Label>
					<Input
						id="new-width"
						type="number"
						min={1}
						max={1024}
						bind:value={width}
						class="tabular-nums"
					/>
				</div>
				<div class="grid gap-1.5">
					<Label for="new-height">Height</Label>
					<Input
						id="new-height"
						type="number"
						min={1}
						max={1024}
						bind:value={height}
						class="tabular-nums"
					/>
				</div>
			</div>

			<div class="grid gap-2">
				<span class="text-xs font-medium">Background</span>
				<div class="grid grid-cols-3 gap-2" role="group" aria-label="Background">
					{#each backgrounds as option (option.id)}
						<Button
							variant={background === option.id ? "default" : "outline"}
							size="sm"
							class="h-auto flex-col gap-1.5 py-2"
							onclick={() => (background = option.id)}
							aria-pressed={background === option.id}
						>
							<span
								class="size-5 rounded-sm border {option.swatch}"
								style={option.id === "transparent"
									? "background-size: 6px 6px"
									: undefined}
								aria-hidden="true"
							></span>
							<span class="text-[10px]">{option.label}</span>
						</Button>
					{/each}
				</div>
			</div>

			<p class="text-xs text-muted-foreground">
				Canvas size can be between 1 and 1024 pixels. This opens a new project tab and
				keeps the current project open. Leave the name blank to use the next Untitled name.
			</p>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button onclick={create}>Create project</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
