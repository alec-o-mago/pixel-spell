<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Tooltip from "$lib/components/ui/tooltip/index.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import { TOOLS } from "$lib/editor/tools.js";
	import { cn } from "$lib/utils.js";
	import ToolIcon from "./ToolIcon.svelte";

	// Pan/zoom | selection tools | paint tools | fill/eyedropper
	const SEPARATOR_BEFORE = new Set([2, 7, 12]);
</script>

<aside
	class="flex w-14 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r bg-muted/20 py-2"
	aria-label="Tools"
>
	{#each TOOLS as tool, index (tool.id)}
		{#if SEPARATOR_BEFORE.has(index)}
			<Separator class="my-1 w-7" />
		{/if}

		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="icon-lg"
						class={cn(
							"size-10 rounded-lg text-muted-foreground",
							editor.tool === tool.id &&
								"bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground dark:hover:bg-primary/90 dark:hover:text-primary-foreground",
						)}
						aria-label={`${tool.label} (${tool.shortcut})`}
						aria-pressed={editor.tool === tool.id}
						onclick={() => editor.setTool(tool.id)}
					>
						<ToolIcon tool={tool.id} class="size-[18px]" />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="right" sideOffset={10} class="px-2.5 py-1.5">
				<div class="flex items-center gap-2">
					<div class="grid gap-0.5">
						<span class="text-xs font-medium">{tool.label}</span>
						<span class="text-[11px] opacity-70">{tool.description}</span>
					</div>
					<kbd
						data-slot="kbd"
						class="ml-1 rounded border border-background/25 px-1 font-mono text-[10px] opacity-80"
					>
						{tool.shortcut}
					</kbd>
				</div>
			</Tooltip.Content>
		</Tooltip.Root>
	{/each}
</aside>
