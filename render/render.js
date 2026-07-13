GridDesigner.generateAreaColor = function (id) {
	const hue = (Array.from(String(id)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) * 7) % 360;
	return `hsl(${hue}, 70%, 60%)`;
};

Object.assign(GridDesigner.prototype, {
	normalizePreviewAlignment(value) {
		const raw = String(value || "").trim();
		if (raw === "start") return "flex-start";
		if (raw === "end") return "flex-end";
		return "center";
	},

	applyGridAlignmentPreview() {
		if (!this.grid) return;
		const justify = this.normalizePreviewAlignment(this.state.justifyContent);
		const align = this.normalizePreviewAlignment(this.state.alignItems);
		this.grid.style.setProperty("--area-preview-justify", justify);
		this.grid.style.setProperty("--area-preview-align", align);
	},

	applyGridBaseStyles() {
		if (!this.grid) return;
		this.grid.style.aspectRatio = `${this.gridWidth} / ${this.gridHeight}`;
		this.grid.style.minHeight = "auto";
		this.applyGridAlignmentPreview();
		this.updateGridScaling();
	},

	getGridTemplateRows() {
		return Array.from({ length: this.state.rows }, (_, rowIndex) => {
			const rowHeight = this.state.rowHeights[rowIndex] || "1fr";
			return rowHeight === "max-content" ? "minmax(46px, max-content)" : "minmax(60px, 1fr)";
		}).join(" ");
	},

	refreshGridView() {
		this.renderGrid();
		this.renderRowControls();
		this.renderElementList();
		this.renderTagSelectionPanel();
		this.updateCssPreview();
	},

	refreshWorkspaceView() {
		this.renderGrid();
		this.renderElementList();
		this.renderRowControls();
		this.renderTagSelectionPanel();
		this.updateCssPreview();
	},

	refreshResolutionUi() {
		this.refreshWorkspaceView();
		this.updateResolutionTabState();
		this.renderTagSelectionPanel();
	},

	renderGrid() {
		if (!this.grid?.isConnected || !this.gridWrapper?.isConnected) this.cacheDomElements();
		if (!this.grid) return;

		this.grid.innerHTML = "";
		this.applyGridBaseStyles();
		const gridTemplateColumns = `repeat(${this.state.cols}, 1fr)`;
		const gridTemplateRows = this.getGridTemplateRows();
		const cellLayer = document.createElement("div");
		cellLayer.className = "grid-layer grid-layer--cells";
		cellLayer.style.gridTemplateColumns = gridTemplateColumns;
		cellLayer.style.gridTemplateRows = gridTemplateRows;
		const overlayLayer = document.createElement("div");
		overlayLayer.className = "grid-layer grid-layer--areas";
		overlayLayer.style.gridTemplateColumns = gridTemplateColumns;
		overlayLayer.style.gridTemplateRows = gridTemplateRows;
		overlayLayer.setAttribute("aria-hidden", "true");
		for (let r = 0; r < this.state.rows; r++) {
			for (let c = 0; c < this.state.cols; c++) {
				const cell = document.createElement("div");
				cell.className = "cell";
				cell.dataset.row = r;
				cell.dataset.col = c;
				cell.draggable = false;
				cell.addEventListener("dragover", (e) => e.preventDefault());
				cell.addEventListener("drop", this.handleDrop.bind(this));
				cellLayer.appendChild(cell);
			}
		}
		this.grid.appendChild(cellLayer);
		this.grid.appendChild(overlayLayer);
		this.renderAreas(overlayLayer);
		this.renderRowControls();
		const lateReapply = () => {
			if (!this.grid?.isConnected || !this.gridWrapper?.isConnected) this.cacheDomElements();
			this.applyGridBaseStyles();
			const layers = this.grid?.querySelectorAll(".grid-layer");
			if (layers?.length) {
				layers.forEach((layer) => {
					layer.style.gridTemplateColumns = gridTemplateColumns;
					layer.style.gridTemplateRows = gridTemplateRows;
				});
			}
			this.applyGridAlignmentPreview();
		};
		window.setTimeout(lateReapply, 120);
	},

	renderAreas(overlayLayer = null) {
		const host = overlayLayer || this.grid;
		if (!host) return;

		Object.values(this.state.areas).forEach((area) => {
			const element = this.state.elements.find((el) => el.id === area.id);
			const color =
				this.areaColors[area.id] ||
				(this.areaColors[area.id] = GridDesigner.generateAreaColor(area.id));

			const block = new AreaBlockComponent({
				area,
				displayName: element ? element.name : area.id,
				color,
				onLabelInput: (areaId, value) => {
					this.handleAreaLabelInput(areaId, value);
				},
				onRemove: (areaId) => {
					this.handleRemoveTagFromGrid(areaId);
				},
				onPointerDown: this.handleAreaPointerDown.bind(this),
				resolveEdge: (event, blockEl) => this.isEdgePosition(event, blockEl),
				onDrop: this.handleDrop.bind(this),
				createControlsElement: (sourceArea) => this.createAreaLayoutControls(sourceArea),
			}).toElement();

			if (!block) return;

			this.applyAreaLayoutPreviewStyles(block, area);
			host.appendChild(block);
		});
	},

	renderRowControls() {
		if (!this.grid) return;

		const existingLayer = this.grid.querySelector(".grid-layer--row-heights");
		if (existingLayer) existingLayer.remove();

		const gridTemplateColumns = `repeat(${this.state.cols}, 1fr)`;
		const gridTemplateRows = this.getGridTemplateRows();

		const layer = document.createElement("div");
		layer.className = "grid-layer grid-layer--row-heights";
		layer.style.gridTemplateColumns = gridTemplateColumns;
		layer.style.gridTemplateRows = gridTemplateRows;

		for (let i = 0; i < this.state.rows; i++) {
			const cell = document.createElement("div");
			cell.className = "row-height-cell";
			cell.style.gridRow = String(i + 1);
			cell.style.gridColumn = "1 / -1";

			const currentValue = this.state.rowHeights[i] || "1fr";
			const isMax = currentValue === "max-content";

			const btn = document.createElement("span");
			btn.className = "row-height-btn" + (isMax ? " row-height-btn--max" : "");
			btn.dataset.rowIndex = String(i);
			btn.textContent = isMax ? "max-c" : "1fr";
			btn.title = isMax
				? "Row height: max-content — click to set 1fr"
				: "Row height: 1fr — click to set max-content";

			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				const rowIndex = parseInt(btn.dataset.rowIndex, 10);
				this.state.rowHeights[rowIndex] =
					this.state.rowHeights[rowIndex] === "max-content" ? "1fr" : "max-content";
				this.refreshGridView();
			});

			cell.appendChild(btn);
			layer.appendChild(cell);
		}

		this.grid.appendChild(layer);
	},

	renderElementList() {
		if (!this.elementList) return;
		this.elementList.innerHTML = "";

		const requiredElementIds = new Set(
			(this.state.elements || []).map((element) => element.id),
		);
		const placedAreaIds = new Set(Object.keys(this.state.areas || {}));
		const hasUnplacedSelectedElements = [...requiredElementIds].some(
			(id) => !placedAreaIds.has(id),
		);

		if (this.unfinishedDesignNotice) {
			this.unfinishedDesignNotice.hidden =
				requiredElementIds.size === 0 || !hasUnplacedSelectedElements;
		}

		const placedIds = new Set(Object.keys(this.state.areas || {}));

		const fragment = document.createDocumentFragment();

		this.state.elements.forEach((element) => {
			const isPlaced = placedIds.has(element.id);

			if (!this.areaColors[element.id]) {
				this.areaColors[element.id] = GridDesigner.generateAreaColor(element.id);
			}

			const tag = new TagComponent({
				id: element.id,
				name: element.name,
				color: this.areaColors[element.id],
				isPlaced,
				onDragStart: (e) => {
					e.dataTransfer.setData("text/plain", element.id);
				},
			}).toElement();

			if (tag) {
				fragment.appendChild(tag);
			}
		});

		this.elementList.appendChild(fragment);
	},

	updateGridScaling() {
		if (!this.gridWrapper) return;
		const ratio = this.gridHeight > 0 ? this.gridWidth / this.gridHeight : 16 / 9;
		this.gridWrapper.style.setProperty("--grid-aspect-ratio", String(ratio));
		this.gridWrapper.style.setProperty("--grid-margin", "0px");
		this.gridWrapper.style.setProperty("--grid-margin-top", "0px");
	},

	calculateGridDimensions() {
		this.gridWidth = this.currentResolution?.width || 1536;
		this.gridHeight = this.currentResolution?.height || 864;
	},
});
