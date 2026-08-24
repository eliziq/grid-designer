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

		const resolveResolutionGroupType = ({ type = "custom", device = "desktop" } = {}) => {
			if (type === "custom") return device === "mobile" ? "custom-mobile" : "custom";
			if (type === "grid" || type === "mobile") return type;
			return device === "mobile" ? "mobile" : "grid";
		};

		const ensureGroup = (type) => {
			let group = this.resolutionTabs.querySelector(`[data-resolution-type="${type}"]`);

			if (!group) {
				group = document.createElement("div");
				group.className = "resolution-group";
				group.dataset.resolutionType = type;
				this.resolutionTabs.appendChild(group);
			}

			let options = group.querySelector(".resolution-group-options");
			if (!options) {
				options = document.createElement("div");
				options.className = "resolution-group-options";
				group.appendChild(options);
			}

			options.innerHTML = "";
			return options;
		};

		const groups = {
			grid: ensureGroup("grid"),
			mobile: ensureGroup("mobile"),
			custom: ensureGroup("custom"),
			"custom-mobile": ensureGroup("custom-mobile"),
		};

		const activeGroup = this.resolutions[this.state.currentLayoutName] || [];
		let hasCustom = false;
		let hasCustomMobile = false;

		activeGroup.forEach((res, index) => {
			const resolutionType = resolveResolutionGroupType(res);

			if (resolutionType === "custom") hasCustom = true;
			if (resolutionType === "custom-mobile") hasCustomMobile = true;

			const targetContainer = groups[resolutionType];
			if (!targetContainer) return;

			const isActive = index === this.state.currentResolutionIndex;
			const resolutionState = this.getResolutionState(index);

			const option = new ResolutionOptionComponent({
				index,
				width: res.width,
				height: res.height,
				isActive,
				isFinished: Boolean(resolutionState?.finished),
				onChange: () => this.setCurrentResolution(res, false, index),
			}).toElement();

			if (option) {
				targetContainer.appendChild(option);
			}
		});

		if (!hasCustom) {
			groups.custom.closest(".resolution-group")?.remove();
		}
		if (!hasCustomMobile) {
			groups["custom-mobile"].closest(".resolution-group")?.remove();
		}

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

	setCurrentResolution(res, isInitialLoad = false, resolutionIndex = null) {
		if (!res) return;
		if (!isInitialLoad) {
			this.saveResolutionState(this.state.currentResolutionIndex);
		}

		const applyAndRefresh = () => {
			this.calculateGridDimensions();
			this.clampRowsToCurrentResolutionHeight();
		};

		this.currentResolution = res;
		const hasProvidedIndex =
			resolutionIndex !== null &&
			resolutionIndex !== undefined &&
			Number.isInteger(Number(resolutionIndex));
		const providedIndex = hasProvidedIndex ? Number(resolutionIndex) : -1;
		const group = this.resolutions[this.state.currentLayoutName] || [];
		let nextIndex = hasProvidedIndex ? providedIndex : group.indexOf(res);

		if (nextIndex < 0) {
			const signature = this.getResolutionSignature(res);
			nextIndex = group.findIndex(
				(candidate) => this.getResolutionSignature(candidate) === signature,
			);
		}

		if (nextIndex < 0) return;
		this.state.currentResolutionIndex = nextIndex;
		const radios = this.containerElement.querySelectorAll(
			"#resolutionTabs input[type='radio']",
		);
		const labels = this.containerElement.querySelectorAll("#resolutionTabs label");
		const index = this.state.currentResolutionIndex;
		radios.forEach((radio) => {
			const radioIndex = Number(radio.value);
			radio.checked = Number.isInteger(radioIndex) && radioIndex === index;
		});
		labels.forEach((label) => {
			const radio = label.querySelector("input[type='radio']");
			const labelIndex = Number(radio?.value);
			label.classList.toggle("active", Number.isInteger(labelIndex) && labelIndex === index);
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
		const minRowHeight = 50;
		if (numericHeight <= 0) return 10;
		return Math.max(1, Math.min(10, Math.floor(numericHeight / minRowHeight)));
	},

	clampRowsToCurrentResolutionHeight() {
		const maxRows = this.getMaxRowsForHeight(this.currentResolution?.height);
		if (this.rowCountInput && Number.isFinite(maxRows)) {
			this.rowCountInput.max = String(maxRows);
		}
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
		if (!layoutWidth) return 12;

		const ratioBasedCols = Math.round((resolutionWidth / layoutWidth) * 12);
		return Math.max(1, Math.min(12, ratioBasedCols));
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
		this.setJustifyContentControlValue(this.state.justifyContent);
		this.setAlignItemsControlValue(this.state.alignItems);
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
});
