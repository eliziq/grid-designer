Object.assign(GridDesigner.prototype, {
	hasConflict(r0, c0, r1, c1, id = null) {
		for (let r = r0; r <= r1; r++) {
			for (let c = c0; c <= c1; c++) {
				if (r < 0 || r >= this.state.rows || c < 0 || c >= this.state.cols) return true;
				const current = this.state.gridMatrix[r][c];
				if (current && current !== id) return true;
			}
		}
		return false;
	},

	removeArea(id) {
		const area = this.state.areas[id];
		if (!area) return;
		for (let r = area.rowStart; r <= area.rowEnd; r++) {
			for (let c = area.colStart; c <= area.colEnd; c++) {
				if (this.state.gridMatrix[r][c] === id) {
					this.state.gridMatrix[r][c] = null;
				}
			}
		}
		delete this.state.areas[id];
	},

	assignArea(id, r0, c0, r1, c1) {
		const rowStart = Math.min(r0, r1);
		const rowEnd = Math.max(r0, r1);
		const colStart = Math.min(c0, c1);
		const colEnd = Math.max(c0, c1);
		if (this.hasConflict(rowStart, colStart, rowEnd, colEnd, id)) return false;
		this.removeArea(id);
		this.state.areas[id] = { id, rowStart, rowEnd, colStart, colEnd };
		for (let r = rowStart; r <= rowEnd; r++) {
			for (let c = colStart; c <= colEnd; c++) {
				this.state.gridMatrix[r][c] = id;
			}
		}
		return true;
	},

	getGridMetrics() {
		const gap = 8;
		const { cols, rows } = this.state;
		return {
			gap,
			colWidth: (this.gridWidth - gap * (cols - 1)) / cols,
			rowHeight: (this.gridHeight - gap * (rows - 1)) / rows,
		};
	},

	cellToGridPos(clientX, clientY) {
		const gridRect = this.grid.getBoundingClientRect();
		const x = clientX - gridRect.left;
		const y = clientY - gridRect.top;
		const computed = getComputedStyle(this.grid);
		const gap = parseFloat(computed.gap) || 0;
		const scale = parseFloat(
			getComputedStyle(this.gridWrapper).getPropertyValue("--grid-scale") || "1",
		);

		const { colWidth: colSize, rowHeight: rowSize } = this.getGridMetrics();

		const scaledX = x / scale;
		const scaledY = y / scale;
		const col = Math.min(
			this.state.cols - 1,
			Math.max(0, Math.floor(scaledX / (colSize + gap))),
		);
		const row = Math.min(
			this.state.rows - 1,
			Math.max(0, Math.floor(scaledY / (rowSize + gap))),
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
