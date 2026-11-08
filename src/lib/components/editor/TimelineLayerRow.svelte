<script lang="ts">
	import Eye from "@lucide/svelte/icons/eye";
	import EyeOff from "@lucide/svelte/icons/eye-off";
	import Lock from "@lucide/svelte/icons/lock";
	import LockOpen from "@lucide/svelte/icons/lock-open";
	import { tick } from "svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import type { Layer } from "$lib/editor/types.js";
	import { cn } from "$lib/utils.js";
	import CelThumb from "./CelThumb.svelte";

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
</script>

<tr>
	<th
		scope="row"
		class={cn(
			"sticky left-0 z-10 h-12 w-60 min-w-60 max-w-60 border-b border-r p-0 text-left align-middle",
			layer.id === editor.activeLayerId ? "bg-accent" : "bg-background",
		)}
	>
		<div class="flex h-12 items-center gap-1.5 px-2">
			<Button
				variant="ghost"
				size="icon-xs"
				class={cn(
					"size-7 shrink-0",
					layer.visible ? "text-foreground" : "text-muted-foreground/50",
				)}
				title={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
				aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
				onclick={() => editor.toggleLayerVisibility(layer.id)}
			>
				{#if layer.visible}
					<Eye class="size-3.5" />
				{:else}
					<EyeOff class="size-3.5" />
				{/if}
			</Button>

			<Button
				variant="ghost"
				size="icon-xs"
				class={cn(
					"size-7 shrink-0",
					layer.locked ? "text-foreground" : "text-muted-foreground",
				)}
				title={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
				aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
				aria-pressed={layer.locked}
				onclick={() => editor.toggleLayerLock(layer.id)}
			>
				{#if layer.locked}
					<Lock class="size-3.5" />
				{:else}
					<LockOpen class="size-3.5" />
				{/if}
			</Button>

			<div class="min-w-0 flex-1">
				{#if editing}
					<input
						bind:this={input}
						bind:value={draft}
						class="h-6 w-full rounded border bg-background px-1 text-xs outline-none focus:ring-1 focus:ring-ring"
						onblur={commit}
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
						class="block w-full rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onclick={select}
						ondblclick={(event) => {
							event.stopPropagation();
							startEditing();
						}}
						aria-pressed={layer.id === editor.activeLayerId}
						title="Double-click to rename"
					>
						<span class="block truncate text-xs font-medium">{layer.name}</span>
						<span class="block truncate text-[10px] text-muted-foreground">
							{Math.round(layer.opacity * 100)}% · {layer.visible ? "Visible" : "Hidden"}
						</span>
					</button>
				{/if}
			</div>
		</div>
	</th>

	{#each editor.doc.frames as frame, index (frame.id)}
		{@const activeRow = layer.id === editor.activeLayerId}
		{@const activeFrame = index === editor.activeFrame}
		{@const activeCel = activeRow && activeFrame}

		<td
			class={cn(
				"h-12 w-14 min-w-14 border-b border-r p-1 text-center align-middle",
				(activeRow || activeFrame) && "bg-accent/40",
				activeCel && "bg-accent/60",
			)}
		>
			<button
				type="button"
				class={cn(
					"checkerboard relative inline-block size-10 overflow-hidden rounded-md border transition-all",
					activeCel
						? "border-primary ring-2 ring-primary/40"
						: "border-border/60 hover:border-muted-foreground/40",
				)}
				onclick={() => {
					editor.selectLayer(layer.id);
					editor.selectFrame(index);
				}}
				aria-label={`${layer.name}, frame ${index + 1}`}
				aria-pressed={activeCel}
				title={`${layer.name} · frame ${index + 1}`}
			>
				<CelThumb {layer} frame={index} />
			</button>
		</td>
	{/each}

	<td class="h-12 w-10 min-w-10 border-b"></td>
	<td class="h-12 border-b"></td>
</tr>
