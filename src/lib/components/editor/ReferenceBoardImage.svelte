<script lang="ts">
	import type { ReferenceImage } from "$lib/editor/types.js";
	import { cn } from "$lib/utils.js";

	let {
		reference,
		zoom,
		active = false,
	}: { reference: ReferenceImage; zoom: number; active?: boolean } = $props();

	let url = $state("");

	$effect(() => {
		const bytes = reference.bytes;
		const mime = reference.mime || "image/png";
		const next = URL.createObjectURL(
			new Blob([new Uint8Array(bytes)], { type: mime }),
		);
		url = next;
		return () => URL.revokeObjectURL(next);
	});

	let displayWidth = $derived(Math.max(1, reference.width * zoom));
	let displayHeight = $derived(Math.max(1, reference.height * zoom));
</script>

{#if url}
	<img
		src={url}
		alt={reference.name}
		draggable="false"
		class={cn(
			"pointer-events-none absolute select-none [image-rendering:auto]",
			active && "outline outline-2 outline-primary outline-offset-2",
		)}
		style:left={`${reference.x * zoom}px`}
		style:top={`${reference.y * zoom}px`}
		style:width={`${displayWidth}px`}
		style:height={`${displayHeight}px`}
		style:opacity={reference.opacity}
		style:transform={reference.rotation ? `rotate(${reference.rotation}deg)` : undefined}
	/>
{/if}
