Object.assign(GridDesigner.prototype, {
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
			const hideParentCheckbox = isSubgroup && tag.controlType === "checkbox";

			if (isSubgroup) {
				const controlsMarkup = ctrls
					.map((ctrl) => {
						const inputType = tag.controlType === "radio" ? "radio" : "checkbox";
						const checked = ctrl.selected ? "checked" : "";
						const disabled =
							tag.controlType === "checkbox" ? isLocked : !tag.selected || isLocked;
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

				item.innerHTML = hideParentCheckbox
					? `
						<div class="tag-selector__ctrls">${controlsMarkup}</div>
					`
					: `
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
});
