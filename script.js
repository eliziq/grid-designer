const grid = document.getElementById("grid");
const colCountInput = document.getElementById("colCount");
const rowCountInput = document.getElementById("rowCount");
const buildGridButton = document.getElementById("buildGrid");
const clearGridButton = document.getElementById("clearGrid");
const exportCssButton = document.getElementById("exportCss");
const savePatternButton = document.getElementById("savePattern");
const deletePatternButton = document.getElementById("deletePattern");
const cssCode = document.getElementById("cssCode");
const elementNameInput = document.getElementById("elementName");
const elementList = document.getElementById("elementList");

let rows = 4;
let cols = 24;
let gridMatrix = [];
let elements = []; // [{id, name}]
let areas = {}; // {id: {id,rowStart,rowEnd,colStart,colEnd}}
let areaColors = {}; // id->hsl color
let rowHeights = []; // Array of height values for each row, default "1fr"
let resizeState = null;
let savedPatterns = {}; // Store saved patterns by key: "cardId-resolutionIndex"
let currentResolution = null;
let currentResolutionIndex = 0;
let resolutionStates = [];

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

let editorCardId = null;
let editorReady = false;
let allowedTags = [];

function normalizeResolution(res) {
	const width = Number(res?.width) || 0;
	const height = Number(res?.height) || 0;
	return {
		width,
		height,
		label: res?.label || res?.name || `${width}x${height}`,
	};
}

function normalizeResolutions(resolutions) {
	if (!Array.isArray(resolutions) || resolutions.length === 0) {
		return window.resolutions || [];
	}
	return resolutions
		.map((res) => normalizeResolution(res))
		.filter((res) => res.width > 0 && res.height > 0);
}

function normalizeTag(tag, index) {
	if (tag && typeof tag === "object") {
		const name = String(tag.name || tag.label || tag.id || `Tag ${index + 1}`);
		return {
			id: sanitizeId(tag.id || name) || `tag_${index + 1}`,
			name,
		};
	}
	return null;
}

function normalizeTags(tags) {
	if (!Array.isArray(tags)) return [];
	return tags.map((tag, index) => normalizeTag(tag, index)).filter(Boolean);
}

function populateMatrixFromAreas() {
	initMatrix();
	Object.values(areas).forEach((area) => {
		for (let r = area.rowStart; r <= area.rowEnd; r++) {
			for (let c = area.colStart; c <= area.colEnd; c++) {
				if (r >= 0 && r < rows && c >= 0 && c < cols) {
					gridMatrix[r][c] = area.id;
				}
			}
		}
	});
}

function getStateFromEditor() {
	saveResolutionState(currentResolutionIndex);
	return {
		id: editorCardId,
		containerId: editorCardId || "",
		resolutions: window.resolutions.map((res) => ({
			width: res.width,
			height: res.height,
			label: res.label,
		})),
		currentResolutionIndex,
		elements: JSON.parse(JSON.stringify(elements)),
		resolutionStates: window.resolutions.map((_, index) => {
			const state = getResolutionState(index);
			if (state) {
				return {
					rows: state.rows,
					cols: state.cols,
					rowHeights: [...state.rowHeights],
					areas: JSON.parse(JSON.stringify(state.areas)),
					gridMatrix: state.gridMatrix.map((row) => [...row]),
				};
			}
			const tempResolution = window.resolutions[index];
			const defaultCols =
				tempResolution.width > 1500 ? 24 : tempResolution.width > 1000 ? 16 : 12;
			return {
				rows: 4,
				cols: defaultCols,
				rowHeights: Array(4).fill("1fr"),
				areas: {},
				gridMatrix: Array.from({ length: 4 }, () => Array(defaultCols).fill(null)),
			};
		}),
	};
}

// Pattern management functions
function getCurrentPatternKey() {
	const cardId = editorCardId != null ? editorCardId : "default";
	const resolutionIndex = Number.isInteger(currentResolutionIndex) ? currentResolutionIndex : 0;
	return `${cardId}-${resolutionIndex}`;
}

function setResolutionState(index, state) {
	resolutionStates[index] = {
		rows: Math.max(1, state.rows || 1),
		cols: Math.max(1, state.cols || 1),
		rowHeights: Array.isArray(state.rowHeights)
			? state.rowHeights.map((row) => row || "1fr")
			: Array(Math.max(1, state.rows || 1)).fill("1fr"),
		areas: state.areas ? JSON.parse(JSON.stringify(state.areas)) : {},
		gridMatrix: Array.isArray(state.gridMatrix)
			? state.gridMatrix.map((row) => [...row])
			: Array.from({ length: Math.max(1, state.rows || 1) }, () =>
					Array(Math.max(1, state.cols || 1)).fill(null),
				),
	};
}

function getResolutionState(index) {
	return resolutionStates[index] || null;
}

function defaultResolutionState(res) {
	const cols = res.width > 1500 ? 24 : res.width > 1000 ? 16 : 12;
	return {
		rows: 4,
		cols,
		rowHeights: Array(4).fill("1fr"),
		areas: {},
		gridMatrix: Array.from({ length: 4 }, () => Array(cols).fill(null)),
	};
}

function applyResolutionState(state) {
	rows = Math.max(1, state.rows || 1);
	cols = Math.max(1, state.cols || 1);
	rowHeights = Array.isArray(state.rowHeights)
		? state.rowHeights.map((row) => row || "1fr")
		: Array(rows).fill("1fr");
	areas = state.areas ? JSON.parse(JSON.stringify(state.areas)) : {};
	gridMatrix = Array.isArray(state.gridMatrix)
		? state.gridMatrix.map((row) => [...row])
		: Array.from({ length: rows }, () => Array(cols).fill(null));
	colCountInput.value = cols;
	rowCountInput.value = rows;
}

function saveResolutionState(index) {
	if (!Number.isInteger(index) || index < 0) return;
	setResolutionState(index, {
		rows,
		cols,
		rowHeights,
		areas,
		gridMatrix,
	});
}

function savePattern() {
	saveResolutionState(currentResolutionIndex);
	const key = getCurrentPatternKey();
	const pattern = {
		rows,
		cols,
		gridMatrix: gridMatrix.map((row) => [...row]),
		elements: [...elements],
		areas: JSON.parse(JSON.stringify(areas)),
		rowHeights: [...rowHeights],
	};
	savedPatterns[key] = pattern;
	localStorage.setItem("gridDesignerPatterns", JSON.stringify(savedPatterns));
	updatePatternButtons();
	updateCssPreview();
}

function loadPattern(key) {
	const pattern = savedPatterns[key];
	if (!pattern) return false;

	rows = pattern.rows;
	cols = pattern.cols;
	gridMatrix = pattern.gridMatrix.map((row) => [...row]);
	elements = [...pattern.elements];
	areas = JSON.parse(JSON.stringify(pattern.areas));
	rowHeights = [...pattern.rowHeights];
	colCountInput.value = cols;
	rowCountInput.value = rows;
	calculateGridDimensions();

	// Rebuild area colors for loaded elements
	elements.forEach((element) => {
		if (!areaColors[element.id]) {
			areaColors[element.id] = generateAreaColor(element.id);
		}
	});

	renderGrid();
	renderElementList();
	renderRowControls();
	updateCssPreview();
	return true;
}

function deletePattern() {
	const key = getCurrentPatternKey();
	delete savedPatterns[key];
	localStorage.setItem("gridDesignerPatterns", JSON.stringify(savedPatterns));
	updatePatternButtons();
	updateCssPreview();
}

function updatePatternButtons() {
	const key = getCurrentPatternKey();
	const hasPattern = savedPatterns[key];
	deletePatternButton.style.display = hasPattern ? "inline-block" : "none";
}

function loadSavedPatterns() {
	const stored = localStorage.getItem("gridDesignerPatterns");
	if (stored) {
		savedPatterns = JSON.parse(stored);
	}
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
	const scale = parseFloat(getComputedStyle(gridWrapper).getPropertyValue("--grid-scale") || "1");

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
			{ value: "auto", label: "Auto" },
		];

		options.forEach((option) => {
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

	const controlsSection = document.getElementById("controls");
	controlsSection.appendChild(controlsContainer);
}

function getCssMediaQuery(width) {
	if (width === 768) {
		return "@media (max-width: 768px)";
	}
	if (width === 1024) {
		return "@media (min-width: 769px) and (max-width: 1024px)";
	}
	if (width === 1536) {
		return "@media (min-width: 1536px)";
	}
	return `@media (min-width: ${width}px)`;
}

function generateCss() {
	const cid = editorCardId || "grid";
	const allResolutionsCss = window.resolutions.map((res, index) => {
		const state = getResolutionState(index) || defaultResolutionState(res);
		const rowTemplate = state.rowHeights.join(" ");
		const lines = [];
		for (let r = 0; r < state.rows; r++) {
			const rowCells = [];
			for (let c = 0; c < state.cols; c++) {
				rowCells.push(state.gridMatrix[r][c] || ".");
			}
			lines.push(`            "${rowCells.join(" ")}"`);
		}
		const template = `grid-template-areas:\n${lines.join("\n")};`;
		return (
			`    @container box (min-width: ${res.width}px){\n` +
			`        [id:${cid}] {\n` +
			`            display: grid;\n` +
			`            grid-template-columns: repeat(${state.cols}, 1fr);\n` +
			`            grid-template-rows: ${rowTemplate};\n` +
			`            gap: 8px;\n` +
			`            ${template}\n` +
			`        }\n` +
			`    }\n`
		);
	});
	return allResolutionsCss.join("\n\n");
}

function updateCssPreview() {
	cssCode.textContent = generateCss();
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

		elementList.appendChild(tag);
	});
}

let gridWidth = 1536;
let gridHeight = 864;

function calculateColumns() {
	const mainMaxWidth = currentResolution.width;
	let calculatedCols;
	if (mainMaxWidth > 1500) {
		calculatedCols = 24;
	} else if (mainMaxWidth > 1000) {
		calculatedCols = 16;
	} else {
		calculatedCols = 12;
	}
	cols = calculatedCols;
	colCountInput.value = calculatedCols;

	calculateGridDimensions();
}

function updateDeviceSettings() {
	calculateColumns();

	// Check if there's a saved pattern for these settings
	const key = getCurrentPatternKey();
	if (savedPatterns[key]) {
		loadPattern(key);
	}
	updatePatternButtons();
}

function calculateGridDimensions() {
	gridWidth = currentResolution.width;
	gridHeight = currentResolution.height;
}

function updateGridScaling() {
	const viewportWidth = window.innerWidth - 40;
	const viewportHeight = window.innerHeight * 0.8;
	const gridWrapper = document.getElementById("gridWrapper");
	const totalGridWidth = gridWidth + 20;
	const totalGridHeight = gridHeight + 20;

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

		gridWrapper.style.setProperty("--grid-scale", scale);
		gridWrapper.style.setProperty("--grid-margin", `${marginLeft}px`);
		gridWrapper.style.setProperty("--grid-margin-top", `${marginTop}px`);
	} else {
		gridWrapper.style.setProperty("--grid-scale", "1");
		gridWrapper.style.setProperty("--grid-margin", "0px");
		gridWrapper.style.setProperty("--grid-margin-top", "0px");
	}
}

function setCurrentResolution(res) {
	if (!res) return;
	const previousIndex = currentResolutionIndex;
	if (Number.isInteger(previousIndex) && previousIndex >= 0) {
		saveResolutionState(previousIndex);
	}

	currentResolution = res;
	currentResolutionIndex = window.resolutions.indexOf(res);

	const radios = document.querySelectorAll("#resolutionTabs input[type='radio']");
	const labels = document.querySelectorAll("#resolutionTabs label");
	const index = currentResolutionIndex;
	if (index >= 0) {
		radios[index].checked = true;
	}
	labels.forEach((label, labelIndex) => {
		label.classList.toggle("active", labelIndex === index);
	});

	const resolvedState = getResolutionState(index);
	const patternKey = getCurrentPatternKey();
	if (resolvedState) {
		applyResolutionState(resolvedState);
		calculateGridDimensions();
	} else if (savedPatterns[patternKey]) {
		loadPattern(patternKey);
		setResolutionState(index, {
			rows,
			cols,
			rowHeights,
			areas,
			gridMatrix,
		});
		updatePatternButtons();
		return;
	} else {
		const defaultState = defaultResolutionState(currentResolution);
		applyResolutionState(defaultState);
		calculateGridDimensions();
		areas = {};
		initMatrix();
	}

	renderGrid();
	renderElementList();
	renderRowControls();
	updateCssPreview();
	updatePatternButtons();
}

function loadEditorState(state) {
	if (!state || typeof state !== "object") return;

	if (Array.isArray(state.elements) && state.elements.length > 0) {
		elements = state.elements.map((element, index) => normalizeTag(element, index));
	}

	currentResolutionIndex =
		Number.isInteger(state.currentResolutionIndex) && state.currentResolutionIndex >= 0
			? state.currentResolutionIndex
			: 0;

	if (Array.isArray(state.resolutionStates) && state.resolutionStates.length > 0) {
		resolutionStates = state.resolutionStates.map((rs, index) => ({
			rows: Math.max(1, rs.rows || 1),
			cols: Math.max(1, rs.cols || 1),
			rowHeights: Array.isArray(rs.rowHeights)
				? rs.rowHeights.map((row) => row || "1fr")
				: Array(Math.max(1, rs.rows || 1)).fill("1fr"),
			areas: rs.areas ? JSON.parse(JSON.stringify(rs.areas)) : {},
			gridMatrix: Array.isArray(rs.gridMatrix)
				? rs.gridMatrix.map((row) => [...row])
				: Array.from({ length: Math.max(1, rs.rows || 1) }, () =>
						Array(Math.max(1, rs.cols || 1)).fill(null),
					),
		}));
	} else {
		const rootState = {
			rows: typeof state.rows === "number" ? Math.max(1, state.rows) : 4,
			cols: typeof state.cols === "number" ? Math.max(1, state.cols) : 24,
			rowHeights: Array.isArray(state.rowHeights)
				? state.rowHeights.map((height) => height || "1fr")
				: Array(Math.max(1, state.rows || 4)).fill("1fr"),
			areas:
				state.areas && typeof state.areas === "object"
					? JSON.parse(JSON.stringify(state.areas))
					: {},
			gridMatrix: Array.isArray(state.gridMatrix)
				? state.gridMatrix.map((row) => [...row])
				: Array.from({ length: Math.max(1, state.rows || 4) }, () =>
						Array(Math.max(1, state.cols || 24)).fill(null),
					),
		};
		resolutionStates[currentResolutionIndex] = rootState;
	}
}

function attachEditorListeners() {
	if (editorReady) return;
	buildGridButton.addEventListener("click", () => {
		cols = Math.max(1, parseInt(colCountInput.value, 10) || 1);
		rows = Math.max(1, parseInt(rowCountInput.value, 10) || 1);

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

	savePatternButton.addEventListener("click", savePattern);
	deletePatternButton.addEventListener("click", deletePattern);

	window.addEventListener("resize", updateGridScaling);
	window.addEventListener("pointerup", handlePointerUp);
	editorReady = true;
}

function createResolutionTabs() {
	const tabsContainer = document.getElementById("resolutionTabs");
	tabsContainer.innerHTML = "";

	window.resolutions.forEach((res, index) => {
		const label = document.createElement("label");
		const radio = document.createElement("input");
		radio.type = "radio";
		radio.name = "resolution";
		radio.value = index;
		radio.addEventListener("change", () => {
			document
				.querySelectorAll("#resolutionTabs label")
				.forEach((l) => l.classList.remove("active"));
			label.classList.add("active");
			setCurrentResolution(res);
		});
		label.appendChild(radio);
		label.appendChild(document.createTextNode(` ${res.width}x${res.height}`));
		tabsContainer.appendChild(label);
	});
}

function Init(id, resolutions = [], tags = [], state = {}) {
	editorCardId = id;
	window.resolutions = normalizeResolutions(resolutions);
	allowedTags = normalizeTags(tags);
	if (allowedTags.length > 0) {
		elements = [...allowedTags];
	} else {
		elements = [];
	}

	loadEditorState(state);

	const hasStateGridMatrix = Array.isArray(state.gridMatrix) && state.gridMatrix.length > 0;
	if (hasStateGridMatrix) {
		gridMatrix = state.gridMatrix.map((row) => [...row]);
	} else if (Object.keys(areas).length > 0) {
		populateMatrixFromAreas();
	} else {
		initMatrix();
	}

	attachEditorListeners();
	createResolutionTabs();

	const defaultResolution =
		typeof state.currentResolutionIndex === "number" &&
		window.resolutions[state.currentResolutionIndex]
			? window.resolutions[state.currentResolutionIndex]
			: window.resolutions[0];

	if (defaultResolution) {
		setCurrentResolution(defaultResolution);
	} else if (window.resolutions.length > 0) {
		currentResolution = window.resolutions[0];
		calculateGridDimensions();
		const firstLabel = document.querySelector("#resolutionTabs label");
		if (firstLabel) {
			firstLabel.classList.add("active");
			const firstRadio = firstLabel.querySelector("input[type='radio']");
			if (firstRadio) {
				firstRadio.checked = true;
			}
		}
		renderGrid();
		renderElementList();
		renderRowControls();
		updateCssPreview();
	} else {
		currentResolution = { width: 1536, height: 864 };
		calculateGridDimensions();
		renderGrid();
		renderElementList();
		renderRowControls();
		updateCssPreview();
	}
}

function GetCss() {
	return generateCss();
}

function GetState() {
	return getStateFromEditor();
}

window.GridDesigner = {
	Init,
	GetCss,
	GetState,
};

//usage example - this would be called by the parent view that includes this script, passing in the desired resolutions to support
const resolutions = [
	{ width: 360, height: 800 },
	{ width: 600, height: 400 },
	{ width: 768, height: 1024 },
	{ width: 1024, height: 768 },
	{ width: 1536, height: 864 },
];

const templateId = 123;

const tags = [
	{ id: "title", name: "Title" },
	{ id: "desc", name: "Desc" },
	{ id: "button", name: "Button" },
];

const state = {};

//Temporary initialization for testing - in production, the parent view would call GridDesigner.Init with the appropriate parameters
document.addEventListener("DOMContentLoaded", () =>
	GridDesigner.Init(templateId, resolutions, tags, state),
);
