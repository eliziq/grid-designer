class TagComponent {
	constructor(config = {}) {
		this.id = String(config.id || "");
		this.name = String(config.name || "");
		this.color = String(config.color || "");
		this.isPlaced = Boolean(config.isPlaced);
		this.onDragStart = typeof config.onDragStart === "function" ? config.onDragStart : null;
	}

	render() {
		const stateClass = this.isPlaced ? "placed" : "pending";
		const title = this.isPlaced ? "Placed on grid" : "Still needs placement";
		return `
			<div class="element-tag ${stateClass}" draggable="true" title="${title}">
				<span class="material-symbols-outlined">drag_indicator</span>
				<span>${this.name}</span>
			</div>
		`;
	}

	toElement() {
		const host = document.createElement("div");
		host.innerHTML = this.render().trim();
		const tag = host.firstElementChild;
		if (!tag) return null;

		if (this.color) {
			tag.style.borderColor = this.color;
		}

		if (this.onDragStart) {
			tag.addEventListener("dragstart", this.onDragStart);
		}

		return tag;
	}
}
