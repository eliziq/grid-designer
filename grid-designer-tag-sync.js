Object.assign(GridDesigner.prototype, {
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
});
