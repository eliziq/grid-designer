# Grid Designer (Vanilla JS Starter)

Simple vanilla JavaScript grid designer for quickly prototyping CSS grid layouts.

## Quick start

1. Open `index.html` in your browser.
2. Set banner id and banner dimentions and click `Build Grid`.
3. REsize and move cells
4. Click `Export CSS` to download a CSS file.

## Project files

- `index.html` – UI skeleton
- `style.css` – Base layout and cell styles
- `script.js` – Entry point loader (loads all project scripts)
- `grid-designer-class.js` – Core GridDesigner class + static normalization helpers
- `grid-designer-state.js` – Resolution state, persistence, and CSS generation
- `grid-designer-layout.js` – Grid geometry and area conflict/layout helpers
- `grid-designer-render.js` – Rendering logic for grid, areas, controls, and scaling
- `grid-designer-interactions.js` – Event handlers and interaction flow
- `grid-designer-api.js` – Public `window.GridDesigner` API surface
- `README.md` – Project instructions
