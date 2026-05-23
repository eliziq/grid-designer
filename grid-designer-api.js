window.GridDesigner = {
	Init(id, layoutDefinitions, tags, state) {
		window.GridDesignerInstance = new GridDesigner(id, layoutDefinitions, tags, state);
		return window.GridDesignerInstance;
	},
	GetCss() {
		return window.GridDesignerInstance?.getCss?.() || "";
	},
	GetState() {
		return window.GridDesignerInstance?.getState?.() || null;
	},
	GetTags() {
		return window.GridDesignerInstance?.getTags?.() || [];
	},
};
