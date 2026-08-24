class GridDesigner {
	constructor(editorCardId, layoutDefinitions = {}, tags = [], state = {}) {
		if (!editorCardId) return;

		this.containerElement = document;
		this.editorCardId = editorCardId;
		this.rootSelector = `#${String(this.editorCardId)}`;

		this.state = {
			rows: 4,
			cols: 12,
			justifyContent: "center",
			alignItems: "center",
			areas: {},
			rowHeights: Array(4).fill("1fr"),
			colWidths: Array(12).fill("1fr"),
			gridMatrix: [],
			resolutionStates: [],
			elements: [],
			currentResolutionIndex: 0,
			currentLayoutName: "",
		};
		this.layoutDefinitions = {};
		this.layoutOrder = [];
		this.resolutions = {};
		this.currentResolution = null;
		this.gridWidth = 1536;
		this.gridHeight = 864;
		this.savedPatterns = {};
		this.areaColors = {};
		this.resizeState = null;
		this.editorReady = false;
		this.allowedTags = [];
		this.tagSelectionLocked = false;

		this.cacheDomElements();
		this.init(editorCardId, layoutDefinitions, tags, state);
	}

	cacheDomElements() {
		this.grid = this.q("grid");
		this.colCountInput = this.q("colCount");
		this.rowCountInput = this.q("rowCount");
		this.justifyContentSelect = this.q("justifyContent");
		this.justifyContentRadios = Array.from(
			this.containerElement.querySelectorAll('input[name="justifyContent"]'),
		);
		this.alignItemsSelect = this.q("alignItems");
		this.alignItemsRadios = Array.from(
			this.containerElement.querySelectorAll('input[name="alignItems"]'),
		);
		this.buildGridButton = this.q("buildGrid");
		this.clearGridButton = this.q("clearGrid");
		this.exportCssButton = this.q("exportCss");
		this.exportJsonButton = this.q("exportJson");
		this.loadDesignButton = this.q("loadDesign");
		this.importStateInput = this.q("importState");
		this.cssCode = this.q("cssCode");
		this.elementList = this.q("elementList");
		this.elementListItems = this.q("elementListItems");
		this.unfinishedDesignNotice = this.q("unfinishedDesignNotice");
		this.gridWrapper = this.q("gridWrapper");
		this.resolutionTabs = this.q("resolutionTabs");
		this.mainMaxWidthSelect = this.q("mainMaxWidth");
		this.tagSelectionPanel = this.q("tagSelectionPanel");
		this.tagSelectorList = this.q("tagSelectorList");
		this.tagSelectorMeta = this.q("tagSelectorMeta");
		this.tagSelectorDetails = this.q("tagSelectorDetails");
	}

	q(id) {
		return this.containerElement.querySelector(`#${id}`);
	}

	bindJustifyContentControlChange(handler) {
		if (this.justifyContentSelect) {
			this.justifyContentSelect.addEventListener("change", handler);
		}
		this.justifyContentRadios.forEach((radio) => {
			radio.addEventListener("change", handler);
		});
	}

	getJustifyContentControlValue() {
		if (this.justifyContentSelect) return this.justifyContentSelect.value;
		const checkedRadio = this.justifyContentRadios.find((radio) => radio.checked);
		return checkedRadio?.value || "center";
	}

	setJustifyContentControlValue(value) {
		if (this.justifyContentSelect) {
			this.justifyContentSelect.value = value;
			return;
		}
		const targetRadio = this.justifyContentRadios.find((radio) => radio.value === value);
		if (targetRadio) targetRadio.checked = true;
	}

	bindAlignItemsControlChange(handler) {
		if (this.alignItemsSelect) {
			this.alignItemsSelect.addEventListener("change", handler);
		}
		this.alignItemsRadios.forEach((radio) => {
			radio.addEventListener("change", handler);
		});
	}

	getAlignItemsControlValue() {
		if (this.alignItemsSelect) return this.alignItemsSelect.value;
		const checkedRadio = this.alignItemsRadios.find((radio) => radio.checked);
		return checkedRadio?.value || "center";
	}

	setAlignItemsControlValue(value) {
		if (this.alignItemsSelect) {
			this.alignItemsSelect.value = value;
			return;
		}
		const targetRadio = this.alignItemsRadios.find((radio) => radio.value === value);
		if (targetRadio) targetRadio.checked = true;
	}

	static cloneData(value, fallback = null) {
		if (value == null) return fallback;
		return JSON.parse(JSON.stringify(value));
	}

	static normalizeResolution(res) {
		if (!res || typeof res !== "object") return null;
		const width = Number(res.width);
		const height = Number(res.height);
		if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
		return {
			...res,
			width,
			height,
		};
	}

	static normalizeLayoutDefinitions(layoutDefinitions) {
		if (!layoutDefinitions || typeof layoutDefinitions !== "object") {
			console.warn("Invalid layoutDefinitions format. Expected an object.");
			return { layoutDefinitions: {}, resolutions: {}, layoutOrder: [] };
		}

		const normalizedDefinitions = {};
		const normalizedResolutions = {};

		for (const [layoutName, definition] of Object.entries(layoutDefinitions)) {
			if (!definition || typeof definition !== "object") continue;

			const sizes = Array.isArray(definition.sizes)
				? definition.sizes
						.map((res) => GridDesigner.normalizeResolution(res))
						.filter(Boolean)
				: [];

			if (!sizes.length) continue;

			const layoutWidth = Number(definition.width);
			normalizedDefinitions[layoutName] = {
				...definition,
				width: Number.isFinite(layoutWidth) ? layoutWidth : sizes[0].width,
				sizes,
			};
			normalizedResolutions[layoutName] = sizes;
		}

		const layoutOrder = Object.keys(normalizedDefinitions);

		return {
			layoutDefinitions: normalizedDefinitions,
			resolutions: normalizedResolutions,
			layoutOrder,
		};
	}

	static normalizeTag(tag, index) {
		if (tag && typeof tag === "object") {
			const name =
				tag.name != null
					? String(tag.name)
					: tag.label != null
						? String(tag.label)
						: tag.id != null
							? String(tag.id)
							: `Tag ${index + 1}`;
			const controlType = tag.controlType === "radio" ? "radio" : "checkbox";
			const gridArea = tag.gridArea != null ? String(tag.gridArea) : "";
			const groupClass = tag.groupClass != null ? String(tag.groupClass) : "";
			const ctrls = Array.isArray(tag.ctrls)
				? tag.ctrls
						.map((ctrl, ctrlIndex) =>
							GridDesigner.normalizeTagControl(ctrl, name, ctrlIndex),
						)
						.filter(Boolean)
				: [];

			const selected =
				tag.selected != null
					? GridDesigner.normalizeBoolean(tag.selected, false)
					: ctrls.some((ctrl) => ctrl.selected);

			return {
				id: String(tag.id ?? name ?? `tag_${index + 1}`),
				name,
				gridArea,
				groupClass,
				selected,
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
			id: String(ctrl.id ?? `${tagName}-${name}` ?? `ctrl_${index + 1}`),
			name,
			class: ctrl.class != null ? String(ctrl.class) : "",
			tag: String(ctrl.tag || ""),
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
		const flattenedTags = tags.flatMap((item) => (Array.isArray(item) ? item : [item]));
		return flattenedTags
			.map((tag, index) => GridDesigner.normalizeTag(tag, index))
			.filter(Boolean);
	}

	getElementDisplayName(tag) {
		const ctrls = Array.isArray(tag?.ctrls) ? tag.ctrls : [];
		if (!ctrls.length) return tag?.name || "";

		const selectedCtrls = ctrls.filter((ctrl) => ctrl?.selected);
		if (!selectedCtrls.length) return tag?.name || "";

		if (tag?.controlType === "radio") {
			return selectedCtrls[0].name || tag?.name || "";
		}

		return selectedCtrls.map((ctrl) => ctrl.name).join(", ") || tag?.name || "";
	}

	buildSelectedElements(tags = []) {
		return tags
			.filter((tag) => tag.selected)
			.map((tag) => ({
				id: tag.id,
				name: this.getElementDisplayName(tag),
				gridArea: tag.gridArea,
				groupClass: tag.groupClass,
				controlType: tag.controlType,
				ctrls: (tag.ctrls || []).map((ctrl) => ({
					id: ctrl.id,
					name: ctrl.name,
					class: ctrl.class,
					selected: ctrl.selected,
				})),
			}));
	}

	applySelectedTags() {
		this.state.elements = this.buildSelectedElements(this.allowedTags);
	}

	mergeAllowedTagsWithStateElements(elements = []) {
		if (!this.allowedTags.length) return;
		if (!Array.isArray(elements) || !elements.length) {
			this.applySelectedTags();
			return;
		}

		const selectedTagIds = new Set(
			elements.map((el) => String(el?.id || el?.name || "").toLowerCase()).filter(Boolean),
		);

		const selectedControlsByTag = new Map();
		elements.forEach((el) => {
			const tagId = String(el?.id || el?.name || "").toLowerCase();
			if (!tagId) return;
			const ctrls = Array.isArray(el?.ctrls) ? el.ctrls : [];
			const selectedControlIds = ctrls
				.filter((ctrl) => GridDesigner.normalizeBoolean(ctrl?.selected, true))
				.map((ctrl) => String(ctrl?.id || ctrl?.name || "").toLowerCase())
				.filter(Boolean);
			selectedControlsByTag.set(tagId, new Set(selectedControlIds));
		});

		this.allowedTags = this.allowedTags.map((tag) => {
			const selected = selectedTagIds.has(tag.id.toLowerCase());
			const selectedCtrlIds = selectedControlsByTag.get(tag.id.toLowerCase());
			const hasExplicitSelectedCtrls = Boolean(selectedCtrlIds && selectedCtrlIds.size);
			const isSingleCtrl = (tag.ctrls || []).length <= 1;
			let ctrls = (tag.ctrls || []).map((ctrl) => ({
				...ctrl,
				selected: hasExplicitSelectedCtrls
					? selectedCtrlIds.has(ctrl.id.toLowerCase())
					: selected && isSingleCtrl
						? true
						: ctrl.selected,
			}));

			if (
				selected &&
				tag.controlType === "checkbox" &&
				!isSingleCtrl &&
				!hasExplicitSelectedCtrls &&
				ctrls.length
			) {
				ctrls = ctrls.map((ctrl, index) => ({ ...ctrl, selected: index === 0 }));
			}

			if (
				tag.controlType === "radio" &&
				selected &&
				ctrls.length &&
				!ctrls.some((ctrl) => ctrl.selected)
			) {
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

	init(editorCardId, layoutDefinitions = {}, tags = [], state = {}) {
		this.editorCardId = String(editorCardId != null ? editorCardId : this.editorCardId);
		const normalizedLayouts = GridDesigner.normalizeLayoutDefinitions(layoutDefinitions);
		this.layoutDefinitions = normalizedLayouts.layoutDefinitions;
		this.layoutOrder = normalizedLayouts.layoutOrder;
		this.resolutions = normalizedLayouts.resolutions;
		this.state.currentLayoutName = this.layoutOrder[0] || "";
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

		const layoutName = this.state.currentLayoutName || Object.keys(this.resolutions)[0];

		const defaultResolution =
			this.resolutions[layoutName]?.[this.state.currentResolutionIndex] ||
			this.resolutions[layoutName]?.[0];

		if (defaultResolution) {
			this.setCurrentResolution(defaultResolution, true);
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
