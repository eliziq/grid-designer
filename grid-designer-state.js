Object.assign(GridDesigner.prototype, {
	populatePageWidthSelect() {
		if (!this.mainMaxWidthSelect) return;
		this.mainMaxWidthSelect.innerHTML = "";

		Object.keys(this.resolutions).forEach((layoutName) => {
			const layoutDefinition = this.layoutDefinitions[layoutName] || {};
			const layoutWidth = Number(layoutDefinition.width) || 0;
			const option = document.createElement("option");
			option.value = layoutName;
			option.textContent = layoutWidth ? `${layoutName} (${layoutWidth}px)` : layoutName;
			if (layoutName === this.state.currentLayoutName) option.selected = true;
			this.mainMaxWidthSelect.appendChild(option);
		});

		this.mainMaxWidthSelect.onchange = (e) => {
			this.saveResolutionState(this.state.currentResolutionIndex);

			this.state.currentLayoutName = e.target.value;
			this.state.currentResolutionIndex = 0;

			this.createResolutionTabs();

			const group = this.resolutions[this.state.currentLayoutName];
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
					this.resolutions[this.state.currentLayoutName]?.[0] || {
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

		const activeGroup = this.resolutions[this.state.currentLayoutName] || [];

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
			this.resolutions[this.state.currentLayoutName].indexOf(res);
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
			this.clampRowsToCurrentResolutionHeight();
		} else if (this.savedPatterns[patternKey]) {
			this.loadPattern(patternKey);
			this.calculateGridDimensions();
			this.clampRowsToCurrentResolutionHeight();
			this.saveResolutionState(index);
			this.refreshResolutionUi();
			return;
		} else {
			this.applyResolutionState(this.createDefaultResolutionState(this.currentResolution));
			this.calculateGridDimensions();
			this.clampRowsToCurrentResolutionHeight();
			this.state.areas = {};
			this.initMatrix();
		}
		this.refreshResolutionUi();
	},

	getMaxRowsForHeight(height) {
		const numericHeight = Number(height) || 0;
		if (numericHeight <= 0) return Infinity;
		return Math.max(1, Math.floor(numericHeight / 64));
	},

	clampRowsToCurrentResolutionHeight() {
		const maxRows = this.getMaxRowsForHeight(this.currentResolution?.height);
		if (!Number.isFinite(maxRows)) return;
		if (this.state.rows <= maxRows) return;

		this.state.rows = maxRows;
		this.state.rowHeights = (this.state.rowHeights || []).slice(0, maxRows);
		while (this.state.rowHeights.length < maxRows) {
			this.state.rowHeights.push("1fr");
		}

		const currentMatrix = Array.isArray(this.state.gridMatrix) ? this.state.gridMatrix : [];
		this.state.gridMatrix = currentMatrix.slice(0, maxRows).map((row) => {
			if (!Array.isArray(row)) return Array(this.state.cols).fill(null);
			return row.slice(0, this.state.cols);
		});
		while (this.state.gridMatrix.length < maxRows) {
			this.state.gridMatrix.push(Array(this.state.cols).fill(null));
		}

		if (this.rowCountInput) {
			this.rowCountInput.value = this.state.rows;
		}
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
				this.state.elements = this.buildSelectedElements(incomingElements);
			}
		} else if (this.allowedTags.length) {
			this.applySelectedTags();
		}

		if (state.resolutionStructure) {
			const normalizedResolutions = GridDesigner.normalizeResolutions(
				state.resolutionStructure,
			);
			this.resolutions = normalizedResolutions;
			this.layoutOrder = Object.keys(normalizedResolutions);
		}

		if (state.layoutDefinitions) {
			const normalizedLayouts = GridDesigner.normalizeLayoutDefinitions(
				state.layoutDefinitions,
			);
			this.layoutDefinitions = normalizedLayouts.layoutDefinitions;
			this.layoutOrder = normalizedLayouts.layoutOrder;
			this.resolutions = normalizedLayouts.resolutions;
		}

		const availableWidths = Object.keys(this.resolutions);
		this.layoutOrder = this.layoutOrder.length
			? this.layoutOrder.filter((name) => availableWidths.includes(name))
			: [...availableWidths];
		this.sortedScreenWidths = [...this.layoutOrder];

		this.state.currentLayoutName =
			(state.currentLayoutName &&
				availableWidths.includes(String(state.currentLayoutName))) ||
			(state.currentPageWidth && availableWidths.includes(String(state.currentPageWidth)))
				? String(state.currentLayoutName || state.currentPageWidth)
				: availableWidths[0];

		const currentGroup = this.resolutions[this.state.currentLayoutName] || [];
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
					pageWidth === this.state.currentLayoutName && index === currentResolutionIndex;

				const incoming =
					resolutionStates?.[pageWidth]?.[index] || (isCurrentlyActive ? state : null);

				if (!incoming || (!incoming.rows && !incoming.areas)) {
					return this.createDefaultResolutionState(res, pageWidth);
				}

				return this.createNormalizedResolutionStateSnapshot(incoming);
			});
		});

		const activeState = this.getResolutionState(this.state.currentResolutionIndex);
		if (activeState) {
			this.applyResolutionState(activeState);
		}

		this.syncStateWithTags();
	},

	calculateDefaultCols(res, layoutName = this.state.currentLayoutName) {
		const layoutWidth = Number(this.layoutDefinitions?.[layoutName]?.width) || 0;
		const isMobile = layoutWidth > 0 && layoutWidth <= 768;

		if (isMobile) return 12;

		const resolutionWidth = Number(res?.width) || layoutWidth;
		if (!layoutWidth) return 24;

		const ratioBasedCols = Math.round((resolutionWidth / layoutWidth) * 24);
		return Math.max(1, Math.min(24, ratioBasedCols));
	},

	createDefaultResolutionState(res, layoutName = this.state.currentLayoutName) {
		const cols = this.calculateDefaultCols(res, layoutName);
		return {
			rows: 4,
			cols,
			rowHeights: Array(4).fill("1fr"),
			areas: {},
			finished: false,
			gridMatrix: Array.from({ length: 4 }, () => Array(cols).fill(null)),
		};
	},

	createNormalizedResolutionStateSnapshot(source, fallback = {}) {
		const rows = Math.max(1, source?.rows || fallback.rows || 1);
		const cols = Math.max(1, source?.cols || fallback.cols || 1);

		return {
			rows,
			cols,
			rowHeights: Array.isArray(source?.rowHeights)
				? source.rowHeights.map((row) => row || "1fr")
				: Array(rows).fill("1fr"),
			areas: GridDesigner.cloneData(source?.areas, {}) || {},
			gridMatrix: Array.isArray(source?.gridMatrix)
				? source.gridMatrix.map((row) => [...row])
				: Array.from({ length: rows }, () => Array(cols).fill(null)),
		};
	},

	applyGridStateSnapshot(snapshot) {
		this.state.rows = snapshot.rows;
		this.state.cols = snapshot.cols;
		this.state.rowHeights = [...snapshot.rowHeights];
		this.state.areas = GridDesigner.cloneData(snapshot.areas, {}) || {};
		this.state.gridMatrix = snapshot.gridMatrix.map((row) => [...row]);
		if (this.colCountInput) this.colCountInput.value = this.state.cols;
		if (this.rowCountInput) this.rowCountInput.value = this.state.rows;
	},

	getCurrentPatternKey() {
		return `${this.editorCardId}-${this.state.currentLayoutName}-${this.state.currentResolutionIndex}`;
	},

	setResolutionState(index, state) {
		const pageWidth = this.state.currentLayoutName;

		if (!this.state.resolutionStates[pageWidth]) {
			this.state.resolutionStates[pageWidth] = [];
		}

		const normalizedState = this.createNormalizedResolutionStateSnapshot(state);

		normalizedState.finished = this.isResolutionStateFinished(normalizedState);
		this.state.resolutionStates[pageWidth][index] = normalizedState;
	},

	loadPattern(patternKey) {
		const pattern = this.savedPatterns[patternKey];
		if (!pattern) return;
		this.applyGridStateSnapshot(
			this.createNormalizedResolutionStateSnapshot(pattern, {
				rows: this.state.rows,
				cols: this.state.cols,
			}),
		);
	},

	getResolutionState(index) {
		const group = this.state.resolutionStates[this.state.currentLayoutName];
		return group ? group[index] : null;
	},

	applyResolutionState(state) {
		this.applyGridStateSnapshot(this.createNormalizedResolutionStateSnapshot(state));
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
			`gridDesignerPatterns-${String(this.editorCardId)}`,
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

	findFirstFinishedState(pageWidths = []) {
		for (const pageWidth of pageWidths) {
			for (const state of this.state.resolutionStates[pageWidth] || []) {
				if (state?.finished) return state;
			}
		}
		return null;
	},

	collectRemovedAreaIds(tagIds, pageWidths, finishedState) {
		const removedIds = new Set();

		if (!tagIds.size) {
			pageWidths.forEach((pageWidth) => {
				(this.state.resolutionStates[pageWidth] || []).forEach((state) => {
					Object.keys(state?.areas || {}).forEach((areaId) => removedIds.add(areaId));
				});
			});
			return { removedIds, markAllUnfinished: false };
		}

		if (finishedState) {
			const finishedAreaIds = new Set(Object.keys(finishedState.areas || {}));
			const markAllUnfinished = [...tagIds].some((tagId) => !finishedAreaIds.has(tagId));

			finishedAreaIds.forEach((areaId) => {
				if (!tagIds.has(areaId)) removedIds.add(areaId);
			});

			return { removedIds, markAllUnfinished };
		}

		pageWidths.forEach((pageWidth) => {
			(this.state.resolutionStates[pageWidth] || []).forEach((state) => {
				Object.keys(state?.areas || {}).forEach((areaId) => {
					if (!tagIds.has(areaId)) removedIds.add(areaId);
				});
			});
		});

		return { removedIds, markAllUnfinished: false };
	},

	pruneAreaIdsFromStateSnapshot(state, removedIds, ensureIntegrity = false) {
		if (!state || !removedIds.size) return false;

		if (ensureIntegrity) {
			this.ensureGridMatrixIntegrity();
		}

		let modified = false;
		for (const id of removedIds) {
			if (id in (state.areas || {})) {
				delete state.areas[id];
				modified = true;
			}
		}

		if (!modified || !Array.isArray(state.gridMatrix)) {
			return modified;
		}

		for (let r = 0; r < state.gridMatrix.length; r++) {
			const row = Array.isArray(state.gridMatrix[r]) ? state.gridMatrix[r] : [];
			for (let c = 0; c < row.length; c++) {
				if (removedIds.has(row[c])) {
					row[c] = null;
				}
			}
		}

		return true;
	},

	syncStateWithTags() {
		const tagIds = new Set((this.state.elements || []).map((el) => el.id));

		const allPageWidths = Object.keys(this.state.resolutionStates || {});
		const finishedState = this.findFirstFinishedState(allPageWidths);
		const { removedIds, markAllUnfinished } = this.collectRemovedAreaIds(
			tagIds,
			allPageWidths,
			finishedState,
		);

		if (removedIds.size > 0) {
			this.pruneAreaIdsFromStateSnapshot(this.state, removedIds, true);

			for (const pageWidth of allPageWidths) {
				for (const state of this.state.resolutionStates[pageWidth] || []) {
					this.pruneAreaIdsFromStateSnapshot(state, removedIds);
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

	generateGridTemplate(state, indent = "") {
		const areaNameById = new Map(
			(this.state.elements || []).map((element) => [
				element.id,
				element.gridArea || element.id,
			]),
		);
		const cols = Math.max(1, Number(state?.cols) || 1);
		const rowHeights = Array.isArray(state?.rowHeights) ? state.rowHeights : ["1fr"];
		const inputRows = Array.isArray(state?.gridMatrix) ? state.gridMatrix : [];
		const rows = inputRows.length > 0 ? inputRows : [Array.from({ length: cols }, () => ".")];

		const areaLines = rows
			.map((row) => {
				const normalizedRow = Array.from({ length: cols }, (_, idx) => {
					const rawId = (Array.isArray(row) ? row[idx] : null) || ".";
					if (rawId === ".") return ".";
					return areaNameById.get(rawId) || rawId;
				});
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
		const cardSelector = `.box[cardid="${String(this.editorCardId)}"] .stripe`;
		this.refreshFinishedStates();

		const buildRangeQuery = (atRule, items, idx) => {
			if (!Array.isArray(items) || items.length <= 1) return null;
			if (idx === 0) return `@${atRule} (min-width: ${items[1].width + 1}px)`;
			if (idx === items.length - 1) return `@${atRule} (max-width: ${items[idx].width}px)`;
			return `@${atRule} (min-width: ${items[idx + 1].width + 1}px) and (max-width: ${items[idx].width}px)`;
		};

		const finishedGroups = this.layoutOrder
			.map((layoutName) => {
				const layoutDefinition = this.layoutDefinitions[layoutName] || {};
				const banners = this.resolutions[layoutName] || [];
				const states = this.state.resolutionStates[layoutName] || [];
				const resolutions = banners
					.map((res, idx) => ({ width: res.width, state: states[idx] }))
					.filter((entry) => entry.state?.finished);
				if (!resolutions.length) return null;
				return {
					layoutName,
					layoutId: String(layoutDefinition.id || ""),
					width: Number(layoutDefinition.width) || 0,
					resolutions,
				};
			})
			.filter(Boolean);

		const totalFinished = finishedGroups.reduce(
			(sum, group) => sum + group.resolutions.length,
			0,
		);

		if (totalFinished === 1) {
			const state = finishedGroups[0]?.resolutions[0]?.state;
			const layoutId = finishedGroups[0]?.layoutId;
			const rootSelector = layoutId ? `[layoutid="${layoutId}"] ${cardSelector}` : cardSelector;
			if (!state) return "";
			return [`${rootSelector} {`, this.generateGridTemplate(state, "  "), "}"].join("\n");
		}

		return finishedGroups
			.map((group) => {
				const rootSelector = group.layoutId
					? `[layoutid="${group.layoutId}"] ${cardSelector}`
					: cardSelector;
				const mediaContent = group.resolutions
					.map((resolution, containerIndex, containerItems) => {
						const containerQuery = buildRangeQuery(
							"container box",
							containerItems,
							containerIndex,
						);

						if (!containerQuery) {
							return [
								`  ${rootSelector} {`,
								this.generateGridTemplate(resolution.state, "    "),
								"  }",
							].join("\n");
						}

						return [
							`  ${containerQuery} {`,
							`    ${rootSelector} {`,
							this.generateGridTemplate(resolution.state, "      "),
							"    }",
							"  }",
						].join("\n");
					})
					.join("\n\n");

				return mediaContent.replace(/^  /gm, "");
			})
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
			currentLayoutName: this.state.currentLayoutName,
			currentResolutionIndex: this.state.currentResolutionIndex,
			elements: GridDesigner.cloneData(this.state.elements, []),
			resolutionStates: this.state.resolutionStates,
			layoutDefinitions: this.layoutDefinitions,
			resolutionStructure: this.resolutions,
		};
	},

	getTags() {
		return (this.allowedTags || []).flatMap((tag) =>
			(tag?.ctrls || []).map((ctrl) => ({
				tag: String(ctrl?.tag || ""),
				selected: GridDesigner.normalizeBoolean(ctrl?.selected, false),
			})),
		);
	},

	getCss() {
		return this.generateCss();
	},
});
