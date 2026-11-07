<script lang="ts">
	import PaletteIcon from "@lucide/svelte/icons/palette";
	import Plus from "@lucide/svelte/icons/plus";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Slider } from "$lib/components/ui/slider/index.js";
	import { colorWithAlpha, normalizeHex } from "$lib/editor/color.js";
	import { editor } from "$lib/editor/editor.svelte.js";
	import { cn } from "$lib/utils.js";

	let hexDraft = $state(editor.primaryColor);
	let hexFocused = $state(false);
	let alphaPercent = $derived(Math.round((editor.alpha / 255) * 100));

	$effect(() => {
		if (!hexFocused) hexDraft = editor.primaryColor;
	});

	function onHexInput(event: Event): void {
		const value = (event.currentTarget as HTMLInputElement).value;
		hexDraft = value;
		const normalized = normalizeHex(value);
		if (normalized) editor.setPrimaryColor(normalized);
	}

	function commitHex(): void {
		const normalized = normalizeHex(hexDraft);
		if (normalized) editor.setPrimaryColor(normalized);
		hexDraft = editor.primaryColor;
		hexFocused = false;
	}

	function onColorInput(event: Event): void {
		editor.setPrimaryColor((event.currentTarget as HTMLInputElement).value);
	}

	function choosePaletteColor(color: string): void {
		editor.setPrimaryColor(color);
		editor.alpha = 255;
	}
</script>

<section class="shrink-0 border-t">
	<header class="flex h-11 items-center justify-between border-b px-4">
		<div class="flex items-center gap-2">
			<PaletteIcon class="size-4 text-muted-foreground" />
			<span class="text-xs font-medium">Color</span>
		</div>
		<span class="font-mono text-[10px] uppercase text-muted-foreground">
			{editor.primaryColor} · {alphaPercent}%
		</span>
	</header>

	<div class="space-y-3 p-4">
		<div class="flex items-start gap-3">
			<label
				class="checkerboard relative block size-12 shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 ring-border focus-within:ring-2 focus-within:ring-ring"
			>
				<span
					class="absolute inset-0"
					style={`background-color: ${colorWithAlpha(editor.primaryColor, editor.alpha / 255)}`}
				></span>
				<input
					type="color"
					class="absolute inset-0 size-full cursor-pointer opacity-0"
					value={editor.primaryColor}
					oninput={onColorInput}
					aria-label="Choose color"
				/>
			</label>

			<div class="min-w-0 flex-1 space-y-2">
				<Input
					value={hexDraft}
					oninput={onHexInput}
					onfocus={() => (hexFocused = true)}
					onblur={commitHex}
					onkeydown={(event) => {
						if (event.key === "Enter") event.currentTarget.blur();
					}}
					maxlength={7}
					spellcheck={false}
					aria-label="Hex color"
					class="h-7 px-2 font-mono text-xs uppercase"
				/>

				<div class="flex items-center gap-2">
					<Slider type="single" min={0} max={255} step={1} bind:value={editor.alpha} class="flex-1" />
					<span class="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
						{alphaPercent}%
					</span>
				</div>
			</div>
		</div>

		<div class="flex items-center justify-between pt-1">
			<span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
				Palette
			</span>
			<Button
				variant="ghost"
				size="icon-xs"
				class="text-muted-foreground"
				onclick={() => editor.addPaletteColor()}
				title="Add current color to palette"
				aria-label="Add current color to palette"
			>
				<Plus class="size-3.5" />
			</Button>
		</div>

		<div class="grid grid-cols-8 gap-1.5">
			{#each editor.palette as color (color)}
				<button
					type="button"
					class={cn(
						"aspect-square rounded-[5px] ring-1 ring-black/10 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						editor.primaryColor === color &&
							editor.alpha === 255 &&
							"ring-2 ring-foreground ring-offset-2 ring-offset-background",
					)}
					style={`background-color: ${color}`}
					title={color}
					aria-label={`Use color ${color}`}
					onclick={() => choosePaletteColor(color)}
				></button>
			{/each}
		</div>
	</div>
</section>

