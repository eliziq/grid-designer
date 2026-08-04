class AreaControlsComponent {
	constructor(areaId, config = {}) {
		this.areaId = String(areaId || "");
		this.config = {
			justifyContent: config.justifyContent,
			alignItems: config.alignItems,
			headerPreset: config.headerPreset,
			enableHeaderPreset: Boolean(config.enableHeaderPreset),
		};
	}

	getStaticHeaderPresetOptions() {
		const baseUrl =
			"https://robostaticcontentcommon.s3.eu-central-1.amazonaws.com/Cards/presetv";
		return [1, 2, 3, 4].map((index) => ({
			value: `preset${index}`,
			label: `Preset ${index}`,
			iconUrl: `${baseUrl}${index}.svg`,
		}));
	}

	static escapeAttr(value) {
		return String(value || "")
			.replace(/&/g, "&amp;")
			.replace(/"/g, "&quot;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	}

	buildRadio(groupName, fieldName, option, selected) {
		const areaId = AreaControlsComponent.escapeAttr(this.areaId);
		const value = AreaControlsComponent.escapeAttr(option.value);
		const icon = AreaControlsComponent.escapeAttr(option.icon);
		const title = AreaControlsComponent.escapeAttr(option.title);
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
		const areaId = AreaControlsComponent.escapeAttr(this.areaId);
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

	buildHeaderPresetField() {
		if (!this.config.enableHeaderPreset) return "";

		const areaId = AreaControlsComponent.escapeAttr(this.areaId);
		const selectedPreset = String(this.config.headerPreset || "preset1");
		const presetButtons = this.getStaticHeaderPresetOptions()
			.map((option) => {
				const value = AreaControlsComponent.escapeAttr(option.value);
				const iconUrl = AreaControlsComponent.escapeAttr(option.iconUrl);
				const label = AreaControlsComponent.escapeAttr(option.label || option.value);
				const isActive = selectedPreset === option.value;
				return `
					<button
						type="button"
						class="area-preset-btn${isActive ? " is-active" : ""}"
						data-header-preset="${value}"
						data-area-id="${areaId}"
						title="${label}"
					>
						<img src="${iconUrl}" alt="${label}" />
					</button>
				`;
			})
			.join("");

		return `
			<div class="area-layout-control__field">
				<span class="area-layout-control__label">Header preset</span>
				<div class="area-layout-control__preset-grid">
					${presetButtons}
				</div>
			</div>
		`;
	}

	render() {
		const areaId = AreaControlsComponent.escapeAttr(this.areaId);
		const headerPresetField = this.buildHeaderPresetField();
		const justifyHtml = this.buildField(
			"justifyContent",
			"Justify content",
			[
				{ value: "__unset__", icon: "do_not_disturb_on", title: "Use global" },
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
				{ value: "__unset__", icon: "do_not_disturb_on", title: "Use global" },
				{ value: "start", icon: "vertical_align_top", title: "Start" },
				{ value: "center", icon: "vertical_align_center", title: "Center" },
				{ value: "end", icon: "vertical_align_bottom", title: "End" },
			],
			this.config.alignItems,
		);

		return `
			<div class="area-layout-controls">
				${
					headerPresetField
						? `
							<button
								type="button"
								class="area-layout-controls__toggle"
								data-header-preset-toggle="1"
								data-area-id="${areaId}"
								title="Team name presets"
							>
								<span class="material-symbols-outlined" aria-hidden="true">grid_view</span>
							</button>
							<div
								class="area-layout-controls__panel area-layout-controls__preset-panel"
								data-header-preset-panel="1"
								data-area-id="${areaId}"
								hidden
							>
								${headerPresetField}
							</div>
						`
						: ""
				}
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
