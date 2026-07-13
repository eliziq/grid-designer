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
			const block = document.createElement("div");
			block.className = "area-block";
			block.draggable = false;
			block.dataset.areaId = area.id;
			block.style.gridColumn = `${area.colStart + 1} / ${area.colEnd + 2}`;
			block.style.gridRow = `${area.rowStart + 1} / ${area.rowEnd + 2}`;
			const color =
				this.areaColors[area.id] ||
				(this.areaColors[area.id] = GridDesigner.generateAreaColor(area.id));
			block.style.borderColor = color;
			block.style.background = "hsl(220 20% 76% / 0.16)";
			block.style.boxShadow = `0 0 0 1px ${color}`;
			this.applyAreaLayoutPreviewStyles(block, area);

			const label = document.createElement("span");
			label.className = "area-block__label";
			label.setAttribute("contenteditable", "true");
			label.setAttribute("spellcheck", "false");
			label.textContent = area.label ?? (element ? element.name : area.id);
			label.addEventListener("pointerdown", (e) => {
				e.stopPropagation();
			});
			label.addEventListener("paste", (e) => {
				e.preventDefault();
				const text = e.clipboardData?.getData("text/plain") || "";
				document.execCommand("insertText", false, text);
			});
			label.addEventListener("input", () => {
				this.handleAreaLabelInput(area.id, label.innerText || "");
			});
			block.appendChild(label);

			const removeButton = document.createElement("button");
			removeButton.type = "button";
			removeButton.className = "area-block__remove";
			const removeIcon = document.createElement("span");
			removeIcon.className = "material-symbols-outlined";
			removeIcon.setAttribute("aria-hidden", "true");
			removeIcon.textContent = "close";
			removeButton.appendChild(removeIcon);
			removeButton.title = "Remove from grid";
			removeButton.addEventListener("pointerdown", (e) => {
				e.preventDefault();
				e.stopPropagation();
			});
			removeButton.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.handleRemoveTagFromGrid(area.id);
			});
			block.appendChild(removeButton);

			block.appendChild(this.createAreaLayoutControls(area));

			block.addEventListener("pointerdown", this.handleAreaPointerDown.bind(this));
			block.addEventListener("pointermove", (e) => {
				const edge = this.isEdgePosition(e, block);
				if (edge.edge) {
					block.style.cursor = edge.left || edge.right ? "ew-resize" : "ns-resize";
				} else {
					block.style.cursor = "move";
				}
			});
			block.addEventListener("pointerleave", () => {
				block.style.cursor = "default";
			});
			block.addEventListener("dragstart", (e) => e.preventDefault());
			block.addEventListener("selectstart", (e) => {
				const target = e.target;
				if (target instanceof Element && target.closest(".area-block__label")) return;
				e.preventDefault();
			});
			block.addEventListener("dragover", (e) => e.preventDefault());
			block.addEventListener("drop", this.handleDrop.bind(this));
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
