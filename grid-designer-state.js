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
		let lastType = "";
		let currentGroupOptions = null;

		activeGroup.forEach((res, index) => {
			const resolutionType = String(res?.type || "custom");
			if (resolutionType !== lastType) {
				lastType = resolutionType;
				const group = document.createElement("div");
				group.className = "resolution-group";
				const caption = document.createElement("div");
				caption.className = "resolution-group-caption";
				caption.textContent = resolutionType.toUpperCase();
				group.appendChild(caption);

				currentGroupOptions = document.createElement("div");
				currentGroupOptions.className = "resolution-group-options";
				group.appendChild(currentGroupOptions);

				this.resolutionTabs.appendChild(group);
			}

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
				this.setCurrentResolution(res);
			});

			label.appendChild(radio);
			label.appendChild(document.createTextNode(` ${res.width}x${res.height}`));

			if (currentGroupOptions) {
				currentGroupOptions.appendChild(label);
			}
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

		const applyAndRefresh = () => {
			this.calculateGridDimensions();
			this.clampRowsToCurrentResolutionHeight();
		};

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
			applyAndRefresh();
		} else if (this.savedPatterns[patternKey]) {
			this.loadPattern(patternKey);
			applyAndRefresh();
			this.saveResolutionState(index);
			this.refreshResolutionUi();
			return;
		} else {
			this.applyResolutionState(this.createDefaultResolutionState(this.currentResolution));
			applyAndRefresh();
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

	getResolutionSignature(resolution) {
		const width = Number(resolution?.width);
		const height = Number(resolution?.height);

		if (!Number.isFinite(width) || !Number.isFinite(height)) return "";

		return `${width}x${height}`;
	},

	applyIncomingElements(state) {
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
	},

	buildIncomingResolutionLookup(state) {
		const incomingLayouts = state.layoutDefinitions
			? GridDesigner.normalizeLayoutDefinitions(state.layoutDefinitions)
			: null;
		const incomingResolutions = incomingLayouts?.resolutions || {};
		return Object.fromEntries(
			Object.entries(incomingResolutions).map(([layoutName, resolutions]) => {
				const map = new Map();
				(resolutions || []).forEach((resolution, idx) => {
					const signature = this.getResolutionSignature(resolution);
					if (signature && !map.has(signature)) map.set(signature, idx);
				});
				return [layoutName, map];
			}),
		);
	},

	applyLayoutSelectionFromState(state, availableWidths) {
		this.layoutOrder = this.layoutOrder.length
			? this.layoutOrder.filter((name) => availableWidths.includes(name))
			: [...availableWidths];

		this.state.currentLayoutName =
			state.currentLayoutName && availableWidths.includes(String(state.currentLayoutName))
				? String(state.currentLayoutName)
				: availableWidths[0];

		const currentGroup = this.resolutions[this.state.currentLayoutName] || [];
		const maxIdx = Math.max(0, currentGroup.length - 1);
		this.state.currentResolutionIndex = Number.isInteger(state.currentResolutionIndex)
			? Math.min(Math.max(0, state.currentResolutionIndex), maxIdx)
			: 0;
	},

	hydrateResolutionStates(state, availableWidths, incomingResolutionLookup) {
		this.state.resolutionStates = {};

		availableWidths.forEach((pageWidth) => {
			const banners = this.resolutions[pageWidth];

			this.state.resolutionStates[pageWidth] = banners.map((res) => {
				const defaultState = this.createDefaultResolutionState(res, pageWidth);
				const signature = this.getResolutionSignature(res);
				const incomingStates = state?.resolutionStates?.[pageWidth];
				const matchedIndex = incomingResolutionLookup[pageWidth]?.get(signature);
				const incomingState = Number.isInteger(matchedIndex)
					? incomingStates?.[matchedIndex]
					: null;

				if (!incomingState || typeof incomingState !== "object") {
					return defaultState;
				}

				return this.createNormalizedResolutionStateSnapshot(incomingState, defaultState);
			});
		});
	},

	loadEditorState(state) {
		if (!state || typeof state !== "object") return;

		const hasIncomingDesign = Array.isArray(state.elements) || Boolean(state.resolutionStates);
		if (hasIncomingDesign) {
			this.tagSelectionLocked = true;
		}

		this.applyIncomingElements(state);
		const incomingResolutionLookup = this.buildIncomingResolutionLookup(state);

		const availableWidths = Object.keys(this.resolutions);
		if (!availableWidths.length) return;
		this.applyLayoutSelectionFromState(state, availableWidths);
		this.hydrateResolutionStates(state, availableWidths, incomingResolutionLookup);

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
			justifyContent: "center",
			alignItems: "center",
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
			justifyContent: source?.justifyContent || fallback.justifyContent || "center",
			alignItems: source?.alignItems || fallback.alignItems || "center",
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
		this.state.justifyContent = snapshot.justifyContent || "center";
		this.state.alignItems = snapshot.alignItems || "center";
		this.state.rowHeights = [...snapshot.rowHeights];
		this.state.areas = GridDesigner.cloneData(snapshot.areas, {}) || {};
		this.state.gridMatrix = snapshot.gridMatrix.map((row) => [...row]);
		if (this.colCountInput) this.colCountInput.value = this.state.cols;
		if (this.rowCountInput) this.rowCountInput.value = this.state.rows;
		if (this.justifyContentSelect) this.justifyContentSelect.value = this.state.justifyContent;
		if (this.alignItemsSelect) this.alignItemsSelect.value = this.state.alignItems;
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
			justifyContent: this.state.justifyContent,
			alignItems: this.state.alignItems,
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
			`${indent}justify-content: ${state?.justifyContent || "center"};`,
			`${indent}align-items: ${state?.alignItems || "center"};`,
			`${indent}gap: 8px;`,
			`${indent}grid-template-areas:`,
			`${areaLines};`,
		].join("\n");
	},

	buildCssRangeQuery(atRule, items, idx, dimension = "width") {
		if (!Array.isArray(items) || items.length <= 1) return null;
		const currentValue = Number(items[idx]?.[dimension]);
		if (!Number.isFinite(currentValue)) return null;

		if (idx === 0) {
			const nextValue = Number(items[1]?.[dimension]);
			if (!Number.isFinite(nextValue)) return null;
			return `@${atRule} (min-${dimension}: ${nextValue + 1}px)`;
		}

		if (idx === items.length - 1) {
			return `@${atRule} (max-${dimension}: ${currentValue}px)`;
		}

		const nextValue = Number(items[idx + 1]?.[dimension]);
		if (!Number.isFinite(nextValue)) return null;
		return `@${atRule} (min-${dimension}: ${nextValue + 1}px) and (max-${dimension}: ${currentValue}px)`;
	},

	collectFinishedCssGroups() {
		return this.layoutOrder
			.map((layoutName) => {
				const layoutDefinition = this.layoutDefinitions[layoutName] || {};
				const banners = this.resolutions[layoutName] || [];
				const states = this.state.resolutionStates[layoutName] || [];
				const resolutionsByPair = new Map();
				banners.forEach((res, idx) => {
					const state = states[idx];
					if (!state?.finished) return;
					const width = Number(res?.width);
					const height = Number(res?.height);
					if (!Number.isFinite(width) || !Number.isFinite(height)) return;
					const type = String(res?.type || "custom");
					resolutionsByPair.set(`${width}x${height}:${type}`, {
						width,
						height,
						type,
						state,
					});
				});
				const resolutions = [...resolutionsByPair.values()].sort(
					(a, b) => b.width - a.width || b.height - a.height,
				);
				if (!resolutions.length) return null;
				return {
					layoutId: String(layoutDefinition.id || ""),
					resolutions,
				};
			})
			.filter(Boolean);
	},

	renderCssResolutionBlock(rootSelector, resolution, indent = "") {
		return [
			`${indent}${rootSelector} {`,
			this.generateGridTemplate(resolution.state, `${indent}  `),
			`${indent}}`,
		].join("\n");
	},

	renderCssHeightBlocks(rootSelector, resolutions, indent = "") {
		return resolutions
			.map((resolution, heightIndex, heightItems) => {
				const heightQuery = this.buildCssRangeQuery(
					"container box",
					heightItems,
					heightIndex,
					"height",
				);
				if (!heightQuery) {
					return this.renderCssResolutionBlock(rootSelector, resolution, indent);
				}

				return [
					`${indent}${heightQuery} {`,
					this.renderCssResolutionBlock(rootSelector, resolution, `${indent}  `),
					`${indent}}`,
				].join("\n");
			})
			.join("\n\n");
	},

	renderCssWidthGroup(rootSelector, widthGroup, widthIndex, widthItems, indent = "") {
		const widthQuery = this.buildCssRangeQuery(
			"container box",
			widthItems,
			widthIndex,
			"width",
		);

		if (widthGroup.resolutions.length > 1) {
			const heightBlocks = this.renderCssHeightBlocks(
				rootSelector,
				widthGroup.resolutions,
				`${indent}  `,
			);
			if (!widthQuery) return heightBlocks;
			return [`${indent}${widthQuery} {`, heightBlocks, `${indent}}`].join("\n");
		}

		const rule = this.renderCssResolutionBlock(
			rootSelector,
			widthGroup.resolutions[0],
			`${indent}  `,
		);
		if (!widthQuery) return rule;
		return [`${indent}${widthQuery} {`, rule, `${indent}}`].join("\n");
	},

	renderCssResolutionSet(rootSelector, resolutions) {
		if (!resolutions.length) return "";
		const widthGroupsByWidth = new Map();
		resolutions.forEach((resolution) => {
			const widthGroup = widthGroupsByWidth.get(resolution.width) || {
				width: resolution.width,
				resolutions: [],
			};
			widthGroup.resolutions.push(resolution);
			widthGroupsByWidth.set(resolution.width, widthGroup);
		});

		const widthGroups = [...widthGroupsByWidth.values()].sort((a, b) => b.width - a.width);

		return widthGroups
			.map((widthGroup, widthIndex, widthItems) =>
				this.renderCssWidthGroup(rootSelector, widthGroup, widthIndex, widthItems),
			)
			.join("\n\n");
	},

	partitionResolutionsByType(resolutions) {
		return resolutions.reduce(
			(acc, resolution) => {
				if (resolution.type === "mobile") {
					acc.mobile.push(resolution);
				} else {
					acc.nonMobile.push(resolution);
				}
				return acc;
			},
			{ mobile: [], nonMobile: [] },
		);
	},

	renderSingleResolutionCss(group, cardSelector) {
		const singleResolution = group?.resolutions?.[0];
		const state = singleResolution?.state;
		const rootSelector = group?.layoutId
			? `[layoutid="${group.layoutId}"] ${cardSelector}`
			: cardSelector;
		if (!state) return "";
		const baseRule = [`${rootSelector} {`, this.generateGridTemplate(state, "  "), "}"].join(
			"\n",
		);
		if (singleResolution?.type === "mobile") {
			return ["@media (max-width: 800px) {", baseRule.replace(/^/gm, "  "), "}"].join("\n");
		}
		return baseRule;
	},

	renderCssGroup(group, cardSelector) {
		const rootSelector = group.layoutId
			? `[layoutid="${group.layoutId}"] ${cardSelector}`
			: cardSelector;
		const partitioned = this.partitionResolutionsByType(group.resolutions);

		const blocks = [];
		const nonMobileCss = this.renderCssResolutionSet(rootSelector, partitioned.nonMobile);
		if (nonMobileCss) {
			blocks.push(nonMobileCss);
		}

		const mobileCss = this.renderCssResolutionSet(rootSelector, partitioned.mobile);
		if (mobileCss) {
			blocks.push(
				["@media (max-width: 800px) {", mobileCss.replace(/^/gm, "  "), "}"].join("\n"),
			);
		}

		return blocks.join("\n\n");
	},

	generateCss() {
		const cardSelector = `.box[cardid="${String(this.editorCardId)}"] .stripe`;
		this.refreshFinishedStates();
		const finishedGroups = this.collectFinishedCssGroups();

		const totalFinished = finishedGroups.reduce(
			(sum, group) => sum + group.resolutions.length,
			0,
		);

		if (totalFinished === 1) {
			return this.renderSingleResolutionCss(finishedGroups[0], cardSelector);
		}

		return finishedGroups
			.map((group) => this.renderCssGroup(group, cardSelector))
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
			currentLayoutName: this.state.currentLayoutName,
			currentResolutionIndex: this.state.currentResolutionIndex,
			elements: GridDesigner.cloneData(this.state.elements, []),
			resolutionStates: this.state.resolutionStates,
			layoutDefinitions: this.layoutDefinitions,
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
