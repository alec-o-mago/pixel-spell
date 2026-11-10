<script lang="ts">
	import Dices from "@lucide/svelte/icons/dices";
	import Droplets from "@lucide/svelte/icons/droplets";
	import Eraser from "@lucide/svelte/icons/eraser";
	import Hand from "@lucide/svelte/icons/hand";
	import LassoSelect from "@lucide/svelte/icons/lasso-select";
	import PaintBucket from "@lucide/svelte/icons/paint-bucket";
	import Pencil from "@lucide/svelte/icons/pencil";
	import Pipette from "@lucide/svelte/icons/pipette";
	import Slash from "@lucide/svelte/icons/slash";
	import Spline from "@lucide/svelte/icons/spline";
	import SprayCan from "@lucide/svelte/icons/spray-can";
	import Square from "@lucide/svelte/icons/square";
	import SquareDashed from "@lucide/svelte/icons/square-dashed";
	import SwatchBook from "@lucide/svelte/icons/swatch-book";
	import WandSparkles from "@lucide/svelte/icons/wand-sparkles";
	import ZoomIn from "@lucide/svelte/icons/zoom-in";
	import type { ToolId } from "$lib/editor/types.js";

	let { tool, class: className = "size-4" }: { tool: ToolId; class?: string } = $props();
</script>

{#if tool === "pan"}
	<Hand class={className} />
{:else if tool === "zoom"}
	<ZoomIn class={className} />
{:else if tool === "magic-wand"}
	<WandSparkles class={className} />
{:else if tool === "shape-select"}
	<SquareDashed class={className} />
{:else if tool === "lasso"}
	<LassoSelect class={className} />
{:else if tool === "select-color"}
	<SwatchBook class={className} />
{:else if tool === "pencil"}
	<Pencil class={className} />
{:else if tool === "spray"}
	<SprayCan class={className} />
{:else if tool === "eraser"}
	<Eraser class={className} />
{:else if tool === "line"}
	<Slash class={className} />
{:else if tool === "curve"}
	<Spline class={className} />
{:else if tool === "shape"}
	<Square class={className} />
{:else if tool === "fill"}
	<PaintBucket class={className} />
{:else if tool === "blur"}
	<Droplets class={className} />
{:else if tool === "jumble"}
	<Dices class={className} />
{:else}
	<Pipette class={className} />
{/if}
