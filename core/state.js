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
		labels.forEach((label) => {
			const radio = label.querySelector("input[type='radio']");
			const index = Number(radio?.value);
			const resolutionState = Number.isInteger(index) ? this.getResolutionState(index) : null;
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

	getResolutionHeaderPreset(source) {
		return String(source?.areas?.Event_TeamName?.headerPreset || "").trim();
	},

	getSavedPresets() {
		this.saveResolutionState(this.state.currentResolutionIndex);
		const presets = [];

		Object.entries(this.state.resolutionStates || {}).forEach(([layoutName, states]) => {
			(states || []).forEach((resolutionState, resolutionIndex) => {
				const preset = this.getResolutionHeaderPreset(resolutionState);
				if (!preset) return;

				const layoutDefinition = this.layoutDefinitions?.[layoutName] || {};
				const resolution = this.getResolutionSignature(
					this.resolutions?.[layoutName]?.[resolutionIndex],
				);
				presets.push({
					layoutName,
					layoutId: layoutDefinition.id,
					resolutionIndex,
					resolution,
					areaId: "Event_TeamName",
					preset,
				});
			});
		});

		return presets;
	},
});
