window.GridDesigner = {
	Init(id, resolutions, tags, state) {
		window.GridDesignerInstance = new GridDesigner(id, resolutions, tags, state);
		return window.GridDesignerInstance;
	},
	GetCss() {
		return window.GridDesignerInstance?.getCss?.() || "";
	},
	GetState() {
		return window.GridDesignerInstance?.getState?.() || null;
	},
};
