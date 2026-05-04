class GridDesigner {
	constructor(editorCardId, resolutions = {}, tags = [], state = {}) {
		if (!editorCardId) return;

		this.containerElement = document;
		this.editorCardId = editorCardId;
		this.rootSelector = `#${GridDesigner.sanitizeId(this.editorCardId)}`;

		this.state = {
			rows: 4,
			cols: 24,
			areas: {},
			rowHeights: Array(4).fill("1fr"),
			gridMatrix: [],
			resolutionStates: [],
			elements: [],
			currentResolutionIndex: 0,
		};
		this.resolutions = resolutions;
		this.state.currentPageWidth = Object.keys(resolutions)[0];
		this.currentResolution = null;
		this.sortedscreenWidths = [];
		this.gridWidth = 1536;
		this.gridHeight = 864;
		this.savedPatterns = {};
		this.areaColors = {};
		this.resizeState = null;
		this.editorReady = false;
		this.allowedTags = [];
		this.tagSelectionLocked = false;

		this.cacheDomElements();
		this.init(editorCardId, resolutions, tags, state);
	}

	cacheDomElements() {
		this.grid = this.q("grid");
		this.colCountInput = this.q("colCount");
		this.rowCountInput = this.q("rowCount");
		this.buildGridButton = this.q("buildGrid");
		this.clearGridButton = this.q("clearGrid");
		this.exportCssButton = this.q("exportCss");
		this.exportJsonButton = this.q("exportJson");
		this.savePatternButton = this.q("savePattern");
		this.deletePatternButton = this.q("deletePattern");
		this.loadDesignButton = this.q("loadDesign");
		this.importStateInput = this.q("importState");
		this.cssCode = this.q("cssCode");
		this.elementList = this.q("elementList");
		this.gridWrapper = this.q("gridWrapper");
		this.resolutionTabs = this.q("resolutionTabs");
		this.rowControls = this.q("controlsContainer");
		this.mainMaxWidthSelect = this.q("mainMaxWidth");
		this.tagSelectionPanel = this.q("tagSelectionPanel");
		this.tagSelectorList = this.q("tagSelectorList");
		this.tagSelectorMeta = this.q("tagSelectorMeta");
		this.tagSelectorDetails = this.q("tagSelectorDetails");
	}

	q(id) {
		return this.containerElement.querySelector(`#${id}`);
	}

	static sanitizeId(raw) {
		return String(raw || "")
			.trim()
			.toLowerCase()
			.replace(/\s+/g, "_")
			.replace(/[^a-z0-9_\-]/g, "");
	}

	static normalizeResolution(res) {
		const width = Number(res?.width) || 0;
		const height = Number(res?.height) || 0;
		return {
			width,
			height,
			label: res?.label || res?.name || `${width}x${height}`,
		};
	}

	static normalizeResolutions(resolutions) {
		if (!resolutions || typeof resolutions !== "object") {
			console.warn("Invalid resolutions format. Expected an object.");
			return {};
		}

		const normalized = {};

		Object.keys(resolutions).forEach((pageWidth) => {
			const bannerSizes = resolutions[pageWidth];

			if (Array.isArray(bannerSizes)) {
				const validBanners = bannerSizes
					.map((res) => this.normalizeResolution(res))
					.filter((res) => res.width > 0 && res.height > 0)
					.sort((a, b) => b.width - a.width || b.height - a.height);

				if (validBanners.length > 0) {
					normalized[pageWidth] = validBanners;
				}
			}
		});

		return normalized;
	}

	static normalizeTag(tag, index) {
		if (tag && typeof tag === "object") {
			const name = String(tag.name || tag.label || tag.id || `Tag ${index + 1}`);
			const controlType = tag.controlType === "radio" ? "radio" : "checkbox";
			const ctrls = Array.isArray(tag.ctrls)
				? tag.ctrls
						.map((ctrl, ctrlIndex) => GridDesigner.normalizeTagControl(ctrl, name, ctrlIndex))
						.filter(Boolean)
				: [];

			if (controlType === "radio" && ctrls.length && !ctrls.some((ctrl) => ctrl.selected)) {
				ctrls[0].selected = true;
			}

			return {
				id: GridDesigner.sanitizeId(tag.id || name) || `tag_${index + 1}`,
				name,
				selected: GridDesigner.normalizeBoolean(tag.selected, true),
				controlType,
				ctrls,
			};
		}
		return null;
	}

	static normalizeTagControl(ctrl, tagName, index) {
		if (!ctrl || typeof ctrl !== "object") return null;
		const name = String(ctrl.name || ctrl.label || `Option ${index + 1}`);
		return {
			id: GridDesigner.sanitizeId(ctrl.id || `${tagName}-${name}`) || `ctrl_${index + 1}`,
			name,
			selected: GridDesigner.normalizeBoolean(ctrl.selected, false),
		};
	}

	static normalizeBoolean(value, fallback = false) {
		if (typeof value === "boolean") return value;
		if (typeof value === "string") {
			const lowered = value.trim().toLowerCase();
			if (lowered === "true") return true;
			if (lowered === "false") return false;
		}
		return fallback;
	}

	static normalizeTags(tags) {
		if (!Array.isArray(tags)) return [];
		return tags.map((tag, index) => GridDesigner.normalizeTag(tag, index)).filter(Boolean);
	}

	applySelectedTags() {
		this.state.elements = this.allowedTags
			.filter((tag) => tag.selected)
			.map((tag) => ({
				id: tag.id,
				name: tag.name,
				controlType: tag.controlType,
				ctrls: (tag.ctrls || [])
					.filter((ctrl) => ctrl.selected)
					.map((ctrl) => ({ id: ctrl.id, name: ctrl.name, selected: true })),
			}));
	}

	mergeAllowedTagsWithStateElements(elements = []) {
		if (!this.allowedTags.length) return;
		if (!Array.isArray(elements) || !elements.length) {
			this.applySelectedTags();
			return;
		}

		const selectedTagIds = new Set(
			elements.map((el) => GridDesigner.sanitizeId(el?.id || el?.name || "")).filter(Boolean),
		);

		const selectedControlsByTag = new Map();
		elements.forEach((el) => {
			const tagId = GridDesigner.sanitizeId(el?.id || el?.name || "");
			if (!tagId) return;
			const ctrls = Array.isArray(el?.ctrls) ? el.ctrls : [];
			const selectedControlIds = ctrls
				.filter((ctrl) => GridDesigner.normalizeBoolean(ctrl?.selected, true))
				.map((ctrl) => GridDesigner.sanitizeId(ctrl?.id || ctrl?.name || ""))
				.filter(Boolean);
			selectedControlsByTag.set(tagId, new Set(selectedControlIds));
		});

		this.allowedTags = this.allowedTags.map((tag) => {
			const selected = selectedTagIds.has(tag.id);
			const selectedCtrlIds = selectedControlsByTag.get(tag.id);
			let ctrls = (tag.ctrls || []).map((ctrl) => ({
				...ctrl,
				selected: selectedCtrlIds ? selectedCtrlIds.has(ctrl.id) : ctrl.selected,
			}));

			if (tag.controlType === "radio" && ctrls.length && !ctrls.some((ctrl) => ctrl.selected)) {
				ctrls = ctrls.map((ctrl, index) => ({ ...ctrl, selected: index === 0 }));
			}

			return {
				...tag,
				selected,
				ctrls,
			};
		});

		this.applySelectedTags();
	}

	init(editorCardId, resolutions = {}, tags = [], state = {}) {
		this.editorCardId = String(editorCardId != null ? editorCardId : this.editorCardId);
		this.resolutions = GridDesigner.normalizeResolutions(resolutions);
		this.allowedTags = GridDesigner.normalizeTags(tags);
		if (this.allowedTags.length) {
			this.applySelectedTags();
		}

		this.loadEditorState(state);
		this.populatePageWidthSelect();
		this.initializeMatrixFromState();
		this.createResolutionTabs();
		this.attachEditorListeners();
		this.renderTagSelectionPanel();

		const pageWidth = this.state.currentPageWidth || Object.keys(this.resolutions)[0];

		const defaultResolution =
			this.resolutions[pageWidth]?.[this.state.currentResolutionIndex] ||
			this.resolutions[pageWidth]?.[0];

		if (defaultResolution) {
			this.setCurrentResolution(defaultResolution);
		} else {
			this.currentResolution = { width: 1536, height: 864 };
			this.calculateGridDimensions();
			this.activateFirstResolutionTab();
			this.renderGrid();
			this.renderElementList();
			this.renderRowControls();
			this.updateCssPreview();
		}
	}
}
