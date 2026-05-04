GridDesigner.generateAreaColor = function (id) {
	const hue = (Array.from(String(id)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) * 7) % 360;
	return `hsl(${hue}, 70%, 60%)`;
};

Object.assign(GridDesigner.prototype, {
	renderGrid() {
		if (!this.grid) return;
		this.grid.innerHTML = "";
		this.grid.style.gridTemplateColumns = `repeat(${this.state.cols}, 1fr)`;
		this.grid.style.gridTemplateRows = `repeat(${this.state.rows}, minmax(60px, 1fr))`;
		this.grid.style.width = `${this.gridWidth}px`;
		this.grid.style.height = `${this.gridHeight}px`;
		this.grid.style.minHeight = "auto";
		if (this.gridWrapper) {
			this.gridWrapper.style.width = `${this.gridWidth + 20}px`;
			this.gridWrapper.style.height = `${this.gridHeight + 20}px`;
		}
		this.updateGridScaling();
		for (let r = 0; r < this.state.rows; r++) {
			for (let c = 0; c < this.state.cols; c++) {
				const cell = document.createElement("div");
				cell.className = "cell";
				cell.dataset.row = r;
				cell.dataset.col = c;
				cell.draggable = false;
				cell.addEventListener("dragover", (e) => e.preventDefault());
				cell.addEventListener("drop", this.handleDrop.bind(this));
				this.grid.appendChild(cell);
			}
		}
		this.renderAreas();
	},

	renderAreas() {
		if (!this.grid) return;
		const gap = 8;
		const { colWidth: cellWidth, rowHeight: cellHeight } = this.getGridMetrics();

		Object.values(this.state.areas).forEach((area) => {
			const element = this.state.elements.find((el) => el.id === area.id);
			const block = document.createElement("div");
			block.className = "area-block";
			block.draggable = false;
			block.dataset.areaId = area.id;
			const x = area.colStart * (cellWidth + gap);
			const y = area.rowStart * (cellHeight + gap);
			const width =
				(area.colEnd - area.colStart + 1) * cellWidth + (area.colEnd - area.colStart) * gap;
			const height =
				(area.rowEnd - area.rowStart + 1) * cellHeight +
				(area.rowEnd - area.rowStart) * gap;
			block.style.left = `${x}px`;
			block.style.top = `${y}px`;
			block.style.width = `${width}px`;
			block.style.height = `${height}px`;
			const color =
				this.areaColors[area.id] ||
				(this.areaColors[area.id] = GridDesigner.generateAreaColor(area.id));
			block.style.borderColor = color;
			block.style.background = "rgba(100, 160, 255, 0.2)";
			block.style.boxShadow = `0 0 0 1px ${color}`;
			block.textContent = element ? element.name : area.id;
			block.addEventListener("pointerdown", this.handleAreaPointerDown.bind(this));
			block.addEventListener("pointermove", (e) => {
				const edge = this.isEdgePosition(e, block);
				if (edge.edge) {
					block.style.cursor = edge.left || edge.right ? "ew-resize" : "ns-resize";
				} else {
					block.style.cursor = "default";
				}
			});
			block.addEventListener("pointerleave", () => {
				block.style.cursor = "default";
			});
			block.addEventListener("dragstart", (e) => e.preventDefault());
			block.addEventListener("selectstart", (e) => e.preventDefault());
			block.addEventListener("dragover", (e) => e.preventDefault());
			block.addEventListener("drop", this.handleDrop.bind(this));
			this.grid.appendChild(block);
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

			const controlsMarkup = (tag.ctrls || [])
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
				${controlsMarkup ? `<div class="tag-selector__ctrls">${controlsMarkup}</div>` : ""}
			`;

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
			tag.textContent = element.name;
			tag.title = isPlaced ? "Placed on grid" : "Still needs placement";

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
		const viewportWidth = window.innerWidth - 40;
		const viewportHeight = window.innerHeight * 0.8;
		const totalGridWidth = this.gridWidth + 20;
		const totalGridHeight = this.gridHeight + 20;
		const widthScale = totalGridWidth > viewportWidth ? viewportWidth / totalGridWidth : 1;
		const heightScale = totalGridHeight > viewportHeight ? viewportHeight / totalGridHeight : 1;
		const scale = Math.min(widthScale, heightScale);
		if (scale < 1) {
			this.gridWrapper.style.setProperty("--grid-scale", scale);
			this.gridWrapper.style.setProperty(
				"--grid-margin",
				`${(viewportWidth - totalGridWidth * scale) / 2}px`,
			);
			this.gridWrapper.style.setProperty(
				"--grid-margin-top",
				`${(viewportHeight - totalGridHeight * scale) / 2}px`,
			);
		} else {
			this.gridWrapper.style.setProperty("--grid-scale", "1");
			this.gridWrapper.style.setProperty("--grid-margin", "0px");
			this.gridWrapper.style.setProperty("--grid-margin-top", "0px");
		}
	},

	calculateGridDimensions() {
		this.gridWidth = this.currentResolution?.width || 1536;
		this.gridHeight = this.currentResolution?.height || 864;
	},
});
