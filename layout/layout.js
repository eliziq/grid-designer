Object.assign(GridDesigner.prototype, {
	hasConflict(r0, c0, r1, c1, id = null) {
		this.ensureGridMatrixIntegrity();
		for (let r = r0; r <= r1; r++) {
			for (let c = c0; c <= c1; c++) {
				if (r < 0 || r >= this.state.rows || c < 0 || c >= this.state.cols) return true;
				const current = this.state.gridMatrix[r]?.[c];
				if (current && current !== id) return true;
			}
		}
		return false;
	},

	removeArea(id) {
		this.ensureGridMatrixIntegrity();
		const area = this.state.areas[id];
		if (!area) return;
		for (let r = area.rowStart; r <= area.rowEnd; r++) {
			for (let c = area.colStart; c <= area.colEnd; c++) {
				if (this.state.gridMatrix[r]?.[c] === id) {
					this.state.gridMatrix[r][c] = null;
				}
			}
		}
		delete this.state.areas[id];
	},

	assignArea(id, r0, c0, r1, c1) {
		this.ensureGridMatrixIntegrity();
		const existingArea = this.state.areas[id] || {};
		const rowStart = Math.min(r0, r1);
		const rowEnd = Math.max(r0, r1);
		const colStart = Math.min(c0, c1);
		const colEnd = Math.max(c0, c1);
		if (this.hasConflict(rowStart, colStart, rowEnd, colEnd, id)) return false;
		this.removeArea(id);
		this.state.areas[id] = {
			...existingArea,
			id,
			rowStart,
			rowEnd,
			colStart,
			colEnd,
		};
		for (let r = rowStart; r <= rowEnd; r++) {
			for (let c = colStart; c <= colEnd; c++) {
				this.state.gridMatrix[r][c] = id;
			}
		}
		return true;
	},

	canShiftAreaByOne(area, id, dRow, dCol) {
		if (!area || !id) return false;
		this.ensureGridMatrixIntegrity();

		if (dRow < 0) {
			const targetRow = area.rowStart - 1;
			if (targetRow < 0) return false;
			for (let c = area.colStart; c <= area.colEnd; c++) {
				const current = this.state.gridMatrix[targetRow]?.[c];
				if (current && current !== id) return false;
			}
			return true;
		}

		if (dRow > 0) {
			const targetRow = area.rowEnd + 1;
			if (targetRow >= this.state.rows) return false;
			for (let c = area.colStart; c <= area.colEnd; c++) {
				const current = this.state.gridMatrix[targetRow]?.[c];
				if (current && current !== id) return false;
			}
			return true;
		}

		if (dCol < 0) {
			const targetCol = area.colStart - 1;
			if (targetCol < 0) return false;
			for (let r = area.rowStart; r <= area.rowEnd; r++) {
				const current = this.state.gridMatrix[r]?.[targetCol];
				if (current && current !== id) return false;
			}
			return true;
		}

		if (dCol > 0) {
			const targetCol = area.colEnd + 1;
			if (targetCol >= this.state.cols) return false;
			for (let r = area.rowStart; r <= area.rowEnd; r++) {
				const current = this.state.gridMatrix[r]?.[targetCol];
				if (current && current !== id) return false;
			}
			return true;
		}

		return true;
	},

	getShiftedAreaByFreeEdge(area, id, desiredRowShift, desiredColShift) {
		if (!area || !id) return area;

		const horizontalFirst = Math.abs(desiredColShift) >= Math.abs(desiredRowShift);
		const preferredAxis = horizontalFirst ? "col" : "row";
		const fallbackAxis = horizontalFirst ? "row" : "col";

		const applyAxisShift = (sourceArea, axis) => {
			const desiredShift = axis === "col" ? desiredColShift : desiredRowShift;
			if (!desiredShift) {
				return { nextArea: sourceArea, moved: false };
			}

			const direction = desiredShift < 0 ? -1 : 1;
			const steps = Math.abs(desiredShift);
			const nextArea = { ...sourceArea };
			let moved = false;

			for (let i = 0; i < steps; i++) {
				const canShift =
					axis === "col"
						? this.canShiftAreaByOne(nextArea, id, 0, direction)
						: this.canShiftAreaByOne(nextArea, id, direction, 0);
				if (!canShift) break;

				if (axis === "col") {
					nextArea.colStart += direction;
					nextArea.colEnd += direction;
				} else {
					nextArea.rowStart += direction;
					nextArea.rowEnd += direction;
				}
				moved = true;
			}

			return { nextArea, moved };
		};

		let { nextArea } = applyAxisShift(area, preferredAxis);
		({ nextArea } = applyAxisShift(nextArea, fallbackAxis));

		return nextArea;
	},

	getGridMetrics() {
		const gap = 8;
		const { cols, rows } = this.state;
		const renderedWidth = this.grid?.clientWidth || this.gridWidth;
		const renderedHeight = this.grid?.clientHeight || this.gridHeight;
		return {
			gap,
			colWidth: (renderedWidth - gap * (cols - 1)) / cols,
			rowHeight: (renderedHeight - gap * (rows - 1)) / rows,
		};
	},

	getCellFromPointer(clientX, clientY) {
		if (!this.grid) return null;
		const blocks = Array.from(this.grid.querySelectorAll(".area-block"));
		blocks.forEach((block) => {
			block.style.pointerEvents = "none";
		});
		const hit = document.elementFromPoint(clientX, clientY);
		blocks.forEach((block) => {
			block.style.pointerEvents = "";
		});
		if (!(hit instanceof Element)) return null;
		const cell = hit.closest(".cell");
		return cell instanceof HTMLElement ? cell : null;
	},

	cellToGridPos(clientX, clientY) {
		const cell = this.getCellFromPointer(clientX, clientY);
		if (cell) {
			const row = Number(cell.dataset.row);
			const col = Number(cell.dataset.col);
			if (Number.isFinite(row) && Number.isFinite(col)) {
				return {
					row: Math.min(this.state.rows - 1, Math.max(0, row)),
					col: Math.min(this.state.cols - 1, Math.max(0, col)),
				};
			}
		}

		const gridRect = this.grid.getBoundingClientRect();
		const safeWidth = Math.max(1, gridRect.width);
		const safeHeight = Math.max(1, gridRect.height);
		const x = Math.min(Math.max(0, clientX - gridRect.left), safeWidth - 0.001);
		const y = Math.min(Math.max(0, clientY - gridRect.top), safeHeight - 0.001);
		const col = Math.min(
			this.state.cols - 1,
			Math.max(0, Math.floor((x / safeWidth) * this.state.cols)),
		);
		const row = Math.min(
			this.state.rows - 1,
			Math.max(0, Math.floor((y / safeHeight) * this.state.rows)),
		);
		return { row, col };
	},

	isEdgePosition(event, block) {
		const rect = block.getBoundingClientRect();
		const threshold = 12;
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const right = x >= rect.width - threshold;
		const bottom = y >= rect.height - threshold;
		const left = x <= threshold;
		const top = y <= threshold;
		return { top, bottom, left, right, edge: top || bottom || left || right };
	},
});
