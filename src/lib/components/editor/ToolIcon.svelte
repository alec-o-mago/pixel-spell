<script lang="ts">
	import Circle from "@lucide/svelte/icons/circle";
	import Eraser from "@lucide/svelte/icons/eraser";
	import PaintBucket from "@lucide/svelte/icons/paint-bucket";
	import Pencil from "@lucide/svelte/icons/pencil";
	import Pipette from "@lucide/svelte/icons/pipette";
	import Slash from "@lucide/svelte/icons/slash";
	import Square from "@lucide/svelte/icons/square";
	import type { ToolId } from "$lib/editor/types.js";

	let { tool, class: className = "size-4" }: { tool: ToolId; class?: string } = $props();
</script>

{#if tool === "pencil"}
	<Pencil class={className} />
{:else if tool === "eraser"}
	<Eraser class={className} />
{:else if tool === "line"}
	<Slash class={className} />
{:else if tool === "rectangle"}
	<Square class={className} />
{:else if tool === "ellipse"}
	<Circle class={className} />
{:else if tool === "fill"}
	<PaintBucket class={className} />
{:else}
	<Pipette class={className} />
{/if}
