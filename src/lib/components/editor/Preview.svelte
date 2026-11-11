<script lang="ts">
	import ScanEye from "@lucide/svelte/icons/scan-eye";
	import X from "@lucide/svelte/icons/x";
	import { compositeFrameCached } from "$lib/editor/doc.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import { drawScaled } from "$lib/editor/render.js";

	let canvas = $state<HTMLCanvasElement>();

	$effect(() => {
		if (!editor.showPreview) return;
		const doc = editor.doc;
		const frame = editor.activeFrame;
		const revision = editor.revision;

		if (!canvas) return;
		const id = requestAnimationFrame(() => {
			if (!canvas || !editor.showPreview) return;
			const pixels = compositeFrameCached(doc, frame, revision);
			drawScaled(canvas, pixels, doc.width, doc.height, doc.width, doc.height);
		});
		return () => cancelAnimationFrame(id);
	});
</script>

{#if editor.showPreview}
	<div
		class="absolute right-3 top-3 z-10 max-w-[calc(100%_-_1.5rem)] overflow-hidden rounded-lg border bg-background/95 shadow-lg backdrop-blur"
	>
		<div class="flex h-8 items-center justify-between gap-4 border-b px-2.5">
			<span class="text-[11px] font-medium">Preview</span>
			<button
				type="button"
				class="-mr-1 grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				onclick={() => (editor.showPreview = false)}
				title="Close preview"
				aria-label="Close preview"
			>
				<X class="size-3.5" />
			</button>
		</div>
		<div class="grid min-h-16 min-w-24 place-items-center overflow-auto p-2">
			<div
				class="checkerboard shrink-0 ring-1 ring-border/70"
				style:width={`${editor.doc.width}px`}
				style:height={`${editor.doc.height}px`}
			>
				<canvas
					bind:this={canvas}
					class="block"
					style:width={`${editor.doc.width}px`}
					style:height={`${editor.doc.height}px`}
					aria-label="Preview at 1x zoom"
				></canvas>
			</div>
		</div>
	</div>
{:else}
	<button
		type="button"
		class="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full border bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
		onclick={() => (editor.showPreview = true)}
		title="Show preview"
		aria-label="Show preview"
	>
		<ScanEye class="size-4" />
	</button>
{/if}
