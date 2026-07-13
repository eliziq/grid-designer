class AreaBlockComponent {
	constructor(config = {}) {
		this.area = config.area || null;
		this.displayName = String(config.displayName || "");
		this.color = String(config.color || "");
		this.onLabelInput =
			typeof config.onLabelInput === "function" ? config.onLabelInput : null;
		this.onRemove = typeof config.onRemove === "function" ? config.onRemove : null;
		this.onPointerDown =
			typeof config.onPointerDown === "function" ? config.onPointerDown : null;
		this.resolveEdge = typeof config.resolveEdge === "function" ? config.resolveEdge : null;
		this.onDrop = typeof config.onDrop === "function" ? config.onDrop : null;
		this.createControlsElement =
			typeof config.createControlsElement === "function"
				? config.createControlsElement
				: null;
	}

	createLabel(areaId) {
		const label = document.createElement("span");
		label.className = "area-block__label";
		label.setAttribute("contenteditable", "true");
		label.setAttribute("spellcheck", "false");
		label.textContent = this.area?.label ?? this.displayName;
		label.addEventListener("pointerdown", (event) => {
			event.stopPropagation();
		});
		label.addEventListener("paste", (event) => {
			event.preventDefault();
			const text = event.clipboardData?.getData("text/plain") || "";
			document.execCommand("insertText", false, text);
		});
		label.addEventListener("input", () => {
			if (this.onLabelInput) {
				this.onLabelInput(areaId, label.innerText || "");
			}
		});
		return label;
	}

	createRemoveButton(areaId) {
		const removeButton = document.createElement("button");
		removeButton.type = "button";
		removeButton.className = "area-block__remove";
		const removeIcon = document.createElement("span");
		removeIcon.className = "material-symbols-outlined";
		removeIcon.setAttribute("aria-hidden", "true");
		removeIcon.textContent = "close";
		removeButton.appendChild(removeIcon);
		removeButton.title = "Remove from grid";
		removeButton.addEventListener("pointerdown", (event) => {
			event.preventDefault();
			event.stopPropagation();
		});
		removeButton.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (this.onRemove) {
				this.onRemove(areaId);
			}
		});
		return removeButton;
	}

	attachBlockEvents(block) {
		if (this.onPointerDown) {
			block.addEventListener("pointerdown", this.onPointerDown);
		}

		if (this.resolveEdge) {
			block.addEventListener("pointermove", (event) => {
				const edge = this.resolveEdge(event, block);
				if (edge.edge) {
					block.style.cursor = edge.left || edge.right ? "ew-resize" : "ns-resize";
				} else {
					block.style.cursor = "move";
				}
			});
		}

		block.addEventListener("pointerleave", () => {
			block.style.cursor = "default";
		});
		block.addEventListener("dragstart", (event) => event.preventDefault());
		block.addEventListener("selectstart", (event) => {
			const target = event.target;
			if (target instanceof Element && target.closest(".area-block__label")) return;
			event.preventDefault();
		});
		block.addEventListener("dragover", (event) => event.preventDefault());
		if (this.onDrop) {
			block.addEventListener("drop", this.onDrop);
		}
	}

	toElement() {
		if (!this.area || !this.area.id) return null;
		const areaId = this.area.id;

		const block = document.createElement("div");
		block.className = "area-block";
		block.draggable = false;
		block.dataset.areaId = areaId;
		block.style.gridColumn = `${this.area.colStart + 1} / ${this.area.colEnd + 2}`;
		block.style.gridRow = `${this.area.rowStart + 1} / ${this.area.rowEnd + 2}`;
		block.style.borderColor = this.color;
		block.style.background = "hsl(220 20% 76% / 0.16)";
		block.style.boxShadow = `0 0 0 1px ${this.color}`;

		block.appendChild(this.createLabel(areaId));
		block.appendChild(this.createRemoveButton(areaId));

		if (this.createControlsElement) {
			const controls = this.createControlsElement(this.area);
			if (controls) block.appendChild(controls);
		}

		this.attachBlockEvents(block);
		return block;
	}
}
