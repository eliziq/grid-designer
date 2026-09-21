Object.assign(GridDesigner.prototype, {
	isTagExcludedByBuyMode(tag) {
		return Boolean(this.buyOnBannerMode && tag?.excludeWhenBuyOnBanner);
	},

	// Tags the user can currently pick from - excluded ones are hidden when buying on banner click.
	getVisibleTags() {
		return (this.allowedTags || []).filter((tag) => !this.isTagExcludedByBuyMode(tag));
	},

	// Remembers the selection and placements of the excluded tags so switching back to button mode can bring them back.
	captureExcludedSnapshot(excludedIds) {
		const tags = (this.allowedTags || []).filter(
			(tag) => excludedIds.has(tag.id) && tag.selected,
		);
		if (!tags.length) return null;

		if (this.state.resolutionStates?.[this.state.currentLayoutName]) {
			this.saveResolutionState(this.state.currentResolutionIndex);
		}

		const areas = {};
		Object.entries(this.state.resolutionStates || {}).forEach(([layoutName, states]) => {
			(states || []).forEach((resolutionState, index) => {
				Object.entries(resolutionState?.areas || {}).forEach(([areaId, area]) => {
					if (!excludedIds.has(areaId)) return;
					areas[layoutName] ??= {};
					areas[layoutName][index] ??= {};
					areas[layoutName][index][areaId] = GridDesigner.cloneData(area, {});
				});
			});
		});

		return {
			tags: GridDesigner.cloneData(tags, []),
			elements: GridDesigner.cloneData(
				(this.state.elements || []).filter((el) => excludedIds.has(el.id)),
				[],
			),
			areas,
		};
	},

	// Puts an area back into a stored resolution state if its cells are still free.
	placeAreaInResolutionState(resolutionState, areaId, area) {
		if (!resolutionState || !areaId || !area) return false;
		const rows = Number(resolutionState.rows) || 0;
		const cols = Number(resolutionState.cols) || 0;
		if (area.rowStart < 0 || area.colStart < 0 || area.rowEnd >= rows || area.colEnd >= cols) {
			return false;
		}

		const matrix = Array.isArray(resolutionState.gridMatrix) ? resolutionState.gridMatrix : [];
		for (let r = area.rowStart; r <= area.rowEnd; r++) {
			for (let c = area.colStart; c <= area.colEnd; c++) {
				if (matrix[r]?.[c]) return false;
			}
		}

		resolutionState.areas ??= {};
		resolutionState.areas[areaId] = GridDesigner.cloneData(area, {});
		for (let r = area.rowStart; r <= area.rowEnd; r++) {
			matrix[r] ??= [];
			for (let c = area.colStart; c <= area.colEnd; c++) {
				matrix[r][c] = areaId;
			}
		}
		return true;
	},

	restoreExcludedSnapshot() {
		const snapshot = this.buyModeSnapshot;
		this.buyModeSnapshot = null;
		if (!snapshot) return;

		// Store what was edited on the current grid while in banner mode before putting areas back.
		if (this.state.resolutionStates?.[this.state.currentLayoutName]) {
			this.saveResolutionState(this.state.currentResolutionIndex);
		}

		const snapshotTags = new Map(snapshot.tags.map((tag) => [tag.id, tag]));
		this.allowedTags = (this.allowedTags || []).map((tag) => {
			const saved = snapshotTags.get(tag.id);
			return saved ? { ...tag, selected: true, ctrls: saved.ctrls } : tag;
		});

		const currentIds = new Set((this.state.elements || []).map((el) => el.id));
		const restoredElements = snapshot.elements.filter((el) => !currentIds.has(el.id));
		if (restoredElements.length) {
			const order = new Map(this.allowedTags.map((tag, index) => [tag.id, index]));
			this.state.elements = [...(this.state.elements || []), ...restoredElements].sort(
				(a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
			);
		}

		Object.entries(snapshot.areas).forEach(([layoutName, byIndex]) => {
			Object.entries(byIndex).forEach(([index, areas]) => {
				const resolutionState = this.state.resolutionStates?.[layoutName]?.[Number(index)];
				Object.entries(areas).forEach(([areaId, area]) => {
					this.placeAreaInResolutionState(resolutionState, areaId, area);
				});
			});
		});

		const currentState = this.getResolutionState(this.state.currentResolutionIndex);
		if (currentState) this.applyResolutionState(currentState);
		this.refreshFinishedStates();
	},

	// Deselects excluded tags and removes them from every resolution state.
	applyBuyOnBannerExclusions() {
		if (!this.buyOnBannerMode) return;

		const excludedIds = new Set(
			(this.allowedTags || [])
				.filter((tag) => this.isTagExcludedByBuyMode(tag))
				.map((tag) => tag.id),
		);
		if (!excludedIds.size) return;

		this.buyModeSnapshot = this.captureExcludedSnapshot(excludedIds);

		this.allowedTags = this.allowedTags.map((tag) => {
			if (!excludedIds.has(tag.id) || !tag.selected) return tag;
			return {
				...tag,
				selected: false,
				ctrls: (tag.ctrls || []).map((ctrl) => ({ ...ctrl, selected: false })),
			};
		});

		const elements = this.state.elements || [];
		const hadExcludedElements = elements.some((el) => excludedIds.has(el.id));
		if (!hadExcludedElements) return;

		this.state.elements = elements.filter((el) => !excludedIds.has(el.id));
		this.syncStateWithTags();
	},

	handleBuyModeChange() {
		const nextMode = Boolean(this.buyOnBannerRadio?.checked);
		if (nextMode === this.buyOnBannerMode) return;

		// Keep unsaved picks from the panel so the re-render doesn't drop them.
		if (!this.tagSelectionLocked) {
			this.allowedTags = this.collectTagSelectionFromPanel();
		}

		this.buyOnBannerMode = nextMode;
		if (nextMode) {
			this.applyBuyOnBannerExclusions();
		} else {
			this.restoreExcludedSnapshot();
		}
		this.refreshWorkspaceView();
	},
});
