Object.assign(GridDesigner.prototype, {
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

	updateResolutionTabState() {
		if (!this.resolutionTabs) return;
		const labels = this.resolutionTabs.querySelectorAll("label");
		labels.forEach((label, index) => {
			const resolutionState = this.getResolutionState(index);
			label.classList.toggle("finished", Boolean(resolutionState?.finished));
		});
	},

	updateCssPreview() {
		if (!this.cssCode) return;
		this.saveResolutionState(this.state.currentResolutionIndex);
		this.refreshFinishedStates();
		this.updateResolutionTabState();
		this.renderTagSelectionPanel();
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

	getSavedPresets() {
		this.saveResolutionState(this.state.currentResolutionIndex);
		const presets = [];

		Object.entries(this.state.resolutionStates || {}).forEach(([layoutName, states]) => {
			(states || []).forEach((resolutionState, resolutionIndex) => {
				const areas = resolutionState?.areas || {};
				const areaId = "Event_TeamName";
				const presetValue = String(areas?.[areaId]?.headerPreset || "").trim();
				if (!presetValue) return;
				presets.push({
					layoutName,
					resolutionIndex,
					areaId,
					preset: presetValue,
				});
			});
		});

		return presets;
	},
});
