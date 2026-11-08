<script lang="ts">
	import Plus from "@lucide/svelte/icons/plus";
	import X from "@lucide/svelte/icons/x";
	import { tick } from "svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import { cn } from "$lib/utils.js";

	let { onNew }: { onNew: () => void } = $props();

	let closeDialogOpen = $state(false);
	let pendingCloseId = $state<string | null>(null);
	let pendingName = $state("");

	function requestClose(id: string): void {
		if (editor.projects.length === 1 && !editor.isProjectModified(id)) return;
		if (!editor.isProjectDirty(id)) {
			editor.closeProject(id);
			return;
		}
		pendingCloseId = id;
		pendingName = editor.projectName(id);
		closeDialogOpen = true;
	}

	function cancelClose(): void {
		closeDialogOpen = false;
		pendingCloseId = null;
	}

	function confirmClose(): void {
		const id = pendingCloseId;
		closeDialogOpen = false;
		pendingCloseId = null;
		if (id) editor.closeProject(id);
	}

	$effect(() => {
		editor.activeProjectId;
		editor.projects.length;
		tick().then(() => {
			document
				.querySelector('[role="tab"][aria-selected="true"]')
				?.scrollIntoView({ block: "nearest", inline: "nearest" });
		});
	});
</script>

<div class="flex h-11 shrink-0 items-end gap-1 bg-background px-2">
	<div
		role="tablist"
		aria-label="Projects"
		class="no-scrollbar flex h-full min-w-0 flex-1 items-end gap-1 overflow-x-auto"
	>
		{#each editor.projects as project (project.id)}
			{@const active = project.id === editor.activeProjectId}
			{@const name = editor.projectName(project.id)}
			{@const dirty = editor.isProjectDirty(project.id)}
			{@const closeDisabled =
				editor.projects.length === 1 && !editor.isProjectModified(project.id)}

			<div
				role="presentation"
				class={cn(
					"group flex h-8 min-w-0 max-w-52 shrink-0 items-center rounded-t-md border text-xs transition-colors",
					active
						? "border-border/60 border-b-0 bg-muted/20 text-foreground"
						: "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
				)}
			>
				<button
					type="button"
					role="tab"
					aria-selected={active}
					class="flex min-w-0 flex-1 items-center gap-1.5 rounded-tl-md py-1.5 pl-2.5 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
					onclick={() => editor.selectProject(project.id)}
					title={name}
				>
					<span class="max-w-36 truncate">{name}</span>
					{#if dirty}
						<span
							class="size-1.5 shrink-0 rounded-full bg-primary"
							title="Unsaved changes"
						></span>
					{/if}
				</button>

				<button
					type="button"
					class={cn(
						"mr-1 grid size-5 shrink-0 place-items-center rounded-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30",
						active ? "opacity-70" : "opacity-50 group-hover:opacity-100",
					)}
					onclick={(event) => {
						event.stopPropagation();
						requestClose(project.id);
					}}
					disabled={closeDisabled}
					aria-label={`Close ${name}`}
					title={closeDisabled ? "The only project cannot be closed" : `Close ${name}`}
				>
					<X class="size-3" />
				</button>
			</div>
		{/each}
	</div>

	<Button
		variant="ghost"
		size="icon-xs"
		class="mb-1.5 shrink-0 text-muted-foreground"
		onclick={onNew}
		title="New project"
		aria-label="New project"
	>
		<Plus class="size-3.5" />
	</Button>
</div>

<Dialog.Root bind:open={closeDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Close “{pendingName}”?</Dialog.Title>
			<Dialog.Description>
				This project has unsaved changes. Closing it will discard them.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={cancelClose}>Cancel</Button>
			<Button variant="destructive" onclick={confirmClose}>
				Close without saving
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
