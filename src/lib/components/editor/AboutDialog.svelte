<script lang="ts">
	import WandSparkles from "@lucide/svelte/icons/wand-sparkles";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";

	let { open = $bindable(false) } = $props();

	const stack = ["Svelte 5", "Vite", "TypeScript", "shadcn-svelte", "Lucide"];
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<div class="flex items-center gap-3">
				<div
					class="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"
				>
					<WandSparkles class="size-5" />
				</div>
				<div class="grid gap-1">
					<Dialog.Title>Pixel Spell</Dialog.Title>
					<Dialog.Description>A small, focused pixel art editor.</Dialog.Description>
				</div>
			</div>
		</Dialog.Header>

		<div class="grid gap-4 py-2 text-sm text-muted-foreground">
			<p>
				Draw sprites, build layered artwork and animate frame by frame. Everything runs
				in the browser and projects can be saved as portable JSON files.
			</p>
			<div class="flex flex-wrap gap-1.5">
				{#each stack as item (item)}
					<Badge variant="outline">{item}</Badge>
				{/each}
			</div>
			<p class="font-mono text-[10px] text-muted-foreground/80">Version 0.1.0</p>
		</div>

		<Dialog.Footer>
			<Button onclick={() => (open = false)}>Close</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
