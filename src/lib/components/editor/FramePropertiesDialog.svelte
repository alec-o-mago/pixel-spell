<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import { MAX_FRAME_DURATION, MIN_FRAME_DURATION } from "$lib/editor/doc.js";

	let { open = $bindable(false) } = $props();

	let duration = $state<string | number>("");
	let tag = $state("");
	let error = $state<string | null>(null);
	let wasOpen = false;

	let selected = $derived(editor.selectedFrameIndices);
	let selectionLabel = $derived.by(() => {
		const indices = selected;
		if (indices.length === 0) return "No frames selected";
		if (indices.length === 1) return `Frame ${indices[0]! + 1}`;
		return `Frames ${indices[0]! + 1}–${indices[indices.length - 1]! + 1} (${indices.length})`;
	});
	let fallbackDuration = $derived(Math.round(1000 / (editor.doc.fps || 12)));

	$effect(() => {
		if (open && !wasOpen) {
			const index = editor.activeFrame;
			const frame = editor.doc.frames[index];
			duration =
				frame?.duration !== undefined ? Math.round(frame.duration) : "";
			tag = frame?.tag ?? "";
			error = null;
		}
		wasOpen = open;
	});

	function resetDuration(): void {
		duration = "";
	}

	function apply(): void {
		const nextDuration = String(duration ?? "").trim();
		let parsedDuration: number | null = null;
		if (nextDuration !== "") {
			const value = Number(nextDuration);
			if (
				!Number.isFinite(value) ||
				value < MIN_FRAME_DURATION ||
				value > MAX_FRAME_DURATION
			) {
				error = `Duration must be between ${MIN_FRAME_DURATION} and ${MAX_FRAME_DURATION} ms.`;
				return;
			}
			parsedDuration = Math.round(value);
		}

		editor.setFrameDuration(parsedDuration);
		editor.setFrameTag(tag);
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Frame properties</Dialog.Title>
			<Dialog.Description>
				Apply a duration or tag to {selectionLabel.toLowerCase()}.
			</Dialog.Description>
		</Dialog.Header>

		<div class="grid gap-4">
			<div class="grid gap-1.5">
				<Label for="frame-duration">Duration</Label>
				<div class="flex items-center gap-2">
					<Input
						id="frame-duration"
						type="number"
						min={MIN_FRAME_DURATION}
						max={MAX_FRAME_DURATION}
						bind:value={duration}
						placeholder={`${fallbackDuration} (project FPS)`}
						class="tabular-nums"
					/>
					<Button variant="outline" size="sm" onclick={resetDuration}>
						Use FPS
					</Button>
				</div>
				<p class="text-[10px] text-muted-foreground">
					Milliseconds. Leave empty to use the project frame rate ({fallbackDuration} ms
					per frame).
				</p>
			</div>

			<div class="grid gap-1.5">
				<Label for="frame-tag">Tag</Label>
				<Input
					id="frame-tag"
					bind:value={tag}
					maxlength={40}
					placeholder="e.g. walk, idle, attack"
					autocomplete="off"
				/>
				<p class="text-[10px] text-muted-foreground">
					Contiguous frames with the same tag form a tag range above the timeline.
				</p>
			</div>

			{#if error}
				<p class="text-xs text-destructive">{error}</p>
			{/if}
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button onclick={apply}>Apply</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
