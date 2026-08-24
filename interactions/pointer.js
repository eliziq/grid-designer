Object.assign(GridDesigner.prototype, {
	applyAreasToMatrix() {
		this.initMatrix();
		Object.values(this.state.areas).forEach((area) => {
			for (let rr = area.rowStart; rr <= area.rowEnd; rr++) {
				for (let cc = area.colStart; cc <= area.colEnd; cc++) {
					this.state.gridMatrix[rr][cc] = area.id;
				}
			}
		});
	},

	handlePointerUp() {
		if (!this.resizeState) return;
		this.resizeState.dragging = false;
		this.resizeState = null;

		if (this.handlePointerMoveBound) {
			window.removeEventListener("pointermove", this.handlePointerMoveBound);
			this.handlePointerMoveBound = null;
		}

		document.body.style.cursor = "default";
		Array.from(this.containerElement.querySelectorAll(".area-block")).forEach((block) => {
			block.classList.remove("edge-top", "edge-bottom", "edge-left", "edge-right");
		});
		this.updateCssPreview();
	},

	handlePointerMove(event) {
		if (!this.resizeState || !this.resizeState.dragging) return;
		const { id, edge, startArea, mode = "resize" } = this.resizeState;
		const gridRect = this.grid.getBoundingClientRect();
		const scale = parseFloat(
			getComputedStyle(this.gridWrapper).getPropertyValue("--grid-scale") || "1",
		);
		const { colWidth, gap } = this.getGridMetrics();
		const stepX = colWidth + gap;
		const pointerX = (event.clientX - gridRect.left) / scale;
		const pointerY = (event.clientY - gridRect.top) / scale;
		const snapDelta = (pixelDelta, step) => {
			const halfStep = step * 0.5;
			if (pixelDelta > halfStep) {
				return Math.floor((pixelDelta - halfStep) / step) + 1;
			}
			if (pixelDelta < -halfStep) {
				return Math.ceil((pixelDelta + halfStep) / step) - 1;
			}
			return 0;
		};

		if (mode === "move") {
			const existingArea = this.state.areas[id] || {};
			const startPointerX = this.resizeState.startPointerX;
			const startPointerY = this.resizeState.startPointerY;
			const desiredColShift = snapDelta(pointerX - startPointerX, stepX);
			const desiredRowShift =
				this.nearestRowLineIndex(pointerY) - this.nearestRowLineIndex(startPointerY);
			const shiftedArea = this.getShiftedAreaByFreeEdge(
				startArea,
				id,
				desiredRowShift,
				desiredColShift,
			);

			if (
				shiftedArea.rowStart === this.state.areas[id]?.rowStart &&
				shiftedArea.rowEnd === this.state.areas[id]?.rowEnd &&
				shiftedArea.colStart === this.state.areas[id]?.colStart &&
				shiftedArea.colEnd === this.state.areas[id]?.colEnd
			) {
				return;
			}

			this.state.areas[id] = {
				...existingArea,
				id,
				rowStart: shiftedArea.rowStart,
				rowEnd: shiftedArea.rowEnd,
				colStart: shiftedArea.colStart,
				colEnd: shiftedArea.colEnd,
				label: startArea.label,
			};
			this.applyAreasToMatrix();
			this.renderGrid();
			this.updateCssPreview();
			return;
		}

		let { rowStart, rowEnd, colStart, colEnd } = startArea;

		if (edge.top) {
			rowStart = Math.max(0, Math.min(rowEnd, this.nearestRowLineIndex(pointerY)));
		}
		if (edge.bottom) {
			rowEnd = Math.min(
				this.state.rows - 1,
				Math.max(rowStart, this.nearestRowLineIndex(pointerY) - 1),
			);
		}
		if (edge.left) {
			const startEdgeX = startArea.colStart * stepX;
			const deltaCols = snapDelta(pointerX - startEdgeX, stepX);
			colStart = Math.max(0, Math.min(colEnd, startArea.colStart + deltaCols));
		}
		if (edge.right) {
			const startEdgeX = (startArea.colEnd + 1) * stepX;
			const deltaCols = snapDelta(pointerX - startEdgeX, stepX);
			colEnd = Math.min(
				this.state.cols - 1,
				Math.max(colStart, startArea.colEnd + deltaCols),
			);
		}

		if (this.hasConflict(rowStart, colStart, rowEnd, colEnd, id)) {
			return;
		}

		this.state.areas[id] = {
			...this.state.areas[id],
			id,
			rowStart,
			rowEnd,
			colStart,
			colEnd,
			label: startArea.label,
		};
		this.applyAreasToMatrix();
		this.renderGrid();
		this.updateCssPreview();
	},

	handleAreaPointerDown(event) {
		if (event.target.closest(".area-block__label")) return;
		if (event.target.closest(".area-layout-controls")) return;
		event.preventDefault();
		event.stopPropagation();
		if (event.button !== 0) return;
		const block = event.currentTarget;
		const id = block.dataset.areaId;
		const area = this.state.areas[id];
		if (!area) return;
		const edge = this.isEdgePosition(event, block);
		const moveMode = !edge.edge;
		block.classList.toggle("edge-top", edge.top);
		block.classList.toggle("edge-bottom", edge.bottom);
		block.classList.toggle("edge-left", edge.left);
		block.classList.toggle("edge-right", edge.right);
		const gridRect = this.grid.getBoundingClientRect();
		const scale = parseFloat(
			getComputedStyle(this.gridWrapper).getPropertyValue("--grid-scale") || "1",
		);
		this.resizeState = {
			id,
			edge,
			mode: moveMode ? "move" : "resize",
			startArea: { ...area },
			startPointerX: (event.clientX - gridRect.left) / scale,
			startPointerY: (event.clientY - gridRect.top) / scale,
			dragging: true,
		};

		this.handlePointerMoveBound = this.handlePointerMove.bind(this);
		window.addEventListener("pointermove", this.handlePointerMoveBound);
		document.body.style.cursor = moveMode
			? "grabbing"
			: edge.top || edge.bottom
				? "ns-resize"
				: edge.left || edge.right
					? "ew-resize"
					: "default";
	},
});
