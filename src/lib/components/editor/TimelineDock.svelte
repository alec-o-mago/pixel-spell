<script lang="ts">
	import { cn } from "$lib/utils.js";
	import TimelinePanel from "./TimelinePanel.svelte";

	const MIN_HEIGHT = 180;
	const DEFAULT_HEIGHT = 280;
	const STORAGE_KEY = "pixel-spell-timeline-height";

	function maxHeight(): number {
		return Math.max(MIN_HEIGHT, window.innerHeight - 44 - 140);
	}

	function clampHeight(value: number): number {
		return Math.max(MIN_HEIGHT, Math.min(maxHeight(), Math.round(value)));
	}

	function storedHeight(): number {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			const value = raw === null ? Number.NaN : Number(raw);
			if (Number.isFinite(value) && value > 0) return clampHeight(value);
		} catch {
			// Storage can be unavailable in private browsing contexts.
		}
		return DEFAULT_HEIGHT;
	}

	let height = $state(storedHeight());
	let resizing = $state(false);
	let handle = $state<HTMLDivElement | null>(null);
	let startY = 0;
	let startHeight = 0;

	function persist(): void {
		try {
			localStorage.setItem(STORAGE_KEY, String(height));
		} catch {
			// Ignore storage restrictions.
		}
	}

	function beginResize(event: PointerEvent): void {
		if (event.button !== 0) return;
		event.preventDefault();
		resizing = true;
		startY = event.clientY;
		startHeight = height;
		document.body.style.cursor = "row-resize";
		document.body.style.userSelect = "none";
		try {
			handle?.setPointerCapture(event.pointerId);
		} catch {
			// Synthetic pointer events may not own a capture target.
		}
	}

	function handlePointerMove(event: PointerEvent): void {
		if (!resizing) return;
		height = clampHeight(startHeight + (startY - event.clientY));
	}

	function endResize(event?: PointerEvent): void {
		if (!resizing) return;
		resizing = false;
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
		if (event && handle?.hasPointerCapture(event.pointerId)) {
			handle.releasePointerCapture(event.pointerId);
		}
		persist();
	}

	function handleKeydown(event: KeyboardEvent): void {
		const step = event.shiftKey ? 48 : 16;
		if (event.key === "ArrowUp") {
			event.preventDefault();
			height = clampHeight(height + step);
			persist();
		} else if (event.key === "ArrowDown") {
			event.preventDefault();
			height = clampHeight(height - step);
			persist();
		} else if (event.key === "Home") {
			event.preventDefault();
			height = MIN_HEIGHT;
			persist();
		} else if (event.key === "End") {
			event.preventDefault();
			height = maxHeight();
			persist();
		}
	}

	$effect(() => {
		const onResize = () => {
			height = clampHeight(height);
		};
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	});

	$effect(() => {
		return () => {
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};
	});
</script>

<div class="relative flex min-h-0 shrink-0 flex-col" style:height={`${height}px`}>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={handle}
		class="group absolute -top-1 left-0 right-0 z-40 h-2 cursor-row-resize touch-none select-none hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		role="separator"
		aria-orientation="horizontal"
		aria-label="Resize timeline"
		aria-valuemin={MIN_HEIGHT}
		aria-valuemax={Math.round(maxHeight())}
		aria-valuenow={Math.round(height)}
		tabindex="0"
		onpointerdown={beginResize}
		onpointermove={handlePointerMove}
		onpointerup={endResize}
		onpointercancel={endResize}
		onkeydown={handleKeydown}
		title="Drag to resize the timeline"
	>
		<span
			class="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border transition-colors group-hover:bg-primary/30"
		></span>
		<span
			class={cn(
				"absolute left-1/2 top-1/2 h-1 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors",
				resizing ? "bg-primary" : "bg-border group-hover:bg-primary/60",
			)}
		></span>
	</div>

	<TimelinePanel />
</div>
