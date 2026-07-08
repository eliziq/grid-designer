Object.assign(GridDesigner.prototype, {
	getAreaLayoutConfig(area, fallbackState = this.state) {
		const source = area && typeof area === "object" ? area : {};
		const fallback = fallbackState && typeof fallbackState === "object" ? fallbackState : {};

		return {
			justifyContent: source.justifyContent ?? fallback.justifyContent ?? "center",
			alignItems: source.alignItems ?? fallback.alignItems ?? "center",
		};
	},

	getGlobalAreaLayoutValue(fieldName) {
		if (fieldName === "justifyContent") {
			return this.state?.justifyContent || "center";
		}
		if (fieldName === "alignItems") {
			return this.state?.alignItems || "center";
		}
		return "center";
	},

	areaHasOwnProperty(area, key) {
		return Object.prototype.hasOwnProperty.call(area || {}, key);
	},

	createAreaLayoutControls(area) {
		const config = this.getAreaLayoutConfig(area);
		const areaId = String(area?.id || "");

		const controls = new GridDesignerAreaLayoutControls(areaId, config).toElement();
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
		const selector = `.area-layout-controls__panel[data-area-id="${String(areaId)}"]`;
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
			if (nextValue === this.getGlobalAreaLayoutValue("justifyContent")) {
				delete area.justifyContent;
			} else {
				area.justifyContent = nextValue;
			}
		} else if (field === "alignItems") {
			const nextValue = target.value;
			if (nextValue === this.getGlobalAreaLayoutValue("alignItems")) {
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
