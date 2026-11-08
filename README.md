# Pixel Spell

A focused pixel art editor that runs entirely in the browser. Draw sprites, build layered artwork, and animate frame by frame with a clean, modern interface.

![Pixel Spell screenshot](docs/screenshot.jpg)

## Features

- **Drawing tools** — pencil, eraser, line, rectangle, ellipse, paint bucket, and eyedropper.
- **Tool options** — brush sizes from 1–8 px, filled shapes, X/Y symmetry, fill tolerance and contiguous fill, and layer-aware color sampling.
- **Aseprite-style timeline** — layers are rows and frames are columns. Click any cel to select its layer and frame; sticky headers keep both axes visible while scrolling. Add, duplicate, reorder, rename, hide, delete, and adjust layer opacity; add, duplicate, and delete frames; play the animation at 1–60 fps.
- **Resizable workspace** — drag the divider above the timeline, or focus it and use `↑` / `↓`, to resize the canvas/timeline split. The height is remembered between visits.
- **Color workflow** — hex input, native color picker, alpha slider, and a 32-color palette you can extend.
- **History** — 80-step undo/redo stack with keyboard shortcuts.
- **Export** — current frame as PNG, or every frame as a horizontal sprite sheet.
- **Projects** — save and open portable `.pixelspell.json` files.
- **Canvas controls** — fit-to-window or manual zoom, pixel grid, and a live cursor preview.
- **Light and dark themes**, persisted in `localStorage`.

## Tech stack

- [Svelte 5](https://svelte.dev/) with runes
- [Vite](https://vite.dev/) + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/)
- [shadcn-svelte](https://shadcn-svelte.com/) (Nova preset) and [bits-ui](https://bits-ui.com/)
- [Lucide](https://lucide.dev/) icons

## Getting started

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`).

### Scripts

| Command           | Description                                  |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Start the Vite dev server                    |
| `npm run build`   | Build for production                          |
| `npm run preview` | Preview the production build locally         |
| `npm run check`   | Run `svelte-check` and TypeScript validation |

## Keyboard shortcuts

| Action              | Shortcut                 |
| ------------------- | ------------------------ |
| Pencil              | `B`                      |
| Eraser              | `E`                      |
| Line                | `L`                      |
| Rectangle           | `R`                      |
| Ellipse             | `O`                      |
| Fill                | `G`                      |
| Eyedropper          | `I`                      |
| Undo / redo         | `Ctrl+Z` / `Ctrl+Shift+Z` |
| New sprite          | `Ctrl+N`                 |
| Save project        | `Ctrl+S`                 |
| Play / pause        | `Space`                  |
| Previous / next frame | `[` / `]` or `,` / `.`  |
| Toggle pixel grid   | `Shift+G`                |
| Resize timeline     | Drag divider, or `↑` / `↓` |

Shortcuts are ignored while typing in an input. The Help menu also lists them.

## Project structure

```
src/
├── App.svelte                  # App shell, layout, global shortcuts
├── app.css                     # Tailwind, shadcn theme, editor surface styles
└── lib/
    ├── components/
    │   ├── editor/             # Menu bar, tool strip, tool/color panels, canvas, timeline, dialogs
    │   └── ui/                 # shadcn-svelte components
    └── editor/
        ├── editor.svelte.ts    # Reactive editor state (Svelte 5 runes)
        ├── types.ts            # Document, layer, frame, and tool types
        ├── doc.ts              # Document creation, cloning, compositing
        ├── draw.ts             # Brush, line, shape, and fill algorithms
        ├── render.ts           # Canvas and thumbnail rendering helpers
        ├── color.ts            # Packed RGBA and hex color utilities
        ├── file.ts             # PNG export and project serialization
        ├── palette.ts          # Default palette
        └── tools.ts            # Tool metadata and shortcuts
```

## Data model

A document is a `PixelDoc`:

- `width`, `height`, `fps`
- `frames[]` — animation frames
- `layers[]` — ordered bottom-to-top; each layer has visibility, opacity, and one `Uint32Array` cel per frame

Pixels are packed little-endian RGBA (`0xAABBGGRR`), which lets cels be written directly into `ImageData` for rendering and PNG export. Transparent pixels are `0`.

Project files store each cel as a base64 string, so they are portable between browsers and easy to inspect.

## Notes and limitations

- The timeline is an Aseprite-style grid: layer rows and frame columns, with sticky headers and cel thumbnails. Its height is remembered in `localStorage`.
- Layer visibility and opacity are document-wide rather than per-frame.
- Brushes are square and pixel-aligned; there is no selection or move tool yet.
- The editor does not auto-save. Use **File → Save project** to keep your work.
- The default canvas is 32 × 32; new sprites can be 1–256 px in each dimension.
