<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";

	let { open = $bindable(false) } = $props();

	const groups = [
		{
			title: "Tools",
			items: [
				{ label: "Pencil", keys: "B" },
				{ label: "Eraser", keys: "E" },
				{ label: "Fill", keys: "G" },
				{ label: "Eyedropper", keys: "I" },
				{ label: "Line", keys: "L" },
				{ label: "Rectangle", keys: "R" },
				{ label: "Ellipse", keys: "O" },
			],
		},
		{
			title: "Canvas & timeline",
			items: [
				{ label: "Undo", keys: "Ctrl Z" },
				{ label: "Redo", keys: "Ctrl ⇧ Z" },
				{ label: "New sprite", keys: "Ctrl N" },
				{ label: "Save project", keys: "Ctrl S" },
				{ label: "Play / pause", keys: "Space" },
				{ label: "Previous frame", keys: "[" },
				{ label: "Next frame", keys: "]" },
				{ label: "Toggle grid", keys: "⇧ G" },
			],
		},
	];
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Keyboard shortcuts</Dialog.Title>
			<Dialog.Description>
				Most actions also live in the menu bar and in the panels.
			</Dialog.Description>
		</Dialog.Header>

		<div class="grid gap-6 py-2 sm:grid-cols-2">
			{#each groups as group (group.title)}
				<div class="grid content-start gap-2">
					<h3
						class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
					>
						{group.title}
					</h3>
					{#each group.items as item (item.label)}
						<div class="flex items-center justify-between gap-3 text-sm">
							<span class="text-muted-foreground">{item.label}</span>
							<kbd
								class="shrink-0 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
							>
								{item.keys}
							</kbd>
						</div>
					{/each}
				</div>
			{/each}
		</div>

		<Dialog.Footer>
			<Button onclick={() => (open = false)}>Got it</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
