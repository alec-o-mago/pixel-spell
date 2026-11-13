<script lang="ts">
	import type { ReferenceImage } from "$lib/editor/types.js";

	let { reference }: { reference: ReferenceImage } = $props();

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
</script>

{#if url}
	<img
		src={url}
		alt=""
		draggable="false"
		class="size-full object-contain [image-rendering:auto]"
	/>
{/if}
