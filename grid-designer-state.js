Object.assign(GridDesigner.prototype, {
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
	},

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
	},

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
	},

	activateFirstResolutionTab() {
		if (!this.resolutionTabs) return;
		const firstLabel = this.resolutionTabs.querySelector("label");
		if (firstLabel) {
			firstLabel.classList.add("active");
			const firstRadio = firstLabel.querySelector("input[type='radio']");
			if (firstRadio) firstRadio.checked = true;
		}
	},

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
		this.renderTagSelectionPanel();
	},

	loadEditorState(state) {
		if (!state || typeof state !== "object") return;

		const hasIncomingDesign =
			Array.isArray(state.elements) ||
			Boolean(state.resolutionStates) ||
			Boolean(state.resolutionStructure);
		if (hasIncomingDesign) {
			this.tagSelectionLocked = true;
		}

		const incomingElements = Array.isArray(state.elements)
			? state.elements
					.map((el, i) => {
						const normalized = GridDesigner.normalizeTag(el, i);
						if (!normalized) return null;
						return {
							...normalized,
							selected: true,
						};
					})
					.filter(Boolean)
			: [];

		if (Array.isArray(state.elements)) {
			if (this.allowedTags.length) {
				this.mergeAllowedTagsWithStateElements(incomingElements);
			} else {
				this.state.elements = incomingElements.map((tag) => ({
					id: tag.id,
					name: tag.name,
					controlType: tag.controlType,
					ctrls: (tag.ctrls || [])
						.filter((ctrl) => ctrl.selected)
						.map((ctrl) => ({ id: ctrl.id, name: ctrl.name, selected: true })),
				}));
			}
		} else if (this.allowedTags.length) {
			this.applySelectedTags();
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

		const activeState = this.getResolutionState(this.state.currentResolutionIndex);
		if (activeState) {
			this.applyResolutionState(activeState);
		}

		this.syncStateWithTags();
	},

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
	},

	getCurrentPatternKey() {
		return `${this.editorCardId}-${this.state.currentPageWidth}-${this.state.currentResolutionIndex}`;
	},

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
	},

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
	},

	getResolutionState(index) {
		const group = this.state.resolutionStates[this.state.currentPageWidth];
		return group ? group[index] : null;
	},

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
	},

	saveResolutionState(index) {
		if (!Number.isInteger(index) || index < 0) return;
		this.setResolutionState(index, {
			rows: this.state.rows,
			cols: this.state.cols,
			rowHeights: this.state.rowHeights,
			areas: this.state.areas,
			gridMatrix: this.state.gridMatrix,
		});
	},

	savePatternsToStorage() {
		localStorage.setItem(
			`gridDesignerPatterns-${GridDesigner.sanitizeId(this.editorCardId)}`,
			JSON.stringify(this.savedPatterns),
		);
	},

	initMatrix() {
		this.state.gridMatrix = Array.from({ length: this.state.rows }, () =>
			Array(this.state.cols).fill(null),
		);
	},

	ensureGridMatrixIntegrity() {
		const rows = Math.max(1, Number(this.state.rows) || 1);
		const cols = Math.max(1, Number(this.state.cols) || 1);
		const source = Array.isArray(this.state.gridMatrix) ? this.state.gridMatrix : [];

		this.state.gridMatrix = Array.from({ length: rows }, (_, rowIndex) => {
			const sourceRow = Array.isArray(source[rowIndex]) ? source[rowIndex] : [];
			return Array.from({ length: cols }, (_, colIndex) => sourceRow[colIndex] || null);
		});
	},

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
	},

	isResolutionStateFinished(state) {
		const requiredElementIds = (this.state.elements || []).map((element) => element.id);
		if (!requiredElementIds.length) return false;

		const areaIds = new Set(Object.keys(state?.areas || {}));
		return requiredElementIds.every((id) => areaIds.has(id));
	},

	refreshFinishedStates() {
		Object.keys(this.state.resolutionStates || {}).forEach((pageWidth) => {
			const states = this.state.resolutionStates[pageWidth] || [];
			states.forEach((state) => {
				if (!state) return;
				state.finished = this.isResolutionStateFinished(state);
			});
		});
	},

	syncStateWithTags() {
		const tagIds = new Set((this.state.elements || []).map((el) => el.id));

		const allPageWidths = Object.keys(this.state.resolutionStates || {});

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

		if (!tagIds.size) {
			removedIds = new Set();
			for (const pageWidth of allPageWidths) {
				for (const state of this.state.resolutionStates[pageWidth] || []) {
					for (const areaId of Object.keys(state?.areas || {})) {
						removedIds.add(areaId);
					}
				}
			}
		}

		if (!removedIds && finishedState) {
			const finishedAreaIds = new Set(Object.keys(finishedState.areas || {}));

			for (const tagId of tagIds) {
				if (!finishedAreaIds.has(tagId)) {
					markAllUnfinished = true;
					break;
				}
			}

			removedIds = new Set();
			for (const areaId of finishedAreaIds) {
				if (!tagIds.has(areaId)) {
					removedIds.add(areaId);
				}
			}
		} else if (!removedIds) {
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

		if (removedIds.size > 0) {
			let liveStateModified = false;
			this.ensureGridMatrixIntegrity();
			for (const id of removedIds) {
				if (id in (this.state.areas || {})) {
					delete this.state.areas[id];
					liveStateModified = true;
				}
			}

			if (liveStateModified && Array.isArray(this.state.gridMatrix)) {
				for (let r = 0; r < this.state.gridMatrix.length; r++) {
					const row = Array.isArray(this.state.gridMatrix[r])
						? this.state.gridMatrix[r]
						: [];
					for (let c = 0; c < row.length; c++) {
						if (removedIds.has(row[c])) {
							row[c] = null;
						}
					}
				}
			}

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
							const row = Array.isArray(state.gridMatrix[r])
								? state.gridMatrix[r]
								: [];
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

		this.saveResolutionState(this.state.currentResolutionIndex);
	},

	updateResolutionTabState() {
		if (!this.resolutionTabs) return;
		const labels = this.resolutionTabs.querySelectorAll("label");
		labels.forEach((label, index) => {
			const resolutionState = this.getResolutionState(index);
			label.classList.toggle("finished", Boolean(resolutionState?.finished));
		});
	},

	getCssContainerQuery(screenWidth, bannerWidth) {
		const resolutions = this.resolutions[screenWidth];
		const index = resolutions.findIndex((r) => r.width === bannerWidth);

		if (index === resolutions.length - 1) {
			return `@container box (max-width: ${bannerWidth}px)`;
		}

		if (index === 0) {
			return `@container box (min-width: ${resolutions[index + 1].width + 1}px)`;
		}

		const min = resolutions[index + 1].width + 1;
		const max = bannerWidth;
		return `@container box (min-width: ${min}px) and (max-width: ${max}px)`;
	},

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
	},

	generateGridTemplate(state, indent = "") {
		const cols = Math.max(1, Number(state?.cols) || 1);
		const rowHeights = Array.isArray(state?.rowHeights) ? state.rowHeights : ["1fr"];
		const inputRows = Array.isArray(state?.gridMatrix) ? state.gridMatrix : [];
		const rows = inputRows.length > 0 ? inputRows : [Array.from({ length: cols }, () => ".")];

		const areaLines = rows
			.map((row) => {
				const normalizedRow = Array.from(
					{ length: cols },
					(_, idx) => (Array.isArray(row) ? row[idx] : null) || ".",
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
	},

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
	},

	updateCssPreview() {
		if (!this.cssCode) return;
		this.saveResolutionState(this.state.currentResolutionIndex);
		this.refreshFinishedStates();
		this.updateResolutionTabState();
		this.cssCode.textContent = this.generateCss();
	},

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
	},

	getCss() {
		return this.generateCss();
	},
});
