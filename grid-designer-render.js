GridDesigner.generateAreaColor = function (id) {
	const hue = (Array.from(String(id)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) * 7) % 360;
	return `hsl(${hue}, 70%, 60%)`;
};

Object.assign(GridDesigner.prototype, {
	applyGridBaseStyles() {
		if (!this.grid) return;
		this.grid.style.aspectRatio = `${this.gridWidth} / ${this.gridHeight}`;
		this.grid.style.minHeight = "auto";
		this.updateGridScaling();
	},

	refreshGridView() {
		this.renderGrid();
		this.renderElementList();
		this.updateCssPreview();
	},

	refreshWorkspaceView() {
		this.renderGrid();
		this.renderElementList();
		this.renderRowControls();
		this.updateCssPreview();
	},

	refreshResolutionUi() {
		this.refreshWorkspaceView();
		this.updateResolutionTabState();
		this.updatePatternButtons();
		this.renderTagSelectionPanel();
	},

	renderGrid() {
		if (!this.grid?.isConnected || !this.gridWrapper?.isConnected) this.cacheDomElements();
		if (!this.grid) return;

		this.grid.innerHTML = "";
		this.applyGridBaseStyles();
		const gridTemplateColumns = `repeat(${this.state.cols}, 1fr)`;
		const gridTemplateRows = `repeat(${this.state.rows}, minmax(60px, 1fr))`;
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
			block.style.background = "rgba(100, 160, 255, 0.2)";
			block.style.boxShadow = `0 0 0 1px ${color}`;

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
			removeButton.textContent = "\u00D7";
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
				if (e.target.closest(".area-block__label")) return;
				e.preventDefault();
			});
			block.addEventListener("dragover", (e) => e.preventDefault());
			block.addEventListener("drop", this.handleDrop.bind(this));
			host.appendChild(block);
		});
	},

	renderRowControls() {
		const existingControls = this.rowControls.querySelectorAll("label");
		if (existingControls) existingControls.forEach((el) => el.remove());
		const controlsContainer = this.rowControls;

		const options = [
			{ value: "1fr", label: "Flexible (1fr)" },
			{ value: "max-content", label: "Content height" },
			{ value: "min-content", label: "Min content" },
			{ value: "auto", label: "Auto" },
		];

		for (let i = 0; i < this.state.rows; i++) {
			const rowControl = document.createElement("label");
			const label = document.createElement("span");
			label.textContent = `Row ${i + 1}:`;
			const select = document.createElement("select");
			select.dataset.rowIndex = i;

			options.forEach((option) => {
				const optionEl = document.createElement("option");
				optionEl.value = option.value;
				optionEl.textContent = option.label;
				if (this.state.rowHeights[i] === option.value) {
					optionEl.selected = true;
				}
				select.appendChild(optionEl);
			});

			select.addEventListener("change", (e) => {
				const rowIndex = parseInt(e.target.dataset.rowIndex, 10);
				this.state.rowHeights[rowIndex] = e.target.value;
				this.updateCssPreview();
			});

			rowControl.appendChild(label);
			rowControl.appendChild(select);
			controlsContainer.appendChild(rowControl);
		}
	},

	renderTagSelectionPanel() {
		const panel = this.containerElement.querySelector("#tagSelectionPanel");
		if (!panel) return;

		const selectedCount = this.allowedTags.filter((tag) => tag.selected).length;
		const totalCount = this.allowedTags.length;
		const isLocked = Boolean(this.tagSelectionLocked);

		const details = panel.querySelector("#tagSelectorDetails");
		if (details) details.open = !isLocked;

		const meta = panel.querySelector("#tagSelectorMeta");
		if (meta) meta.textContent = `${selectedCount}/${totalCount} selected`;

		const saveBtn = panel.querySelector("#tagSelectionSave");
		const editBtn = panel.querySelector("#tagSelectionEdit");
		if (saveBtn) saveBtn.style.display = isLocked ? "none" : "";
		if (editBtn) editBtn.style.display = isLocked ? "" : "none";

		const list = panel.querySelector("#tagSelectorList");
		if (!list) return;
		list.innerHTML = "";

		this.allowedTags.forEach((tag) => {
			const item = document.createElement("div");
			item.className = "tag-selector__item";
			item.dataset.tagId = tag.id;

			const ctrls = tag.ctrls || [];
			const isSubgroup = ctrls.length >= 2;

			if (isSubgroup) {
				const controlsMarkup = ctrls
					.map((ctrl) => {
						const inputType = tag.controlType === "radio" ? "radio" : "checkbox";
						const checked = ctrl.selected ? "checked" : "";
						const disabled = !tag.selected || isLocked ? "disabled" : "";
						const radioName = `tagctrl-${tag.id}`;
						return `
							<label class="tag-selector__ctrl">
								<input
									type="${inputType}"
									name="${radioName}"
									data-ctrl-id="${ctrl.id}"
									${checked}
									${disabled}
								/>
								<span>${ctrl.name}</span>
							</label>
						`;
					})
					.join("");

				item.innerHTML = `
					<label class="tag-selector__tag">
						<input
							type="checkbox"
							class="tag-selector__tag-check"
							data-tag-id="${tag.id}"
							${tag.selected ? "checked" : ""}
							${isLocked ? "disabled" : ""}
						/>
						<span>${tag.name}</span>
					</label>
					<div class="tag-selector__ctrls">${controlsMarkup}</div>
				`;
			} else {
				item.innerHTML = `
					<label class="tag-selector__tag">
						<input
							type="checkbox"
							class="tag-selector__tag-check"
							data-tag-id="${tag.id}"
							${tag.selected ? "checked" : ""}
							${isLocked ? "disabled" : ""}
						/>
						<span>${tag.name}</span>
					</label>
				`;
			}

			list.appendChild(item);
		});
	},

	renderElementList() {
		if (!this.elementList) return;
		this.elementList.innerHTML = "";
		const placedIds = new Set(Object.keys(this.state.areas || {}));
		this.state.elements.forEach((element) => {
			const tag = document.createElement("div");
			const isPlaced = placedIds.has(element.id);
			tag.className = `element-tag ${isPlaced ? "placed" : "pending"}`;
			tag.draggable = true;
			tag.title = isPlaced ? "Placed on grid" : "Still needs placement";

			const label = document.createElement("span");
			label.textContent = element.name;
			tag.appendChild(label);

			if (!this.areaColors[element.id]) {
				this.areaColors[element.id] = GridDesigner.generateAreaColor(element.id);
			}
			tag.style.borderColor = this.areaColors[element.id];
			tag.addEventListener("dragstart", (e) => {
				e.dataTransfer.setData("text/plain", element.id);
			});
			this.elementList.appendChild(tag);
		});
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
