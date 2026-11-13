<script lang="ts">
	import Copy from "@lucide/svelte/icons/copy";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { editor } from "$lib/editor/editor.svelte.js";

	let { open = $bindable(false) } = $props();

	let offsetX = $state(0);
	let offsetY = $state(0);
	let wasOpen = false;

	let count = $derived(editor.selectedFrameCount);
	let selectionLabel = $derived.by(() => {
		const indices = editor.selectedFrameIndices;
		if (indices.length === 0) return "no frames";
		if (indices.length === 1) return `frame ${indices[0]! + 1}`;
		return `frames ${indices[0]! + 1}–${indices[indices.length - 1]! + 1}`;
	});

	$effect(() => {
		if (open && !wasOpen) {
			offsetX = 0;
			offsetY = 0;
		}
		wasOpen = open;
	});

	function duplicate(): void {
		editor.duplicateFrames(offsetX, offsetY);
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Duplicate frames</Dialog.Title>
			<Dialog.Description>
				Copy {selectionLabel} and place the duplicates after the selection. Pixel
				offsets shift every duplicated cel and clip at the canvas edges.
			</Dialog.Description>
		</Dialog.Header>

		<div class="grid grid-cols-2 gap-3">
			<div class="grid gap-1.5">
				<Label for="duplicate-offset-x">X offset</Label>
				<Input
					id="duplicate-offset-x"
					type="number"
					bind:value={offsetX}
					class="tabular-nums"
				/>
			</div>
			<div class="grid gap-1.5">
				<Label for="duplicate-offset-y">Y offset</Label>
				<Input
					id="duplicate-offset-y"
					type="number"
					bind:value={offsetY}
					class="tabular-nums"
				/>
			</div>
		</div>

		<p class="rounded-md border bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">
			Duplicating {count} {count === 1 ? "frame" : "frames"} at
			({offsetX}, {offsetY}) px.
		</p>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button onclick={duplicate} disabled={count === 0}>
				<Copy class="size-4" />
				Duplicate
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
