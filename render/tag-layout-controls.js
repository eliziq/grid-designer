Object.assign(GridDesigner.prototype, {
	isHeaderPresetEnabled(areaId) {
		const targetAreaId = "Event_TeamName";
		if (String(areaId || "") !== targetAreaId) {
			return false;
		}

		const areaEntry =
			(this.allowedTags || []).find((tag) => tag?.id === targetAreaId) ||
			(this.state.elements || []).find((element) => element?.id === targetAreaId);
		if (!Array.isArray(areaEntry?.ctrls)) {
			return false;
		}

		return true;

		//check the inner tags of the area to determine if the preset should be enabled

		// const selectedTags = new Set(
		// 	areaEntry.ctrls
		// 		.filter((ctrl) => ctrl?.selected && ctrl?.tag)
		// 		.map((ctrl) => ctrl.tag)
		// );

		// return selectedTags.has("TicketTags_TeamsLogo") && selectedTags.has("TeamsLogo");
	},

	setAreaHeaderPreset(areaId, preset) {
		const areaKey = String(areaId || "");
		const area = this.state.areas?.[areaKey];
		if (!area) return;

		const nextPreset = preset || "preset1";
		if (area.headerPreset === nextPreset) return;

		area.headerPreset = nextPreset;
		this.refreshGridView();
	},

	getAreaLayoutConfig(area) {
		const source = area && typeof area === "object" ? area : {};

		return {
			justifyContent: source.justifyContent,
			alignItems: source.alignItems,
		};
	},

	areaHasOwnProperty(area, key) {
		return Object.prototype.hasOwnProperty.call(area || {}, key);
	},

	createAreaLayoutControls(area) {
		const config = this.getAreaLayoutConfig(area);
		const areaId = String(area?.id || "");
		const isPresetEnabled = this.isHeaderPresetEnabled(areaId);
		const headerPreset = isPresetEnabled ? area?.headerPreset || "preset1" : null;

		const controls = new AreaControlsComponent(areaId, {
			...config,
			headerPreset,
			enableHeaderPreset: isPresetEnabled,
		}).toElement();
		return controls || document.createElement("div");
	},

	applyAreaLayoutPreviewStyles(block, area) {
		if (!block) return;
		const config = this.getAreaLayoutConfig(area);
		const hasJustifyOverride = this.areaHasOwnProperty(area, "justifyContent");
		const hasAlignOverride = this.areaHasOwnProperty(area, "alignItems");
		block.style.justifyContent = hasJustifyOverride
			? this.normalizePreviewAlignment(config.justifyContent)
			: "var(--area-preview-justify)";
		block.style.alignItems = hasAlignOverride
			? this.normalizePreviewAlignment(config.alignItems)
			: "var(--area-preview-align)";
	},

	toggleAreaLayoutPanel(areaId) {
		if (!this.grid) return;
		const selector = `.area-layout-controls__panel[data-area-layout-panel='1'][data-area-id="${String(areaId)}"]`;
		const targetPanel = this.grid.querySelector(selector);
		if (!targetPanel) return;

		const shouldOpen = targetPanel.hidden;
		this.closeAreaLayoutPanels();
		if (shouldOpen) this.syncAreaLayoutControls(areaId);
		targetPanel.hidden = !shouldOpen;
		targetPanel
			.closest(".area-layout-controls")
			?.classList.toggle("area-layout-controls--open", shouldOpen);
	},

	toggleAreaPresetPanel(areaId) {
		if (!this.grid) return;
		const selector = `.area-layout-controls__preset-panel[data-area-id="${String(areaId)}"]`;
		const targetPanel = this.grid.querySelector(selector);
		if (!targetPanel) return;

		const shouldOpen = targetPanel.hidden;
		this.closeAreaLayoutPanels();
		targetPanel.hidden = !shouldOpen;
		targetPanel
			.closest(".area-layout-controls")
			?.classList.toggle("area-layout-controls--open", shouldOpen);
	},

	syncAreaLayoutControls(areaId = null) {
		const scope = this.grid || this.containerElement;
		if (!scope) return;
		const areaSelector = areaId
			? `.area-layout-controls__panel[data-area-id="${String(areaId)}"]`
			: ".area-layout-controls__panel";

		scope.querySelectorAll(areaSelector).forEach((panel) => {
			const currentAreaId = String(panel.dataset.areaId || "");
			const area = this.state.areas?.[currentAreaId];
			if (!area) return;
			const config = this.getAreaLayoutConfig(area);

			["justifyContent", "alignItems"].forEach((field) => {
				const value = config[field];
				panel.querySelectorAll(`input[data-layout-field="${field}"]`).forEach((input) => {
					if (input instanceof HTMLInputElement) {
						input.checked = input.value === value;
					}
				});
			});
		});
	},

	closeAreaLayoutPanels() {
		if (!this.grid) return;
		this.grid.querySelectorAll(".area-layout-controls__panel").forEach((panel) => {
			panel.hidden = true;
			panel.closest(".area-layout-controls")?.classList.remove("area-layout-controls--open");
		});
	},

	handleAreaLayoutControlClick(event) {
		const target = event.target;
		if (!(target instanceof Element)) return;

		const presetToggle = target.closest("[data-header-preset-toggle='1']");
		if (presetToggle) {
			event.preventDefault();
			event.stopPropagation();
			const areaId = presetToggle.dataset.areaId;
			if (areaId) this.toggleAreaPresetPanel(areaId);
			return;
		}

		const presetButton = target.closest("button[data-header-preset]");
		if (presetButton) {
			event.preventDefault();
			event.stopPropagation();
			const areaId = presetButton.dataset.areaId;
			const preset = presetButton.dataset.headerPreset;
			if (areaId && preset) {
				this.setAreaHeaderPreset(areaId, preset);
			}
			return;
		}

		const toggle = target.closest("[data-area-layout-toggle='1']");
		if (toggle) {
			event.preventDefault();
			event.stopPropagation();
			const areaId = toggle.dataset.areaId;
			if (areaId) this.toggleAreaLayoutPanel(areaId);
			return;
		}

		if (!target.closest(".area-layout-controls")) {
			this.closeAreaLayoutPanels();
		}
	},

	handleAreaLayoutControlChange(event) {
		const target = event.target;
		if (!(target instanceof HTMLInputElement)) return;
		if (!target.matches("input[data-area-layout-control='1']")) return;

		const areaId = String(target.dataset.areaId || "");
		const field = String(target.dataset.layoutField || "");
		const area = this.state.areas?.[areaId];
		if (!area) return;

		if (field === "justifyContent") {
			const nextValue = target.value;
			if (nextValue === "__unset__") {
				delete area.justifyContent;
			} else {
				area.justifyContent = nextValue;
			}
		} else if (field === "alignItems") {
			const nextValue = target.value;
			if (nextValue === "__unset__") {
				delete area.alignItems;
			} else {
				area.alignItems = nextValue;
			}
		} else {
			return;
		}

		this.refreshGridView();
	},
});
