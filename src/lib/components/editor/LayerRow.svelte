<script lang="ts">
	import Eye from "@lucide/svelte/icons/eye";
	import EyeOff from "@lucide/svelte/icons/eye-off";
	import Lock from "@lucide/svelte/icons/lock";
	import { tick } from "svelte";
	import { editor } from "$lib/editor/editor.svelte.js";
	import type { Layer } from "$lib/editor/types.js";
	import { cn } from "$lib/utils.js";
	import LayerThumb from "./LayerThumb.svelte";

	let { layer }: { layer: Layer } = $props();

	let editing = $state(false);
	let draft = $state("");
	let input = $state<HTMLInputElement | null>(null);

	function startEditing(): void {
		editing = true;
		draft = layer.name;
		tick().then(() => {
			input?.focus();
			input?.select();
		});
	}

	function commit(): void {
		if (!editing) return;
		editor.renameLayer(layer.id, draft);
		editing = false;
	}

	function select(): void {
		editor.selectLayer(layer.id);
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			select();
		}
	}
</script>

<div
	class={cn(
		"group flex cursor-pointer items-center gap-2 rounded-lg border border-transparent px-1.5 py-1.5 transition-colors",
		layer.id === editor.activeLayerId
			? "border-border/70 bg-accent"
			: "hover:bg-accent/50",
	)}
	role="button"
	tabindex="0"
	aria-pressed={layer.id === editor.activeLayerId}
	onclick={select}
	onkeydown={handleKeydown}
>
	<button
		type="button"
		class={cn(
			"grid size-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-background/80",
			layer.visible ? "text-foreground" : "text-muted-foreground/50",
		)}
		title={layer.visible ? "Hide layer" : "Show layer"}
		aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
		onclick={(event) => {
			event.stopPropagation();
			editor.toggleLayerVisibility(layer.id);
		}}
	>
		{#if layer.visible}
			<Eye class="size-3.5" />
		{:else}
			<EyeOff class="size-3.5" />
		{/if}
	</button>

	<div
		class="checkerboard size-9 shrink-0 overflow-hidden rounded-md border bg-muted/40"
	>
		<LayerThumb {layer} />
	</div>

	<div class="min-w-0 flex-1">
		{#if editing}
			<input
				bind:this={input}
				bind:value={draft}
				class="h-6 w-full rounded border bg-background px-1 text-xs outline-none focus:ring-1 focus:ring-ring"
				onblur={commit}
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => {
					if (event.key === "Enter") event.currentTarget.blur();
					if (event.key === "Escape") {
						draft = layer.name;
						editing = false;
					}
				}}
			/>
		{:else}
			<button
				type="button"
				class="block w-full truncate text-left text-xs font-medium"
				ondblclick={(event) => {
					event.stopPropagation();
					startEditing();
				}}
				title="Double-click to rename"
			>
				{layer.name}
			</button>
		{/if}
		<div class="text-[10px] text-muted-foreground">
			{Math.round(layer.opacity * 100)}% · {layer.visible ? "Visible" : "Hidden"}
		</div>
	</div>

	{#if layer.locked}
		<Lock class="size-3 shrink-0 text-muted-foreground" />
	{/if}
</div>
