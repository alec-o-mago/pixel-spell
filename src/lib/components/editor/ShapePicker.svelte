<script lang="ts">
	import Circle from "@lucide/svelte/icons/circle";
	import Heart from "@lucide/svelte/icons/heart";
	import Square from "@lucide/svelte/icons/square";
	import Star from "@lucide/svelte/icons/star";
	import { Button } from "$lib/components/ui/button/index.js";
	import type { ShapeKind } from "$lib/editor/types.js";

	let { value = $bindable<ShapeKind>("rectangle") }: { value?: ShapeKind } = $props();

	const shapes: { id: ShapeKind; label: string; icon: typeof Square }[] = [
		{ id: "rectangle", label: "Rectangle", icon: Square },
		{ id: "ellipse", label: "Ellipse", icon: Circle },
		{ id: "star", label: "Star", icon: Star },
		{ id: "heart", label: "Heart", icon: Heart },
	];
</script>

<div class="grid grid-cols-4 gap-1.5" role="group" aria-label="Shape">
	{#each shapes as shape (shape.id)}
		{@const Icon = shape.icon}
		<Button
			variant={value === shape.id ? "secondary" : "outline"}
			size="sm"
			class="h-auto flex-col gap-1 px-1 py-2"
			onclick={() => (value = shape.id)}
			title={shape.label}
			aria-label={shape.label}
			aria-pressed={value === shape.id}
		>
			<Icon class="size-4" />
			<span class="text-[10px]">{shape.label}</span>
		</Button>
	{/each}
</div>
