class GridDesignerAreaLayoutControls {
	constructor(areaId, config = {}) {
		this.areaId = String(areaId || "");
		this.config = {
			justifyContent: config.justifyContent || "center",
			alignItems: config.alignItems || "center",
		};
	}

	static escapeAttr(value) {
		return String(value || "")
			.replace(/&/g, "&amp;")
			.replace(/"/g, "&quot;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	}

	buildRadio(groupName, fieldName, option, selected) {
		const areaId = GridDesignerAreaLayoutControls.escapeAttr(this.areaId);
		const value = GridDesignerAreaLayoutControls.escapeAttr(option.value);
		const icon = GridDesignerAreaLayoutControls.escapeAttr(option.icon);
		const title = GridDesignerAreaLayoutControls.escapeAttr(option.title);
		const checked = selected ? "checked" : "";

		return `
			<label class="icon-radio" title="${title}">
				<input
					type="radio"
					name="${groupName}"
					value="${value}"
					data-area-layout-control="1"
					data-area-id="${areaId}"
					data-layout-field="${fieldName}"
					${checked}
				/>
				<span class="material-symbols-outlined" aria-hidden="true">${icon}</span>
			</label>
		`;
	}

	buildField(fieldName, title, options, value) {
		const areaId = GridDesignerAreaLayoutControls.escapeAttr(this.areaId);
		const groupName = `area-${fieldName}-${areaId}`;
		const optionsHtml = options
			.map((option) => this.buildRadio(groupName, fieldName, option, option.value === value))
			.join("");

		return `
			<div class="area-layout-control__field">
				<span class="area-layout-control__label">${title}</span>
				<fieldset class="icon-radio-group" aria-label="${title}">
					${optionsHtml}
				</fieldset>
			</div>
		`;
	}

	render() {
		const areaId = GridDesignerAreaLayoutControls.escapeAttr(this.areaId);
		const justifyHtml = this.buildField(
			"justifyContent",
			"Justify content",
			[
				{ value: "start", icon: "format_align_left", title: "Start" },
				{ value: "center", icon: "format_align_center", title: "Center" },
				{ value: "end", icon: "format_align_right", title: "End" },
			],
			this.config.justifyContent,
		);
		const alignHtml = this.buildField(
			"alignItems",
			"Align items",
			[
				{ value: "start", icon: "vertical_align_top", title: "Start" },
				{ value: "center", icon: "vertical_align_center", title: "Center" },
				{ value: "end", icon: "vertical_align_bottom", title: "End" },
			],
			this.config.alignItems,
		);

		return `
			<div class="area-layout-controls">
				<button
					type="button"
					class="area-layout-controls__toggle"
					data-area-layout-toggle="1"
					data-area-id="${areaId}"
					title="Element alignment settings"
				>
					<span class="material-symbols-outlined" aria-hidden="true">more_vert</span>
				</button>
				<div
					class="area-layout-controls__panel"
					data-area-layout-panel="1"
					data-area-id="${areaId}"
					hidden
				>
					${justifyHtml}
					${alignHtml}
				</div>
			</div>
		`;
	}

	toElement() {
		const host = document.createElement("div");
		host.innerHTML = this.render().trim();
		return host.firstElementChild;
	}
}
