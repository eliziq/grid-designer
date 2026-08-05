class ResolutionOptionComponent {
	constructor(config = {}) {
		this.index = Number(config.index) || 0;
		this.width = Number(config.width) || 0;
		this.height = Number(config.height) || 0;
		this.isActive = Boolean(config.isActive);
		this.isFinished = Boolean(config.isFinished);
		this.onChange = typeof config.onChange === "function" ? config.onChange : null;
	}

	render() {
		const activeClass = this.isActive ? " active" : "";
		const finishedClass = this.isFinished ? " finished" : "";
		const checked = this.isActive ? "checked" : "";

		return `
			<label class="${`resolution-option${activeClass}${finishedClass}`}">
				<input
					type="radio"
					name="resolution"
					value="${this.index}"
					data-resolution-index="${this.index}"
					${checked}
				/>
				<span>${this.width}x${this.height}</span>
			</label>
		`;
	}

	toElement() {
		const host = document.createElement("div");
		host.innerHTML = this.render().trim();
		const label = host.firstElementChild;
		const radio = label?.querySelector("input[type='radio']");

		if (label) {
			if (this.isActive) label.classList.add("active");
			if (this.isFinished) label.classList.add("finished");
		}

		if (radio && this.onChange) {
			radio.addEventListener("change", this.onChange);
		}

		return label;
	}
}
