# Performance report

This document records the before/after measurements for the performance pass.
The numbers come from two harnesses:

- **Core benchmarks** (`npm run bench`) run the real TypeScript modules in Node 26 with deterministic, seeded documents. Each row is the median of repeated iterations after warm-up. Absolute times vary by roughly ±10% between runs, so compare the relative changes rather than the last digit.
- **UI benchmark** runs the app in Chromium through the in-app browser on a 128 × 128 document with 8 layers × 20 frames (160 cels and 160 timeline thumbnails). It counts `CanvasRenderingContext2D.putImageData` calls and measures wall-clock time. The wall-clock measurement waits for two animation frames, so it has a ~33 ms floor; the `putImageData` count and the synchronous handler time are the useful comparisons.

## Core benchmarks

| Benchmark | Before | After | Change |
| --- | ---: | ---: | ---: |
| `compositeFrame` 512×512 × 4 layers (6 frames) | 31.27 ms | 16.83 ms | **−46%** |
| `compositeFrame` 128×128 × 6 layers (20 frames) | 10.48 ms | 5.53 ms | **−47%** |
| `cloneDoc` 512×512 × 4 layers × 6 frames | 6.00 ms | 4.86 ms | −19% |
| `fillPixels` full 512×512 | 0.592 ms | 0.231 ms | **−61%** |
| `gradientPixels` full 512×512 (Bayer 4×4) | 0.655 ms | 0.235 ms | **−64%** |
| `blurPixels` radius 16 on 512×512 | 0.529 ms | 0.295 ms | **−44%** |
| `jumblePixels` radius 16 on 512×512 | 0.171 ms | 0.214 ms | noise |
| `paintBrush` 10k stamps, size 4, 2 mirrors | 3.67 ms | 3.72 ms | unchanged |
| `plotShape` star outline 256×256 | 0.223 ms | 0.240 ms | unchanged |
| `sprayPixels` radius 16, 400 shots | 0.196 ms | 0.191 ms | unchanged |
| `magicWandMask` 512×512 | 0.155 ms | 0.177 ms | noise |
| `selectionBounds` full 512×512 | 0.534 ms | 0.027 ms | **−95%** |
| `lassoSelectionMask` 240 points | 0.742 ms | 0.741 ms | unchanged |
| `serializeProject` 256×256 × 4 layers × 12 frames | 319.97 ms / 16,778,864 B | 18.69 ms / 6,132,755 B | **−94% time, −63% size** |
| `parseProject` same file | 36.28 ms | 12.60 ms | **−65%** |
| `exportGif` 128×128 × 12 frames | 44.58 ms / 81,126 B | 41.78 ms / 81,137 B | −6% |
| `exportGif` output size | 81,126 B | 81,137 B | unchanged |

`jumblePixels`, `paintBrush`, `plotShape`, `sprayPixels`, `magicWandMask`, and `lassoSelectionMask` were not the focus of this pass. Small positive/negative changes there are run-to-run noise.

## UI benchmark

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| `putImageData` calls per `editor.touch()` | 161 | 2 | **−99%** |
| `putImageData` calls when selecting a layer | 0 | 1 | one active-cell refresh |
| `putImageData` calls when selecting a frame | 1 | 2 | one active-cell refresh |
| `putImageData` calls when adding a frame | 169 | 169 | structural redraw |
| `editor.touch()` wall-clock, median | 51.9 ms | 33.3 ms | two-frame floor; ~35 ms work → below one frame |
| 40-move stroke wall-clock, median | 56.3 ms | 33.4 ms | two-frame floor; ~40 ms work → below one frame |
| 40-move stroke synchronous handler time | 5.9 ms | 1.1 ms | **−81%** |

The important UI result is that a brush stamp used to redraw every thumbnail in the timeline (161 full-canvas `putImageData` calls for 160 cels plus the main canvas). It now redraws only the main canvas and the active cel (2 calls). The timeline no longer becomes a per-stroke cost.

## What changed

### Rendering and compositing

- Added `compositeFrameCached(doc, frame, revision)` with a small per-document frame cache (8 frames). The viewport and preview share the same composited buffer instead of compositing twice.
- Added fast alpha paths to `compositeFrame`: fully transparent source, empty destination, and fully opaque source skip the full blend. The full blend uses a 256 × 256 alpha-product table and integer rounding instead of `Math.round` calls.
- Added `compositePixel` for the eyedropper, so picking a color no longer composites the entire frame.
- `render.ts` now reuses a scratch canvas and `ImageData` for all draw paths (`drawPixels`, `drawScaled`, `drawThumbnail`) instead of allocating a canvas per draw.
- `drawPixels` writes directly through `putImageData`; export source canvases and floating selections no longer allocate a new canvas per frame.

### Timeline and invalidation

- Added `editor.structureRevision`. `CelThumb` redraws all cells only on structural changes and redraws on `editor.revision` only for the active cel. It also tracks `drawnStructure`/`drawnRevision` so selecting a different layer/frame does not redraw every thumbnail.
- `CanvasStage` coalesces sprite, overlay, and mirror draws into `requestAnimationFrame`, so a burst of pointer moves produces one draw per frame.
- Mirror guides no longer bump `editor.revision` on toggle or drag, and the mirror overlay early-returns when no guides exist. Panning/zooming with mirrors off no longer clears a full-stage canvas.
- Cached the stage bounding rect instead of calling `getBoundingClientRect()` for every pointer event.
- The active cel is the only thumbnail that refreshes during drawing; `clearFrame` and undo/redo explicitly increment `structureRevision` so affected cells refresh.

### History

- Pixel edits record a single previous cel (`pushHistoryCel`) instead of cloning every layer and frame. Structural edits still record a full snapshot.
- `clearFrame` records a multi-cel patch (`pushHistoryCels`).
- History is capped at 80 entries and about 128 MB per project, with byte accounting across project switches.
- Fill and gradient record history lazily, only when the first pixel actually changes, so a no-op click does not create an empty undo entry.

### Drawing algorithms

- `matchingRegionMask` now returns the affected bounds, uses a queue-once stack, and fill/gradient iterate only the bounding rectangle instead of the whole canvas.
- `blurPixels` copies only the affected disk plus a one-pixel kernel border instead of the whole cel.
- `magicWandMask` queues each pixel once and uses a typed mask/visited representation.
- `selectionBounds` scans rows with native `indexOf`/`lastIndexOf`.
- The selection outline traces horizontal runs instead of testing four neighbors per selected pixel.
- Gradient radial distance uses `Math.sqrt` instead of the slower `Math.hypot`.
- Mirror axes are captured once per stroke instead of being rebuilt for every brush stamp.

### Project files

- Project files use a binary `PXSP` container: a compact header, a UTF-8 metadata block, and per-cel raw RGBA or RLE (whichever is smaller).
- Parsing rejects oversized dimensions, layer/frame counts, total cel bytes, duplicate layer ids, and huge palettes before allocating memory.
- The GIF exporter caches composited frames when the document is small enough, avoiding a second composite pass. `ByteWriter.writeBytes` uses a bulk `set`.

## Reproducing

```bash
npm run bench
```

The benchmark also asserts that sparse and flat documents round-trip exactly.

The UI numbers were collected with an in-app browser script. A compact version of the measurement:

```js
const urls = performance.getEntriesByType("resource")
  .map((entry) => entry.name)
  .filter((name) => name.includes("/src/lib/editor/editor.svelte.ts"));
const { editor } = await import(urls.find((name) => name.includes("?t=")) ?? urls[0]);
const raf2 = () => new Promise((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(resolve)));

editor.newProject(128, 128, { name: "Bench" });
for (let i = 0; i < 7; i++) editor.addLayer();
for (let i = 0; i < 19; i++) editor.addFrame();
await raf2();

let puts = 0;
const original = CanvasRenderingContext2D.prototype.putImageData;
CanvasRenderingContext2D.prototype.putImageData = function (...args) {
  puts++;
  return original.apply(this, args);
};

puts = 0;
editor.touch();
await raf2();
console.log("putImageData calls per touch:", puts);

CanvasRenderingContext2D.prototype.putImageData = original;
```

## Remaining performance work

These were intentionally left out of this pass because they are larger changes:

- **Timeline virtualization.** Adding a frame still redraws every thumbnail (169 `putImageData` calls for the 8 × 21 benchmark document). For very large layer × frame counts, virtualize off-screen rows/columns or draw thumbnails from a shared atlas.
- **Incremental compositing.** `compositeFrame` still blends every visible layer. Cache the composite below each layer and recomposite only the edited layer and the layers above it.
- **Code splitting.** The production bundle is ~515 kB (~153 kB gzip) and Vite warns about the chunk size. Lazy-load the export/import dialogs and the GIF/PNG encoders so the initial editor shell loads sooner.
- **Worker-based export.** GIF encoding and large sprite-sheet exports run on the main thread. Move them to a worker to keep the UI responsive on large animations.
- **Faster GIF palette lookup.** `buildGifPalette` builds a 32,768-entry nearest-color table by scanning every palette color. Compute entries only for 5-bit buckets that actually occur in the source frames.
- **Pixel-perfect stroke repaint.** Corner removal currently restores the backup cel and repaints the whole stroke. Repaint only the local neighborhood of the removed corner.
