<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { editor } from "$lib/editor/editor.svelte.js";

	let { open = $bindable(false) } = $props();

	const presets = [16, 32, 64, 128];
	let width = $state(32);
	let height = $state(32);

	$effect(() => {
		if (!open) return;
		width = editor.doc.width;
		height = editor.doc.height;
	});

	function create(): void {
		const w = Number.isFinite(width) ? width : 32;
		const h = Number.isFinite(height) ? height : 32;
		editor.newProject(w, h);
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>New sprite</Dialog.Title>
			<Dialog.Description>
				Pick a canvas size. Everything is drawn pixel by pixel, so small sizes are your
				friend.
			</Dialog.Description>
		</Dialog.Header>

		<div class="grid gap-4 py-1">
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

			<p class="text-xs text-muted-foreground">
				Canvas size can be between 1 and 1024 pixels. This opens a new project tab and
				keeps the current project open.
			</p>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button onclick={create}>Create sprite</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
