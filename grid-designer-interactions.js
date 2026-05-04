Object.assign(GridDesigner.prototype, {
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
		this.containerElement.addEventListener("click", this.handleTagSelectionClick.bind(this));
		this.containerElement.addEventListener("change", this.handleTagSelectionChange.bind(this));
		window.addEventListener("resize", this.handleResize.bind(this));
		window.addEventListener("pointerup", this.handlePointerUp.bind(this));
		this.editorReady = true;
	},

	handleTagSelectionClick(event) {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (target.id === "tagSelectionSave") {
			event.preventDefault();
			this.handleSaveSelectedTags();
			return;
		}
		if (target.id === "tagSelectionEdit") {
			event.preventDefault();
			this.tagSelectionLocked = false;
			this.renderTagSelectionPanel();
		}
	},

	handleTagSelectionChange(event) {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (!target.closest("#tagSelectionPanel")) return;

		if (target.classList.contains("tag-selector__tag-check")) {
			const tagItem = target.closest(".tag-selector__item");
			if (!tagItem) return;
			const isChecked = target.checked;
			tagItem.querySelectorAll(".tag-selector__ctrl input").forEach((ctrlInput) => {
				ctrlInput.disabled = !isChecked;
			});
			return;
		}

		if (target.closest(".tag-selector__ctrl")) {
			const tagItem = target.closest(".tag-selector__item");
			if (!tagItem) return;
			const tagId = tagItem.dataset.tagId;
			const tag = this.allowedTags.find((item) => item.id === tagId);
			if (!tag || tag.controlType !== "checkbox") return;

			const controls = Array.from(tagItem.querySelectorAll(".tag-selector__ctrl input"));
			const hasSelectedControl = controls.some((input) => input.checked);
			const tagCheckbox = tagItem.querySelector(".tag-selector__tag-check");

			if (!hasSelectedControl && tagCheckbox) {
				tagCheckbox.checked = false;
				controls.forEach((input) => {
					input.disabled = true;
				});
			}
		}
	},

	handleSaveSelectedTags() {
		const panel = this.containerElement.querySelector("#tagSelectionPanel");
		if (!panel) return;

		this.allowedTags = this.allowedTags.map((tag) => {
			const tagItem = panel.querySelector(`.tag-selector__item[data-tag-id="${tag.id}"]`);
			if (!tagItem) return { ...tag };

			let isSelected = Boolean(tagItem.querySelector(".tag-selector__tag-check")?.checked);
			let ctrls = (tag.ctrls || []).map((ctrl) => {
				const ctrlInput = tagItem.querySelector(`input[data-ctrl-id="${ctrl.id}"]`);
				return {
					...ctrl,
					selected: isSelected ? Boolean(ctrlInput?.checked) : false,
				};
			});

			if (tag.controlType === "checkbox" && isSelected && ctrls.length) {
				isSelected = ctrls.some((ctrl) => ctrl.selected);
				if (!isSelected) {
					ctrls = ctrls.map((ctrl) => ({ ...ctrl, selected: false }));
				}
			}

			if (
				tag.controlType === "radio" &&
				isSelected &&
				ctrls.length &&
				!ctrls.some((ctrl) => ctrl.selected)
			) {
				ctrls = ctrls.map((ctrl, index) => ({ ...ctrl, selected: index === 0 }));
			}

			return {
				...tag,
				selected: isSelected,
				ctrls,
			};
		});

		this.applySelectedTags();
		this.syncStateWithTags();
		this.tagSelectionLocked = true;
		this.renderTagSelectionPanel();
		this.refreshWorkspaceView();
	},

	handleBuildGrid() {
		this.state.cols = Math.max(1, parseInt(this.colCountInput?.value, 10) || 1);
		this.state.rows = Math.max(1, parseInt(this.rowCountInput?.value, 10) || 1);
		if (this.state.rowHeights.length !== this.state.rows) {
			this.state.rowHeights = Array(this.state.rows).fill("1fr");
		}
		this.initMatrix();
		this.state.areas = {};
		this.refreshWorkspaceView();
	},

	handleClearGrid() {
		this.initMatrix();
		this.state.areas = {};
		this.refreshGridView();
	},

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
	},

	handleExportJson() {
		const state = this.getState();
		const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = "grid-designer-state.json";
		document.body.appendChild(link);
		link.click();
		link.remove();
	},

	handleSavePattern() {
		this.saveResolutionState(this.state.currentResolutionIndex);
		const key = this.getCurrentPatternKey();
		const pattern = {
			rows: this.state.rows,
			cols: this.state.cols,
			gridMatrix: this.state.gridMatrix.map((row) => [...row]),
			elements: [...this.state.elements],
			areas: GridDesigner.cloneData(this.state.areas, {}) || {},
			rowHeights: [...this.state.rowHeights],
		};
		this.savedPatterns[key] = pattern;
		this.savePatternsToStorage();
		this.updatePatternButtons();
		this.updateCssPreview();
	},

	handleDeletePattern() {
		const key = this.getCurrentPatternKey();
		delete this.savedPatterns[key];
		this.savePatternsToStorage();
		this.updatePatternButtons();
		this.updateCssPreview();
	},

	handleImportJson(event) {
		const file = event.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const state = JSON.parse(e.target?.result || "{}");
				this.tagSelectionLocked = true;
				this.loadEditorState(state);
				this.populatePageWidthSelect();
				this.createResolutionTabs();
				const pageWidth = this.state.currentPageWidth;
				const currentIndex = this.state.currentResolutionIndex || 0;
				const resolution = this.resolutions[pageWidth]?.[currentIndex];
				if (resolution) {
					this.setCurrentResolution(resolution, true);
				} else {
					this.refreshWorkspaceView();
				}
			} catch (error) {
				alert("Error loading design file: " + error.message);
			}
		};
		reader.readAsText(file);
		if (this.importStateInput) {
			this.importStateInput.value = "";
		}
	},

	handleResize() {
		this.updateGridScaling();
	},

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
	},

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
	},

	handleDrop(event) {
		event.preventDefault();
		const elementId = event.dataTransfer.getData("text/plain");
		if (!elementId) return;
		this.ensureGridMatrixIntegrity();
		let r;
		let c;
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
		this.refreshGridView();
	},

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
		document.body.style.cursor =
			edge.top || edge.bottom ? "ns-resize" : edge.left || edge.right ? "ew-resize" : "move";
	},
});
