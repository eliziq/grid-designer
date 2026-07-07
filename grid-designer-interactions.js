Object.assign(GridDesigner.prototype, {
	attachEditorListeners() {
		if (this.editorReady) return;
		if (this.buildGridButton)
			this.buildGridButton.addEventListener("click", this.confirmBuildGrid.bind(this));
		this.bindJustifyContentControlChange(this.handleGridAlignmentChange.bind(this));
		this.bindAlignItemsControlChange(this.handleGridAlignmentChange.bind(this));
		if (this.clearGridButton)
			this.clearGridButton.addEventListener("click", this.handleClearGrid.bind(this));
		if (this.exportCssButton)
			this.exportCssButton.addEventListener("click", this.handleExportCss.bind(this));
		if (this.exportJsonButton)
			this.exportJsonButton.addEventListener("click", this.handleExportJson.bind(this));
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
				if (!isChecked) ctrlInput.checked = false;
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
			const isSingleCtrl = (tag.ctrls || []).length <= 1;

			let ctrls = (tag.ctrls || []).map((ctrl) => {
				if (isSingleCtrl) {
					return { ...ctrl, selected: isSelected };
				}
				const ctrlInput = tagItem.querySelector(`input[data-ctrl-id="${ctrl.id}"]`);
				return {
					...ctrl,
					selected: isSelected ? Boolean(ctrlInput?.checked) : false,
				};
			});

			if (!isSingleCtrl && tag.controlType === "checkbox" && isSelected && ctrls.length) {
				isSelected = ctrls.some((ctrl) => ctrl.selected);
				if (!isSelected) {
					ctrls = ctrls.map((ctrl) => ({ ...ctrl, selected: false }));
				}
			}

			if (
				!isSingleCtrl &&
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

	confirmBuildGrid() {
		const hasPlacedAreas = Object.keys(this.state?.areas || {}).length > 0;
		if (!hasPlacedAreas) {
			this.handleBuildGrid();
			return;
		}

		const message = `Are you sure you want to rebuild the grid? All current areas will be cleared.`;
		const onConfirm = async () => {
			this.handleBuildGrid();
		};

		const confirmDialog = new ConfirmDialog(message, onConfirm);
		confirmDialog.open();
	},

	handleBuildGrid() {
		this.state.cols = Math.max(1, parseInt(this.colCountInput?.value, 10) || 1);
		this.state.rows = Math.max(1, parseInt(this.rowCountInput?.value, 10) || 1);
		const maxRows = this.getMaxRowsForHeight?.(this.currentResolution?.height);
		if (Number.isFinite(maxRows) && this.state.rows > maxRows) {
			this.state.rows = maxRows;
			if (this.rowCountInput) this.rowCountInput.value = String(maxRows);
		}
		if (this.state.rowHeights.length !== this.state.rows) {
			this.state.rowHeights = Array(this.state.rows).fill("1fr");
		}
		this.initMatrix();
		this.state.areas = {};
		this.refreshWorkspaceView();
	},

	handleGridAlignmentChange() {
		this.state.justifyContent = this.getJustifyContentControlValue();
		this.state.alignItems = this.getAlignItemsControlValue();
		this.applyGridAlignmentPreview();
		this.updateCssPreview();
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
			justifyContent: this.state.justifyContent,
			alignItems: this.state.alignItems,
			gridMatrix: this.state.gridMatrix.map((row) => [...row]),
			elements: [...this.state.elements],
			areas: GridDesigner.cloneData(this.state.areas, {}) || {},
			rowHeights: [...this.state.rowHeights],
		};
		this.savedPatterns[key] = pattern;
		this.savePatternsToStorage();
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
				const pageWidth = this.state.currentLayoutName;
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

	handleRemoveTagFromGrid(elementId) {
		if (!elementId || !this.state.areas?.[elementId]) return;
		this.removeArea(elementId);
		this.refreshGridView();
	},

	handleAreaLabelInput(elementId, textValue) {
		const nextValue = String(textValue || "").replace(/\r\n?/g, "\n");
		const area = this.state.areas?.[elementId];
		if (!area || area.label === nextValue) return;
		area.label = nextValue;
	},
});
