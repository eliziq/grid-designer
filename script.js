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
const mainMaxWidthInput = document.getElementById("mainMaxWidth");
const bannerWidthInput = document.getElementById("bannerWidth");
const bannerHeightInput = document.getElementById("bannerHeight");

let rows = 4;
let cols = 24;
let gridMatrix = [];
let elements = []; // [{id, name}]
let areas = {}; // {id: {id,rowStart,rowEnd,colStart,colEnd}}
let areaColors = {}; // id->hsl color
let rowHeights = []; // Array of height values for each row, default "1fr"
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
	grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
	grid.style.gridTemplateRows = `repeat(${rows}, minmax(60px, 1fr))`; // Use consistent height for visual display
	grid.style.width = `${gridWidth}px`;
	grid.style.height = `${gridHeight}px`;
	grid.style.minHeight = "auto";

	// Update grid wrapper to match grid size
	const gridWrapper = document.getElementById("gridWrapper");
	gridWrapper.style.width = `${gridWidth + 20}px`;
	gridWrapper.style.height = `${gridHeight + 20}px`;
	
	updateGridScaling();

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
	const gap = 8;
	const cellWidth = (gridWidth - gap * (cols - 1)) / cols;
	const cellHeight = (gridHeight - gap * (rows - 1)) / rows;

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
		block.addEventListener("pointermove", (e) => {
			const edge = isEdgePosition(e, block);
			if (edge.edge) {
				block.style.cursor = edge.left || edge.right ? "ew-resize" : "ns-resize";
			} else {
				block.style.cursor = "move";
			}
		});
		block.addEventListener("pointerleave", () => {
			block.style.cursor = "move";
		});
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
	
	// Get the current scale factor from the wrapper
	const gridWrapper = document.getElementById("gridWrapper");
	const scale = parseFloat(getComputedStyle(gridWrapper).getPropertyValue('--grid-scale') || '1');
	
	// Use original grid dimensions, accounting for scale
	const colSize = (gridWidth - gap * (cols - 1)) / cols;
	const rowSize = (gridHeight - gap * (rows - 1)) / rows;
	
	// Adjust mouse position for scaling
	const scaledX = x / scale;
	const scaledY = y / scale;
	
	const col = Math.min(cols - 1, Math.max(0, Math.floor(scaledX / (colSize + gap))));
	const row = Math.min(rows - 1, Math.max(0, Math.floor(scaledY / (rowSize + gap))));
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

function renderRowControls() {
	const existingControls = document.getElementById("rowControls");
	if (existingControls) {
		existingControls.remove();
	}
	
	const controlsContainer = document.createElement("div");
	controlsContainer.id = "rowControls";
	
	const title = document.createElement("h3");
	title.textContent = "Row Heights";
	controlsContainer.appendChild(title);
	
	for (let i = 0; i < rows; i++) {
		const rowControl = document.createElement("label");
		
		const label = document.createElement("span");
		label.textContent = `Row ${i + 1}:`;
		
		const select = document.createElement("select");
		select.dataset.rowIndex = i;
		
		const options = [
			{ value: "1fr", label: "Flexible (1fr)" },
			{ value: "max-content", label: "Content height" },
			{ value: "min-content", label: "Min content" },
			{ value: "auto", label: "Auto" }
		];
		
		options.forEach(option => {
			const optionEl = document.createElement("option");
			optionEl.value = option.value;
			optionEl.textContent = option.label;
			if (rowHeights[i] === option.value) {
				optionEl.selected = true;
			}
			select.appendChild(optionEl);
		});
		
		select.addEventListener("change", (e) => {
			const rowIndex = parseInt(e.target.dataset.rowIndex);
			rowHeights[rowIndex] = e.target.value;
			updateCssPreview(); // Only update CSS, not visual grid
		});
		
		rowControl.appendChild(label);
		rowControl.appendChild(select);
		controlsContainer.appendChild(rowControl);
	}
	
	// Insert after the responsive settings
	const controlsSection = document.getElementById("controls");
	controlsSection.appendChild(controlsContainer);
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
	const rowTemplate = rowHeights.join(" ");
	cssCode.textContent = `[id:${containerId}] {\n  display: grid;\n  grid-template-columns: repeat(${cols}, 1fr);\n  grid-template-rows: ${rowTemplate};\n  gap: 8px;\n  ${template}\n}`;
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

buildGridButton.addEventListener("click", () => {
	cols = Math.max(1, parseInt(colCountInput.value, 10) || 1);
	rows = Math.max(1, parseInt(rowCountInput.value, 10) || 1);
	
	// Initialize row heights if not already set or if rows changed
	if (rowHeights.length !== rows) {
		rowHeights = Array(rows).fill("1fr");
	}
	
	initMatrix();
	areas = {};
	renderGrid();
	renderElementList();
	renderRowControls();
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

let gridWidth = 1536;
let gridHeight = 864;

function calculateColumns() {
	const mainMaxWidth = parseInt(mainMaxWidthInput.value, 10) || 1536;
	const bannerWidthRatio = parseFloat(bannerWidthInput.value) || 1;
	const bannerWidth = Math.round(mainMaxWidth * bannerWidthRatio);
	const mainGridSize = 24;
	const calculatedCols = Math.max(1, Math.round((bannerWidth / mainMaxWidth) * mainGridSize));
	cols = calculatedCols;
	colCountInput.value = calculatedCols;

	// Calculate grid dimensions based on device and columns
	calculateGridDimensions();
	buildGridButton.click();
}

function updateDeviceSettings() {
	updateBannerWidthOptions();
	calculateColumns();
}

function updateBannerWidthOptions() {
	const device = parseInt(mainMaxWidthInput.value, 10);
	const options = bannerWidthInput.querySelectorAll("option");

	if (device === 768) {
		// Mobile - only full width
		bannerWidthInput.innerHTML = '<option value="1">Full Width</option>';
		bannerWidthInput.value = "1";
	} else {
		// Desktop and Tablet - all options
		bannerWidthInput.innerHTML = `
			<option value="1">Full Width</option>
			<option value="0.67">2/3 Width</option>
			<option value="0.5">1/2 Width</option>
			<option value="0.33">1/3 Width</option>
		`;
	}
}

function calculateGridDimensions() {
	const device = parseInt(mainMaxWidthInput.value, 10);

	if (device === 1536) {
		// Desktop
		const cellWidth = 64;
		gridWidth = cols * cellWidth;
		if (cols === 8) {
			gridHeight = 600; // 5/6 aspect ratio
		} else if (cols === 12) {
			gridHeight = 600;
		} else if (cols === 24) {
			gridHeight = 864; // 16/9 aspect ratio
		}
	} else if (device === 1024) {
		// Tablet
		const cellWidth = 44;
		gridWidth = cols * cellWidth;
		if (cols === 8 || cols === 12) {
			gridHeight = 400;
		} else if (cols === 24) {
			gridHeight = 570;
		}
	} else if (device === 768) {
		// Mobile
		const cellWidth = 32;
		gridWidth = cols * cellWidth;
		gridHeight = 600;
	}

	bannerHeightInput.value = gridHeight;
}

function updateGridSize() {
	gridHeight = parseInt(bannerHeightInput.value, 10) || gridHeight;
	updateGridScaling();
	renderGrid();
	updateCssPreview();
}

function updateGridScaling() {
	const viewportWidth = window.innerWidth - 40; // Account for padding
	const viewportHeight = window.innerHeight * 0.8; // 80% of viewport height
	const gridWrapper = document.getElementById("gridWrapper");
	const totalGridWidth = gridWidth + 20; // Include padding
	const totalGridHeight = gridHeight + 20; // Include padding
	
	// Calculate scale factors for both width and height
	const widthScale = totalGridWidth > viewportWidth ? viewportWidth / totalGridWidth : 1;
	const heightScale = totalGridHeight > viewportHeight ? viewportHeight / totalGridHeight : 1;
	
	// Use the smaller scale to ensure it fits both dimensions
	const scale = Math.min(widthScale, heightScale);
	
	if (scale < 1) {
		const scaledWidth = totalGridWidth * scale;
		const scaledHeight = totalGridHeight * scale;
		const marginLeft = (viewportWidth - scaledWidth) / 2;
		const marginTop = (viewportHeight - scaledHeight) / 2;
		
		gridWrapper.style.setProperty('--grid-scale', scale);
		gridWrapper.style.setProperty('--grid-margin', `${marginLeft}px`);
		gridWrapper.style.setProperty('--grid-margin-top', `${marginTop}px`);
	} else {
		gridWrapper.style.setProperty('--grid-scale', '1');
		gridWrapper.style.setProperty('--grid-margin', '0px');
		gridWrapper.style.setProperty('--grid-margin-top', '0px');
	}
}

window.addEventListener("pointerup", handlePointerUp);

document.addEventListener("DOMContentLoaded", () => {
	mainMaxWidthInput.addEventListener("change", updateDeviceSettings);
	bannerWidthInput.addEventListener("change", calculateColumns);
	bannerHeightInput.addEventListener("input", updateGridSize);
	colCountInput.addEventListener("change", () => buildGridButton.click());
	rowCountInput.addEventListener("change", () => {
		const newRows = Math.max(1, parseInt(rowCountInput.value, 10) || 1);
		if (newRows !== rows) {
			rows = newRows;
			// Resize rowHeights array, preserving existing values
			const oldRowHeights = [...rowHeights];
			rowHeights = Array(rows).fill("1fr");
			for (let i = 0; i < Math.min(oldRowHeights.length, rows); i++) {
				rowHeights[i] = oldRowHeights[i];
			}
		}
		buildGridButton.click();
	});
	
	window.addEventListener("resize", updateGridScaling);

	// Initialize the grid directly instead of using click()
	calculateColumns();
	cols = Math.max(1, parseInt(colCountInput.value, 10) || 24);
	rows = Math.max(1, parseInt(rowCountInput.value, 10) || 4);
	
	// Initialize row heights
	rowHeights = Array(rows).fill("1fr");
	
	initMatrix();
	areas = {};
	renderGrid();
	renderElementList();
	renderRowControls();
	updateCssPreview();
});
