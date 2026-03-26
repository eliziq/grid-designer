const grid = document.getElementById("grid");
const containerIdInput = document.getElementById("containerId");
const colCountInput = document.getElementById("colCount");
const rowCountInput = document.getElementById("rowCount");
const buildGridButton = document.getElementById("buildGrid");
const clearGridButton = document.getElementById("clearGrid");
const exportCssButton = document.getElementById("exportCss");
const cssCode = document.getElementById("cssCode");
const elementNameInput = document.getElementById("elementName");
const addElementButton = document.getElementById("addElement");
const elementList = document.getElementById("elementList");

let rows = parseInt(rowCountInput.value, 10) || 1;
let cols = parseInt(colCountInput.value, 10) || 1;
let gridMatrix = [];
let elements = []; // [{id, name}]
let areas = {}; // {id: {id,rowStart,rowEnd,colStart,colEnd}}
let areaColors = {}; // id->hsl color
let resizeState = null;

function generateAreaColor(id) {
	const hue = (Array.from(id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) * 7) % 360;
	return `hsl(${hue}, 70%, 60%)`;
}

function sanitizeId(raw) {
	return raw
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "_")
		.replace(/[^a-z0-9_]/g, "");
}

function initMatrix() {
	gridMatrix = Array.from({ length: rows }, () => Array(cols).fill(null));
}

function hasConflict(r0, c0, r1, c1, id = null) {
	for (let r = r0; r <= r1; r++) {
		for (let c = c0; c <= c1; c++) {
			if (r < 0 || r >= rows || c < 0 || c >= cols) return true;
			const current = gridMatrix[r][c];
			if (current && current !== id) return true;
		}
	}
	return false;
}

function removeArea(id) {
	const area = areas[id];
	if (!area) return;
	for (let r = area.rowStart; r <= area.rowEnd; r++) {
		for (let c = area.colStart; c <= area.colEnd; c++) {
			if (gridMatrix[r][c] === id) {
				gridMatrix[r][c] = null;
			}
		}
	}
	delete areas[id];
}

function assignArea(id, r0, c0, r1, c1) {
	const rowStart = Math.min(r0, r1);
	const rowEnd = Math.max(r0, r1);
	const colStart = Math.min(c0, c1);
	const colEnd = Math.max(c0, c1);

	if (hasConflict(rowStart, colStart, rowEnd, colEnd, id)) return false;
	removeArea(id);
	areas[id] = { id, rowStart, rowEnd, colStart, colEnd };
	for (let r = rowStart; r <= rowEnd; r++) {
		for (let c = colStart; c <= colEnd; c++) {
			gridMatrix[r][c] = id;
		}
	}
	return true;
}

function renderGrid() {
	grid.innerHTML = "";
	grid.style.gridTemplateColumns = `repeat(${cols}, minmax(80px, 1fr))`;
	grid.style.gridTemplateRows = `repeat(${rows}, minmax(60px, 1fr))`;
	grid.style.position = "relative";
	grid.style.gap = "8px";

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const cell = document.createElement("div");
			cell.className = "cell";
			cell.dataset.row = r;
			cell.dataset.col = c;
			cell.draggable = false;
			cell.addEventListener("dragover", (e) => e.preventDefault());
			cell.addEventListener("drop", handleDrop);
			grid.appendChild(cell);
		}
	}

	renderAreas();
}

function renderAreas() {
	const gridRect = grid.getBoundingClientRect();
	const gap = 8;
	const cellWidth = (gridRect.width - gap * (cols - 1)) / cols;
	const cellHeight = (gridRect.height - gap * (rows - 1)) / rows;

	Object.values(areas).forEach((area) => {
		const element = elements.find((el) => el.id === area.id);
		const block = document.createElement("div");
		block.className = "area-block";
		block.dataset.areaId = area.id;
		const x = area.colStart * (cellWidth + gap);
		const y = area.rowStart * (cellHeight + gap);
		const width =
			(area.colEnd - area.colStart + 1) * cellWidth + (area.colEnd - area.colStart) * gap;
		const height =
			(area.rowEnd - area.rowStart + 1) * cellHeight + (area.rowEnd - area.rowStart) * gap;
		block.style.left = `${x}px`;
		block.style.top = `${y}px`;
		block.style.width = `${width}px`;
		block.style.height = `${height}px`;

		const color = areaColors[area.id] || (areaColors[area.id] = generateAreaColor(area.id));
		block.style.borderColor = color;
		block.style.background = `rgba(100, 160, 255, 0.2)`;
		block.style.boxShadow = `0 0 0 1px ${color}`;
		block.textContent = element ? element.name : area.id;
		block.addEventListener("pointerdown", handleAreaPointerDown);
		block.addEventListener("dragover", (e) => e.preventDefault());
		block.addEventListener("drop", handleDrop);
		grid.appendChild(block);
	});
}

function cellToGridPos(clientX, clientY) {
	const gridRect = grid.getBoundingClientRect();
	const x = clientX - gridRect.left;
	const y = clientY - gridRect.top;
	const computed = getComputedStyle(grid);
	const gap = parseFloat(computed.gap) || 0;
	const colSize = (gridRect.width - gap * (cols - 1)) / cols;
	const rowSize = (gridRect.height - gap * (rows - 1)) / rows;
	const col = Math.min(cols - 1, Math.max(0, Math.floor(x / (colSize + gap))));
	const row = Math.min(rows - 1, Math.max(0, Math.floor(y / (rowSize + gap))));
	return { row, col };
}

function isEdgePosition(event, block) {
	const rect = block.getBoundingClientRect();
	const threshold = 8;
	const x = event.clientX - rect.left;
	const y = event.clientY - rect.top;
	const right = x >= rect.width - threshold;
	const bottom = y >= rect.height - threshold;
	const left = x <= threshold;
	const top = y <= threshold;
	return { top, bottom, left, right, edge: top || bottom || left || right };
}

function handleAreaPointerDown(event) {
	event.stopPropagation();
	if (event.button !== 0) return;
	const block = event.currentTarget;
	const id = block.dataset.areaId;
	const area = areas[id];
	if (!area) return;
	const edge = isEdgePosition(event, block);
	if (!edge.edge) return;

	block.classList.toggle("edge-top", edge.top);
	block.classList.toggle("edge-bottom", edge.bottom);
	block.classList.toggle("edge-left", edge.left);
	block.classList.toggle("edge-right", edge.right);

	resizeState = {
		id,
		edge,
		startArea: { ...area },
		dragging: true,
	};
	window.addEventListener("pointermove", handlePointerMove);
	window.addEventListener("pointerup", handlePointerUp);
	document.body.style.cursor =
		edge.top || edge.bottom ? "ns-resize" : edge.left || edge.right ? "ew-resize" : "move";
}

function handlePointerMove(event) {
	if (!resizeState || !resizeState.dragging) return;
	const { row, col } = cellToGridPos(event.clientX, event.clientY);
	const { id, edge, startArea } = resizeState;
	let { rowStart, rowEnd, colStart, colEnd } = startArea;

	if (edge.top) rowStart = Math.min(row, rowEnd);
	if (edge.bottom) rowEnd = Math.max(row, rowStart);
	if (edge.left) colStart = Math.min(col, colEnd);
	if (edge.right) colEnd = Math.max(col, colStart);

	if (hasConflict(rowStart, colStart, rowEnd, colEnd, id)) {
		return;
	}

	areas[id] = { id, rowStart, rowEnd, colStart, colEnd };
	initMatrix();
	Object.values(areas).forEach((a) => {
		for (let rr = a.rowStart; rr <= a.rowEnd; rr++) {
			for (let cc = a.colStart; cc <= a.colEnd; cc++) {
				gridMatrix[rr][cc] = a.id;
			}
		}
	});
	renderGrid();
	updateCssPreview();
}

function handlePointerUp() {
	if (!resizeState) return;
	resizeState.dragging = false;
	resizeState = null;
	window.removeEventListener("pointermove", handlePointerMove);
	window.removeEventListener("pointerup", handlePointerUp);
	document.body.style.cursor = "default";
	Array.from(document.querySelectorAll(".area-block")).forEach((block) => {
		block.classList.remove("edge-top", "edge-bottom", "edge-left", "edge-right");
	});
	updateCssPreview();
}

function handleDrop(event) {
	event.preventDefault();
	const elementId = event.dataTransfer.getData("text/plain");
	if (!elementId) return;

	let r, c;
	if (event.currentTarget.classList.contains("cell")) {
		const cell = event.currentTarget;
		r = Number(cell.dataset.row);
		c = Number(cell.dataset.col);
	} else {
		const pos = cellToGridPos(event.clientX, event.clientY);
		r = pos.row;
		c = pos.col;
	}

	if (!assignArea(elementId, r, c, r, c)) {
		alert("Cannot place here; overlap existing area.");
		return;
	}
	renderGrid();
	updateCssPreview();
}

function renderElementList() {
	elementList.innerHTML = "";
	elements.forEach((element) => {
		const tag = document.createElement("div");
		tag.className = "element-tag";
		tag.draggable = true;
		tag.textContent = element.name;
		if (!areaColors[element.id]) areaColors[element.id] = generateAreaColor(element.id);
		tag.style.borderColor = areaColors[element.id];
		tag.addEventListener("dragstart", (e) => {
			e.dataTransfer.setData("text/plain", element.id);
		});

		const deleteBtn = document.createElement("button");
		deleteBtn.type = "button";
		deleteBtn.className = "deleteBtn";
		deleteBtn.textContent = "×";
		deleteBtn.addEventListener("click", () => removeElement(element.id));

		tag.appendChild(deleteBtn);
		elementList.appendChild(tag);
	});
}

function addElement() {
	const name = elementNameInput.value.trim();
	if (!name) return;
	const id = sanitizeId(name);
	if (!id) {
		alert("Element name must contain valid characters.");
		return;
	}
	if (elements.some((el) => el.id === id)) {
		alert("Element already exists");
		return;
	}
	elements.push({ id, name });
	elementNameInput.value = "";
	renderElementList();
}

function removeElement(id) {
	elements = elements.filter((el) => el.id !== id);
	removeArea(id);
	renderElementList();
	renderGrid();
	updateCssPreview();
}

function updateCssPreview() {
	const containerId = containerIdInput.value.trim() || "grid";
	const lines = [];
	for (let r = 0; r < rows; r++) {
		const rowCells = [];
		for (let c = 0; c < cols; c++) {
			rowCells.push(gridMatrix[r][c] || ".");
		}
		lines.push(`    "${rowCells.join(" ")}"`);
	}
	const template = `grid-template-areas:\n${lines.join("\n")};`;
	cssCode.textContent = `[id:${containerId}] {\n  display: grid;\n  grid-template-columns: repeat(${cols}, minmax(80px, 1fr));\n  grid-template-rows: repeat(${rows}, minmax(60px, 1fr));\n  gap: 8px;\n  ${template}\n}`;
}

buildGridButton.addEventListener("click", () => {
	cols = Math.max(1, parseInt(colCountInput.value, 10) || 1);
	rows = Math.max(1, parseInt(rowCountInput.value, 10) || 1);
	initMatrix();
	areas = {};
	renderGrid();
	renderElementList();
	updateCssPreview();
});

clearGridButton.addEventListener("click", () => {
	initMatrix();
	areas = {};
	renderGrid();
	updateCssPreview();
});

exportCssButton.addEventListener("click", () => {
	updateCssPreview();
	const blob = new Blob([cssCode.textContent], { type: "text/css" });
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = "grid-designer.css";
	document.body.appendChild(link);
	link.click();
	link.remove();
});

addElementButton.addEventListener("click", addElement);
elementNameInput.addEventListener("keydown", (e) => {
	if (e.key === "Enter") addElement();
});

colCountInput.addEventListener("change", () => buildGridButton.click());
rowCountInput.addEventListener("change", () => buildGridButton.click());

window.addEventListener("pointerup", handlePointerUp);

document.addEventListener("DOMContentLoaded", () => {
	buildGridButton.click();
});
