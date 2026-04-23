class GridDesigner {
	constructor(editorCardId, resolutions = {}, tags = [], state = {}) {
		if (!editorCardId) return;

		this.containerElement = document;
		this.editorCardId = editorCardId;
		this.rootSelector = `#${GridDesigner.sanitizeId(this.editorCardId)}`;

		this.state = {
			rows: 4,
			cols: 24,
			areas: {},
			rowHeights: Array(4).fill("1fr"),
			gridMatrix: [],
			resolutionStates: [],
			elements: [],
			currentResolutionIndex: 0,
		};
		this.resolutions = resolutions;
		this.state.currentPageWidth = Object.keys(resolutions)[0];
		this.currentResolution = null;
		this.sortedscreenWidths = [];
		this.gridWidth = 1536;
		this.gridHeight = 864;
		this.savedPatterns = {};
		this.areaColors = {};
		this.resizeState = null;
		this.editorReady = false;
		this.allowedTags = [];

		this.cacheDomElements();
		this.init(editorCardId, resolutions, tags, state);
	}

	cacheDomElements() {
		this.grid = this.q("grid");
		this.colCountInput = this.q("colCount");
		this.rowCountInput = this.q("rowCount");
		this.buildGridButton = this.q("buildGrid");
		this.clearGridButton = this.q("clearGrid");
		this.exportCssButton = this.q("exportCss");
		this.exportJsonButton = this.q("exportJson");
		this.savePatternButton = this.q("savePattern");
		this.deletePatternButton = this.q("deletePattern");
		this.loadDesignButton = this.q("loadDesign");
		this.importStateInput = this.q("importState");
		this.cssCode = this.q("cssCode");
		this.elementList = this.q("elementList");
		this.gridWrapper = this.q("gridWrapper");
		this.resolutionTabs = this.q("resolutionTabs");
		this.rowControls = this.q("controlsContainer");
		this.mainMaxWidthSelect = this.q("mainMaxWidth");
	}

	q(id) {
		return this.containerElement.querySelector(`#${id}`);
	}

	static sanitizeId(raw) {
		return String(raw || "")
			.trim()
			.toLowerCase()
			.replace(/\s+/g, "_")
			.replace(/[^a-z0-9_\-]/g, "");
	}

	static normalizeResolution(res) {
		const width = Number(res?.width) || 0;
		const height = Number(res?.height) || 0;
		return {
			width,
			height,
			label: res?.label || res?.name || `${width}x${height}`,
		};
	}

	static normalizeResolutions(resolutions) {
		if (!resolutions || typeof resolutions !== "object") {
			console.warn("Invalid resolutions format. Expected an object.");
			return {};
		}

		const normalized = {};

		Object.keys(resolutions).forEach((pageWidth) => {
			const bannerSizes = resolutions[pageWidth];

			if (Array.isArray(bannerSizes)) {
				const validBanners = bannerSizes
					.map((res) => this.normalizeResolution(res))
					.filter((res) => res.width > 0 && res.height > 0)
					.sort((a, b) => b.width - a.width || b.height - a.height);

				if (validBanners.length > 0) {
					normalized[pageWidth] = validBanners;
				}
			}
		});

		return normalized;
	}

	static normalizeTag(tag, index) {
		if (tag && typeof tag === "object") {
			const name = String(tag.name || tag.label || tag.id || `Tag ${index + 1}`);
			return {
				id: GridDesigner.sanitizeId(tag.id || name) || `tag_${index + 1}`,
				name,
			};
		}
		return null;
	}

	static normalizeTags(tags) {
		if (!Array.isArray(tags)) return [];
		return tags.map((tag, index) => GridDesigner.normalizeTag(tag, index)).filter(Boolean);
	}

	init(editorCardId, resolutions = {}, tags = [], state = {}) {
		this.editorCardId = String(editorCardId != null ? editorCardId : this.editorCardId);
		this.resolutions = GridDesigner.normalizeResolutions(resolutions);
		this.allowedTags = GridDesigner.normalizeTags(tags);
		if (this.allowedTags.length) {
			this.state.elements = [...this.allowedTags];
		}

		this.loadEditorState(state);
		this.populatePageWidthSelect();
		this.initializeMatrixFromState();
		this.createResolutionTabs();
		this.attachEditorListeners();

		const pageWidth = this.state.currentPageWidth || Object.keys(this.resolutions)[0];

		const defaultResolution =
			this.resolutions[pageWidth]?.[this.state.currentResolutionIndex] ||
			this.resolutions[pageWidth]?.[0];

		if (defaultResolution) {
			this.setCurrentResolution(defaultResolution);
		} else {
			this.currentResolution = { width: 1536, height: 864 };
			this.calculateGridDimensions();
			this.activateFirstResolutionTab();
			this.renderGrid();
			this.renderElementList();
			this.renderRowControls();
			this.updateCssPreview();
		}
	}

	populatePageWidthSelect() {
		if (!this.mainMaxWidthSelect) return;
		this.mainMaxWidthSelect.innerHTML = "";

		Object.keys(this.resolutions).forEach((width) => {
			const option = document.createElement("option");
			option.value = width;
			option.textContent = ` ${width}px`;
			if (width === this.state.currentPageWidth) option.selected = true;
			this.mainMaxWidthSelect.appendChild(option);
		});

		this.mainMaxWidthSelect.onchange = (e) => {
			this.saveResolutionState(this.state.currentResolutionIndex);

			this.state.currentPageWidth = e.target.value;
			this.state.currentResolutionIndex = 0;

			this.createResolutionTabs();

			const group = this.resolutions[this.state.currentPageWidth];
			if (group && group[0]) {
				this.setCurrentResolution(group[0], true);
			}
		};
	}

	initializeMatrixFromState() {
		const current = this.getResolutionState(this.state.currentResolutionIndex);
		if (current) {
			this.applyResolutionState(current);
		} else {
			this.applyResolutionState(
				this.createDefaultResolutionState(
					this.resolutions[this.state.currentPageWidth]?.[0] || {
						width: 1536,
						height: 864,
					},
				),
			);
		}
	}

	attachEditorListeners() {
		if (this.editorReady) return;
		if (this.buildGridButton)
			this.buildGridButton.addEventListener("click", this.handleBuildGrid.bind(this));
		if (this.clearGridButton)
			this.clearGridButton.addEventListener("click", this.handleClearGrid.bind(this));
		if (this.exportCssButton)
			this.exportCssButton.addEventListener("click", this.handleExportCss.bind(this));
		if (this.exportJsonButton)
			this.exportJsonButton.addEventListener("click", this.handleExportJson.bind(this));
		if (this.savePatternButton)
			this.savePatternButton.addEventListener("click", this.handleSavePattern.bind(this));
		if (this.deletePatternButton)
			this.deletePatternButton.addEventListener("click", this.handleDeletePattern.bind(this));
		if (this.loadDesignButton)
			this.loadDesignButton.addEventListener("click", () => this.importStateInput?.click());
		if (this.importStateInput)
			this.importStateInput.addEventListener("change", this.handleImportJson.bind(this));
		window.addEventListener("resize", this.handleResize.bind(this));
		window.addEventListener("pointerup", this.handlePointerUp.bind(this));
		this.editorReady = true;
	}

	handleBuildGrid() {
		this.state.cols = Math.max(1, parseInt(this.colCountInput?.value, 10) || 1);
		this.state.rows = Math.max(1, parseInt(this.rowCountInput?.value, 10) || 1);
		if (this.state.rowHeights.length !== this.state.rows) {
			this.state.rowHeights = Array(this.state.rows).fill("1fr");
		}
		this.initMatrix();
		this.state.areas = {};
		this.renderGrid();
		this.renderElementList();
		this.renderRowControls();
		this.updateCssPreview();
	}

	handleClearGrid() {
		this.initMatrix();
		this.state.areas = {};
		this.renderGrid();
		this.renderElementList();
		this.updateCssPreview();
	}

	handleExportCss() {
		this.updateCssPreview();
		if (!this.cssCode) return;
		const blob = new Blob([this.cssCode.textContent], { type: "text/css" });
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = "grid-designer.css";
		document.body.appendChild(link);
		link.click();
		link.remove();
	}

	handleExportJson() {
		const state = this.getState();
		const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = "grid-designer-state.json";
		document.body.appendChild(link);
		link.click();
		link.remove();
	}

	handleSavePattern() {
		this.saveResolutionState(this.state.currentResolutionIndex);
		const key = this.getCurrentPatternKey();
		const pattern = {
			rows: this.state.rows,
			cols: this.state.cols,
			gridMatrix: this.state.gridMatrix.map((row) => [...row]),
			elements: [...this.state.elements],
			areas: JSON.parse(JSON.stringify(this.state.areas)),
			rowHeights: [...this.state.rowHeights],
		};
		this.savedPatterns[key] = pattern;
		this.savePatternsToStorage();
		this.updatePatternButtons();
		this.updateCssPreview();
	}

	handleDeletePattern() {
		const key = this.getCurrentPatternKey();
		delete this.savedPatterns[key];
		this.savePatternsToStorage();
		this.updatePatternButtons();
		this.updateCssPreview();
	}

	handleImportJson(event) {
		const file = event.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const state = JSON.parse(e.target?.result || "{}");
				this.loadEditorState(state);
				this.populatePageWidthSelect();
				this.createResolutionTabs();
				const pageWidth = this.state.currentPageWidth;
				const currentIndex = this.state.currentResolutionIndex || 0;
				const resolution = this.resolutions[pageWidth]?.[currentIndex];
				if (resolution) {
					const activeState = this.getResolutionState(currentIndex);
					if (activeState) {
						this.applyResolutionState(activeState);
					}
					this.setCurrentResolution(resolution);
				} else {
					this.renderGrid();
					this.renderElementList();
					this.renderRowControls();
					this.updateCssPreview();
				}
			} catch (error) {
				alert("Error loading design file: " + error.message);
			}
		};
		reader.readAsText(file);
		if (this.importStateInput) {
			this.importStateInput.value = "";
		}
	}

	handleResize() {
		this.updateGridScaling();
	}

	handlePointerUp() {
		if (!this.resizeState) return;
		this.resizeState.dragging = false;
		this.resizeState = null;

		if (this.handlePointerMoveBound) {
			window.removeEventListener("pointermove", this.handlePointerMoveBound);
			this.handlePointerMoveBound = null;
		}

		document.body.style.cursor = "default";
		Array.from(this.containerElement.querySelectorAll(".area-block")).forEach((block) => {
			block.classList.remove("edge-top", "edge-bottom", "edge-left", "edge-right");
		});
		this.updateCssPreview();
	}

	handlePointerMove(event) {
		if (!this.resizeState || !this.resizeState.dragging) return;

		const { row, col } = this.cellToGridPos(event.clientX, event.clientY);
		const { id, edge, startArea } = this.resizeState;

		let { rowStart, rowEnd, colStart, colEnd } = startArea;

		if (edge.top) rowStart = Math.min(row, rowEnd);
		if (edge.bottom) rowEnd = Math.max(row, rowStart);
		if (edge.left) colStart = Math.min(col, colEnd);
		if (edge.right) colEnd = Math.max(col, colStart);

		if (this.hasConflict(rowStart, colStart, rowEnd, colEnd, id)) {
			return;
		}

		this.state.areas[id] = { id, rowStart, rowEnd, colStart, colEnd };
		this.initMatrix();
		Object.values(this.state.areas).forEach((area) => {
			for (let rr = area.rowStart; rr <= area.rowEnd; rr++) {
				for (let cc = area.colStart; cc <= area.colEnd; cc++) {
					this.state.gridMatrix[rr][cc] = area.id;
				}
			}
		});
		this.renderGrid();
		this.updateCssPreview();
	}

	handleDrop(event) {
		event.preventDefault();
		const elementId = event.dataTransfer.getData("text/plain");
		if (!elementId) return;
		let r, c;
		if (event.currentTarget.classList.contains("cell")) {
			const cell = event.currentTarget;
			r = Number(cell.dataset.row);
			c = Number(cell.dataset.col);
		} else {
			const pos = this.cellToGridPos(event.clientX, event.clientY);
			r = pos.row;
			c = pos.col;
		}
		if (!this.assignArea(elementId, r, c, r, c)) {
			alert("Cannot place here; overlap existing area.");
			return;
		}
		this.renderGrid();
		this.renderElementList();
		this.updateCssPreview();
	}

	createResolutionTabs() {
		if (!this.resolutionTabs) return;
		this.resolutionTabs.innerHTML = "";

		const activeGroup = this.resolutions[this.state.currentPageWidth] || [];

		activeGroup.forEach((res, index) => {
			const label = document.createElement("label");
			const radio = document.createElement("input");
			const isActive = index === this.state.currentResolutionIndex;
			const resolutionState = this.getResolutionState(index);
			const isFinished = Boolean(resolutionState?.finished);
			label.classList.toggle("active", isActive);
			label.classList.toggle("finished", isFinished);

			radio.type = "radio";
			radio.name = "resolution";
			radio.value = index;
			radio.checked = isActive;

			radio.addEventListener("change", () => {
				this.containerElement
					.querySelectorAll("#resolutionTabs label")
					.forEach((l) => l.classList.remove("active"));
				label.classList.add("active");
				this.setCurrentResolution(res);
			});

			label.appendChild(radio);
			label.appendChild(document.createTextNode(` ${res.width}x${res.height}`));

			this.resolutionTabs.appendChild(label);
		});

		this.updateResolutionTabState();
	}

	activateFirstResolutionTab() {
		if (!this.resolutionTabs) return;
		const firstLabel = this.resolutionTabs.querySelector("label");
		if (firstLabel) {
			firstLabel.classList.add("active");
			const firstRadio = firstLabel.querySelector("input[type='radio']");
			if (firstRadio) firstRadio.checked = true;
		}
	}

	setCurrentResolution(res, isInitialLoad = false) {
		if (!res) return;
		if (!isInitialLoad) {
			this.saveResolutionState(this.state.currentResolutionIndex);
		}
		this.currentResolution = res;
		this.state.currentResolutionIndex =
			this.resolutions[this.state.currentPageWidth].indexOf(res);
		const radios = this.containerElement.querySelectorAll(
			"#resolutionTabs input[type='radio']",
		);
		const labels = this.containerElement.querySelectorAll("#resolutionTabs label");
		const index = this.state.currentResolutionIndex;
		if (index >= 0 && radios[index]) radios[index].checked = true;
		labels.forEach((label, labelIndex) => {
			label.classList.toggle("active", labelIndex === index);
		});
		const resolvedState = this.getResolutionState(index);
		const patternKey = this.getCurrentPatternKey();
		if (resolvedState) {
			this.applyResolutionState(resolvedState);
			this.calculateGridDimensions();
		} else if (this.savedPatterns[patternKey]) {
			this.loadPattern(patternKey);
			this.saveResolutionState(index);
			this.updatePatternButtons();
			return;
		} else {
			this.applyResolutionState(this.createDefaultResolutionState(this.currentResolution));
			this.calculateGridDimensions();
			this.state.areas = {};
			this.initMatrix();
		}
		this.renderGrid();
		this.renderElementList();
		this.renderRowControls();
		this.updateCssPreview();
		this.updateResolutionTabState();
		this.updatePatternButtons();
	}

	loadEditorState(state) {
		if (!state || typeof state !== "object") return;

		if (Array.isArray(state.elements)) {
			this.state.elements = state.elements
				.map((el, i) => GridDesigner.normalizeTag(el, i))
				.filter(Boolean);
		}

		if (state.resolutionStructure) {
			this.resolutions = GridDesigner.normalizeResolutions(state.resolutionStructure);
		}

		const availableWidths = Object.keys(this.resolutions);
		this.sortedScreenWidths = availableWidths.sort((a, b) => Number(b) - Number(a));

		this.state.currentPageWidth =
			state.currentPageWidth && availableWidths.includes(String(state.currentPageWidth))
				? String(state.currentPageWidth)
				: availableWidths[0];

		const currentGroup = this.resolutions[this.state.currentPageWidth] || [];
		const maxIdx = Math.max(0, currentGroup.length - 1);
		this.state.currentResolutionIndex = Number.isInteger(state.currentResolutionIndex)
			? Math.min(Math.max(0, state.currentResolutionIndex), maxIdx)
			: 0;

		this.state.resolutionStates = {};

		availableWidths.forEach((pageWidth) => {
			const banners = this.resolutions[pageWidth];

			this.state.resolutionStates[pageWidth] = banners.map((res, index) => {
				const { resolutionStates, currentResolutionIndex } = state;

				const isCurrentlyActive =
					pageWidth === this.state.currentPageWidth && index === currentResolutionIndex;

				const incoming =
					resolutionStates?.[pageWidth]?.[index] || (isCurrentlyActive ? state : null);

				if (!incoming || (!incoming.rows && !incoming.areas)) {
					return this.createDefaultResolutionState(res);
				}

				const rows = Math.max(1, incoming.rows || 1);
				const cols = Math.max(1, incoming.cols || 1);

				return {
					rows,
					cols,
					rowHeights: Array.isArray(incoming.rowHeights)
						? [...incoming.rowHeights]
						: Array(rows).fill("1fr"),
					areas: incoming.areas ? JSON.parse(JSON.stringify(incoming.areas)) : {},
					gridMatrix: Array.isArray(incoming.gridMatrix)
						? incoming.gridMatrix.map((row) => [...row])
						: Array.from({ length: rows }, () => Array(cols).fill(null)),
				};
			});
		});

		this.syncStateWithTags();
	}

	createDefaultResolutionState(res) {
		const cols = res.width <= 768 ? 12 : res.width <= 1024 ? 16 : 24;
		return {
			rows: 4,
			cols,
			rowHeights: Array(4).fill("1fr"),
			areas: {},
			finished: false,
			gridMatrix: Array.from({ length: 4 }, () => Array(cols).fill(null)),
		};
	}

	getCurrentPatternKey() {
		return `${this.editorCardId}-${this.state.currentPageWidth}-${this.state.currentResolutionIndex}`;
	}

	setResolutionState(index, state) {
		const pageWidth = this.state.currentPageWidth;

		if (!this.state.resolutionStates[pageWidth]) {
			this.state.resolutionStates[pageWidth] = [];
		}

		const normalizedState = {
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

		normalizedState.finished = this.isResolutionStateFinished(normalizedState);
		this.state.resolutionStates[pageWidth][index] = normalizedState;
	}

	loadPattern(patternKey) {
		const pattern = this.savedPatterns[patternKey];
		if (!pattern) return;
		this.state.rows = Math.max(1, pattern.rows || this.state.rows);
		this.state.cols = Math.max(1, pattern.cols || this.state.cols);
		this.state.rowHeights = Array.isArray(pattern.rowHeights)
			? [...pattern.rowHeights]
			: Array(this.state.rows).fill("1fr");
		this.state.areas = pattern.areas ? JSON.parse(JSON.stringify(pattern.areas)) : {};
		this.state.gridMatrix = Array.isArray(pattern.gridMatrix)
			? pattern.gridMatrix.map((row) => [...row])
			: Array.from({ length: this.state.rows }, () => Array(this.state.cols).fill(null));
		if (this.colCountInput) this.colCountInput.value = this.state.cols;
		if (this.rowCountInput) this.rowCountInput.value = this.state.rows;
	}

	getResolutionState(index) {
		const group = this.state.resolutionStates[this.state.currentPageWidth];
		return group ? group[index] : null;
	}

	applyResolutionState(state) {
		this.state.rows = Math.max(1, state.rows || 1);
		this.state.cols = Math.max(1, state.cols || 1);
		this.state.rowHeights = Array.isArray(state.rowHeights)
			? state.rowHeights.map((row) => row || "1fr")
			: Array(this.state.rows).fill("1fr");
		this.state.areas = state.areas ? JSON.parse(JSON.stringify(state.areas)) : {};
		this.state.gridMatrix = Array.isArray(state.gridMatrix)
			? state.gridMatrix.map((row) => [...row])
			: Array.from({ length: this.state.rows }, () => Array(this.state.cols).fill(null));
		if (this.colCountInput) this.colCountInput.value = this.state.cols;
		if (this.rowCountInput) this.rowCountInput.value = this.state.rows;
	}

	saveResolutionState(index) {
		if (!Number.isInteger(index) || index < 0) return;
		this.setResolutionState(index, {
			rows: this.state.rows,
			cols: this.state.cols,
			rowHeights: this.state.rowHeights,
			areas: this.state.areas,
			gridMatrix: this.state.gridMatrix,
		});
	}

	savePatternsToStorage() {
		localStorage.setItem(
			`gridDesignerPatterns-${GridDesigner.sanitizeId(this.editorCardId)}`,
			JSON.stringify(this.savedPatterns),
		);
	}

	initMatrix() {
		this.state.gridMatrix = Array.from({ length: this.state.rows }, () =>
			Array(this.state.cols).fill(null),
		);
	}
	updatePatternButtons() {
		const patternKey = this.getCurrentPatternKey();
		const hasSavedPattern = Boolean(this.savedPatterns[patternKey]);
		if (this.deletePatternButton) {
			this.deletePatternButton.style.display = hasSavedPattern ? "" : "none";
		}
		if (this.savePatternButton) {
			this.savePatternButton.textContent = hasSavedPattern
				? "Update Pattern"
				: "Save Pattern";
		}
	}

	isResolutionStateFinished(state) {
		const requiredElementIds = (this.state.elements || []).map((element) => element.id);
		if (!requiredElementIds.length) return false;

		const areaIds = new Set(Object.keys(state?.areas || {}));
		return requiredElementIds.every((id) => areaIds.has(id));
	}

	refreshFinishedStates() {
		Object.keys(this.state.resolutionStates || {}).forEach((pageWidth) => {
			const states = this.state.resolutionStates[pageWidth] || [];
			states.forEach((state) => {
				if (!state) return;
				state.finished = this.isResolutionStateFinished(state);
			});
		});
	}

	syncStateWithTags() {
		const tagIds = new Set((this.state.elements || []).map((el) => el.id));
		if (!tagIds.size) return;

		const allPageWidths = Object.keys(this.state.resolutionStates || {});

		// Find any finished resolution state for efficient diffing
		let finishedState = null;
		outer: for (const pageWidth of allPageWidths) {
			for (const state of this.state.resolutionStates[pageWidth] || []) {
				if (state?.finished) {
					finishedState = state;
					break outer;
				}
			}
		}

		let removedIds;
		let markAllUnfinished = false;

		if (finishedState) {
			const finishedAreaIds = new Set(Object.keys(finishedState.areas || {}));

			// find new tags
			for (const tagId of tagIds) {
				if (!finishedAreaIds.has(tagId)) {
					markAllUnfinished = true;
					break;
				}
			}

			// find removed tags
			removedIds = new Set();
			for (const areaId of finishedAreaIds) {
				if (!tagIds.has(areaId)) {
					removedIds.add(areaId);
				}
			}
		} else {
			removedIds = new Set();
			for (const pageWidth of allPageWidths) {
				for (const state of this.state.resolutionStates[pageWidth] || []) {
					for (const areaId of Object.keys(state?.areas || {})) {
						if (!tagIds.has(areaId)) {
							removedIds.add(areaId);
						}
					}
				}
			}
		}

		// remove stale elements
		if (removedIds.size > 0) {
			for (const pageWidth of allPageWidths) {
				for (const state of this.state.resolutionStates[pageWidth] || []) {
					if (!state) continue;
					let modified = false;
					for (const id of removedIds) {
						if (id in (state.areas || {})) {
							delete state.areas[id];
							modified = true;
						}
					}
					if (modified && Array.isArray(state.gridMatrix)) {
						for (let r = 0; r < state.gridMatrix.length; r++) {
							const row = state.gridMatrix[r];
							for (let c = 0; c < row.length; c++) {
								if (removedIds.has(row[c])) {
									row[c] = null;
								}
							}
						}
					}
				}
			}
		}

		if (markAllUnfinished && removedIds.size === 0) {
			for (const pageWidth of allPageWidths) {
				for (const state of this.state.resolutionStates[pageWidth] || []) {
					if (state) state.finished = false;
				}
			}
		} else {
			this.refreshFinishedStates();
		}
	}

	updateResolutionTabState() {
		if (!this.resolutionTabs) return;
		const labels = this.resolutionTabs.querySelectorAll("label");
		labels.forEach((label, index) => {
			const resolutionState = this.getResolutionState(index);
			label.classList.toggle("finished", Boolean(resolutionState?.finished));
		});
	}

	hasConflict(r0, c0, r1, c1, id = null) {
		for (let r = r0; r <= r1; r++) {
			for (let c = c0; c <= c1; c++) {
				if (r < 0 || r >= this.state.rows || c < 0 || c >= this.state.cols) return true;
				const current = this.state.gridMatrix[r][c];
				if (current && current !== id) return true;
			}
		}
		return false;
	}

	removeArea(id) {
		const area = this.state.areas[id];
		if (!area) return;
		for (let r = area.rowStart; r <= area.rowEnd; r++) {
			for (let c = area.colStart; c <= area.colEnd; c++) {
				if (this.state.gridMatrix[r][c] === id) {
					this.state.gridMatrix[r][c] = null;
				}
			}
		}
		delete this.state.areas[id];
	}

	assignArea(id, r0, c0, r1, c1) {
		const rowStart = Math.min(r0, r1);
		const rowEnd = Math.max(r0, r1);
		const colStart = Math.min(c0, c1);
		const colEnd = Math.max(c0, c1);
		if (this.hasConflict(rowStart, colStart, rowEnd, colEnd, id)) return false;
		this.removeArea(id);
		this.state.areas[id] = { id, rowStart, rowEnd, colStart, colEnd };
		for (let r = rowStart; r <= rowEnd; r++) {
			for (let c = colStart; c <= colEnd; c++) {
				this.state.gridMatrix[r][c] = id;
			}
		}
		return true;
	}

	getGridMetrics() {
		const gap = 8;
		const { cols, rows } = this.state;
		return {
			gap,
			colWidth: (this.gridWidth - gap * (cols - 1)) / cols,
			rowHeight: (this.gridHeight - gap * (rows - 1)) / rows,
		};
	}
	renderGrid() {
		if (!this.grid) return;
		this.grid.innerHTML = "";
		this.grid.style.gridTemplateColumns = `repeat(${this.state.cols}, 1fr)`;
		this.grid.style.gridTemplateRows = `repeat(${this.state.rows}, minmax(60px, 1fr))`;
		this.grid.style.width = `${this.gridWidth}px`;
		this.grid.style.height = `${this.gridHeight}px`;
		this.grid.style.minHeight = "auto";
		if (this.gridWrapper) {
			this.gridWrapper.style.width = `${this.gridWidth + 20}px`;
			this.gridWrapper.style.height = `${this.gridHeight + 20}px`;
		}
		this.updateGridScaling();
		for (let r = 0; r < this.state.rows; r++) {
			for (let c = 0; c < this.state.cols; c++) {
				const cell = document.createElement("div");
				cell.className = "cell";
				cell.dataset.row = r;
				cell.dataset.col = c;
				cell.draggable = false;
				cell.addEventListener("dragover", (e) => e.preventDefault());
				cell.addEventListener("drop", this.handleDrop.bind(this));
				this.grid.appendChild(cell);
			}
		}
		this.renderAreas();
	}

	renderAreas() {
		if (!this.grid) return;
		const gap = 8;
		const { colWidth: cellWidth, rowHeight: cellHeight } = this.getGridMetrics();

		Object.values(this.state.areas).forEach((area) => {
			const element = this.state.elements.find((el) => el.id === area.id);
			const block = document.createElement("div");
			block.className = "area-block";
			block.draggable = false;
			block.dataset.areaId = area.id;
			const x = area.colStart * (cellWidth + gap);
			const y = area.rowStart * (cellHeight + gap);
			const width =
				(area.colEnd - area.colStart + 1) * cellWidth + (area.colEnd - area.colStart) * gap;
			const height =
				(area.rowEnd - area.rowStart + 1) * cellHeight +
				(area.rowEnd - area.rowStart) * gap;
			block.style.left = `${x}px`;
			block.style.top = `${y}px`;
			block.style.width = `${width}px`;
			block.style.height = `${height}px`;
			const color =
				this.areaColors[area.id] ||
				(this.areaColors[area.id] = GridDesigner.generateAreaColor(area.id));
			block.style.borderColor = color;
			block.style.background = `rgba(100, 160, 255, 0.2)`;
			block.style.boxShadow = `0 0 0 1px ${color}`;
			block.textContent = element ? element.name : area.id;
			block.addEventListener("pointerdown", this.handleAreaPointerDown.bind(this));
			block.addEventListener("pointermove", (e) => {
				const edge = this.isEdgePosition(e, block);
				if (edge.edge) {
					block.style.cursor = edge.left || edge.right ? "ew-resize" : "ns-resize";
				} else {
					block.style.cursor = "default";
				}
			});
			block.addEventListener("pointerleave", () => {
				block.style.cursor = "default";
			});
			block.addEventListener("dragstart", (e) => e.preventDefault());
			block.addEventListener("selectstart", (e) => e.preventDefault());
			block.addEventListener("dragover", (e) => e.preventDefault());
			block.addEventListener("drop", this.handleDrop.bind(this));
			this.grid.appendChild(block);
		});
	}

	static generateAreaColor(id) {
		const hue =
			(Array.from(String(id)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) * 7) % 360;
		return `hsl(${hue}, 70%, 60%)`;
	}

	cellToGridPos(clientX, clientY) {
		const gridRect = this.grid.getBoundingClientRect();
		const x = clientX - gridRect.left;
		const y = clientY - gridRect.top;
		const computed = getComputedStyle(this.grid);
		const gap = parseFloat(computed.gap) || 0;
		const scale = parseFloat(
			getComputedStyle(this.gridWrapper).getPropertyValue("--grid-scale") || "1",
		);

		const { colWidth: colSize, rowHeight: rowSize } = this.getGridMetrics();

		const scaledX = x / scale;
		const scaledY = y / scale;
		const col = Math.min(
			this.state.cols - 1,
			Math.max(0, Math.floor(scaledX / (colSize + gap))),
		);
		const row = Math.min(
			this.state.rows - 1,
			Math.max(0, Math.floor(scaledY / (rowSize + gap))),
		);
		return { row, col };
	}

	isEdgePosition(event, block) {
		const rect = block.getBoundingClientRect();
		const threshold = 12;
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const right = x >= rect.width - threshold;
		const bottom = y >= rect.height - threshold;
		const left = x <= threshold;
		const top = y <= threshold;
		return { top, bottom, left, right, edge: top || bottom || left || right };
	}

	handleAreaPointerDown(event) {
		event.preventDefault();
		event.stopPropagation();
		if (event.button !== 0) return;
		const block = event.currentTarget;
		const id = block.dataset.areaId;
		const area = this.state.areas[id];
		if (!area) return;
		const edge = this.isEdgePosition(event, block);
		if (!edge.edge) return;
		block.classList.toggle("edge-top", edge.top);
		block.classList.toggle("edge-bottom", edge.bottom);
		block.classList.toggle("edge-left", edge.left);
		block.classList.toggle("edge-right", edge.right);
		this.resizeState = {
			id,
			edge,
			startArea: { ...area },
			dragging: true,
		};

		this.handlePointerMoveBound = this.handlePointerMove.bind(this);
		window.addEventListener("pointermove", this.handlePointerMoveBound);
		window.addEventListener("pointerup", this.handlePointerUp.bind(this));
		document.body.style.cursor =
			edge.top || edge.bottom ? "ns-resize" : edge.left || edge.right ? "ew-resize" : "move";
	}

	renderRowControls() {
		const existingControls = this.rowControls.querySelectorAll("label");
		if (existingControls) existingControls.forEach((el) => el.remove());
		const controlsContainer = this.rowControls;

		const options = [
			{ value: "1fr", label: "Flexible (1fr)" },
			{ value: "max-content", label: "Content height" },
			{ value: "min-content", label: "Min content" },
			{ value: "auto", label: "Auto" },
		];

		for (let i = 0; i < this.state.rows; i++) {
			const rowControl = document.createElement("label");
			const label = document.createElement("span");
			label.textContent = `Row ${i + 1}:`;
			const select = document.createElement("select");
			select.dataset.rowIndex = i;

			options.forEach((option) => {
				const optionEl = document.createElement("option");
				optionEl.value = option.value;
				optionEl.textContent = option.label;
				if (this.state.rowHeights[i] === option.value) {
					optionEl.selected = true;
				}
				select.appendChild(optionEl);
			});

			select.addEventListener("change", (e) => {
				const rowIndex = parseInt(e.target.dataset.rowIndex, 10);
				this.state.rowHeights[rowIndex] = e.target.value;
				this.updateCssPreview();
			});

			rowControl.appendChild(label);
			rowControl.appendChild(select);
			controlsContainer.appendChild(rowControl);
		}
	}

	updateGridScaling() {
		if (!this.gridWrapper) return;
		const viewportWidth = window.innerWidth - 40;
		const viewportHeight = window.innerHeight * 0.8;
		const totalGridWidth = this.gridWidth + 20;
		const totalGridHeight = this.gridHeight + 20;
		const widthScale = totalGridWidth > viewportWidth ? viewportWidth / totalGridWidth : 1;
		const heightScale = totalGridHeight > viewportHeight ? viewportHeight / totalGridHeight : 1;
		const scale = Math.min(widthScale, heightScale);
		if (scale < 1) {
			this.gridWrapper.style.setProperty("--grid-scale", scale);
			this.gridWrapper.style.setProperty(
				"--grid-margin",
				`${(viewportWidth - totalGridWidth * scale) / 2}px`,
			);
			this.gridWrapper.style.setProperty(
				"--grid-margin-top",
				`${(viewportHeight - totalGridHeight * scale) / 2}px`,
			);
		} else {
			this.gridWrapper.style.setProperty("--grid-scale", "1");
			this.gridWrapper.style.setProperty("--grid-margin", "0px");
			this.gridWrapper.style.setProperty("--grid-margin-top", "0px");
		}
	}

	calculateGridDimensions() {
		this.gridWidth = this.currentResolution?.width || 1536;
		this.gridHeight = this.currentResolution?.height || 864;
	}

	getCssContainerQuery(screenWidth, bannerWidth) {
		//resolutions are sorted in descending order
		const resolutions = this.resolutions[screenWidth];
		const index = resolutions.findIndex((r) => r.width === bannerWidth);

		if (index === resolutions.length - 1) {
			//smallest resolution
			return `@container box (max-width: ${bannerWidth}px)`;
		}

		if (index === 0) {
			//largest resolution
			return `@container box (min-width: ${resolutions[index + 1].width + 1}px)`;
		}

		const min = resolutions[index + 1].width + 1;
		const max = bannerWidth;
		return `@container box (min-width: ${min}px) and (max-width: ${max}px)`;
	}

	getCssContainerQueryForFinished(finishedWidths, index) {
		if (!Array.isArray(finishedWidths) || finishedWidths.length === 0) {
			return "@container box";
		}

		if (finishedWidths.length === 1) {
			return "@container box";
		}

		if (index === 0) {
			return `@container box (min-width: ${finishedWidths[0] + 1}px)`;
		}

		if (index === finishedWidths.length - 1) {
			return `@container box (max-width: ${finishedWidths[index - 1]}px)`;
		}

		const min = finishedWidths[index] + 1;
		const max = finishedWidths[index - 1];
		return `@container box (min-width: ${min}px) and (max-width: ${max}px)`;
	}

	generateGridTemplate(state, indent = "") {
		const cols = Math.max(1, Number(state?.cols) || 1);
		const rowHeights = Array.isArray(state?.rowHeights) ? state.rowHeights : ["1fr"];
		const inputRows = Array.isArray(state?.gridMatrix) ? state.gridMatrix : [];
		const rows = inputRows.length > 0 ? inputRows : [Array.from({ length: cols }, () => ".")];

		const areaLines = rows
			.map((row) => {
				const normalizedRow = Array.from(
					{ length: cols },
					(_, index) => (Array.isArray(row) ? row[index] : null) || ".",
				);
				return `${indent}  "${normalizedRow.join(" ")}"`;
			})
			.join("\n");

		return [
			`${indent}display: grid;`,
			`${indent}grid-template-columns: repeat(${cols}, 1fr);`,
			`${indent}grid-template-rows: ${rowHeights.join(" ")};`,
			`${indent}gap: 8px;`,
			`${indent}grid-template-areas:`,
			`${areaLines};`,
		].join("\n");
	}

	generateCss() {
		const rootSelector = `.box[cardid="${GridDesigner.sanitizeId(this.editorCardId)}"] .stripe`;
		this.refreshFinishedStates();

		return this.sortedScreenWidths
			.map((pageWidth) => {
				const banners = this.resolutions[pageWidth];
				const states = this.state.resolutionStates[pageWidth] || [];
				const finishedEntries = banners
					.map((res, idx) => ({ res, state: states[idx] }))
					.filter(({ state }) => Boolean(state?.finished));

				if (!finishedEntries.length) return "";

				const finishedWidths = finishedEntries.map(({ res }) => res.width);

				const innerContent = finishedEntries
					.map(({ state }, idx) => {
						const query = this.getCssContainerQueryForFinished(finishedWidths, idx);
						return [
							`  ${query} {`,
							`    ${rootSelector} {`,
							this.generateGridTemplate(state, "      "),
							"    }",
							"  }",
						].join("\n");
					})
					.join("\n\n");

				return [`@media (max-width: ${pageWidth}px) {`, innerContent, "}"].join("\n");
			})
			.filter(Boolean)
			.join("\n\n");
	}

	updateCssPreview() {
		if (!this.cssCode) return;
		this.saveResolutionState(this.state.currentResolutionIndex);
		this.refreshFinishedStates();
		this.updateResolutionTabState();
		this.cssCode.textContent = this.generateCss();
	}

	renderElementList() {
		if (!this.elementList) return;
		this.elementList.innerHTML = "";
		const placedIds = new Set(Object.keys(this.state.areas || {}));
		this.state.elements.forEach((element) => {
			const tag = document.createElement("div");
			const isPlaced = placedIds.has(element.id);
			tag.className = `element-tag ${isPlaced ? "placed" : "pending"}`;
			tag.draggable = true;
			tag.textContent = element.name;
			tag.title = isPlaced ? "Placed on grid" : "Still needs placement";

			if (!this.areaColors[element.id])
				this.areaColors[element.id] = GridDesigner.generateAreaColor(element.id);
			tag.style.borderColor = this.areaColors[element.id];
			tag.addEventListener("dragstart", (e) => {
				e.dataTransfer.setData("text/plain", element.id);
			});
			this.elementList.appendChild(tag);
		});
	}

	getState() {
		this.saveResolutionState(this.state.currentResolutionIndex);
		return {
			id: this.editorCardId,
			currentPageWidth: this.state.currentPageWidth,
			currentResolutionIndex: this.state.currentResolutionIndex,
			elements: JSON.parse(JSON.stringify(this.state.elements)),
			resolutionStates: this.state.resolutionStates,
			resolutionStructure: this.resolutions,
		};
	}

	getCss() {
		return this.generateCss();
	}
}

window.GridDesigner = {
	Init(id, resolutions, tags, state) {
		window.GridDesignerInstance = new GridDesigner(id, resolutions, tags, state);
		return window.GridDesignerInstance;
	},
	GetCss() {
		return window.GridDesignerInstance?.getCss?.() || "";
	},
	GetState() {
		return window.GridDesignerInstance?.getState?.() || null;
	},
};
