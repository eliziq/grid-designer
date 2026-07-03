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
});
