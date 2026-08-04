(function initializeGridDesignerApi(globalScope) {
	let activeInstance = null;
	let lastInitArgs = null;

	function cloneData(value, fallback = null) {
		if (value == null) return fallback;
		return JSON.parse(JSON.stringify(value));
	}

	globalScope.GridDesigner = {
		Init(id, layoutDefinitions, tags, state) {
			lastInitArgs = {
				id: id == null ? "" : String(id),
				layoutDefinitions: cloneData(layoutDefinitions, {}),
				tags: cloneData(tags, []),
				state: cloneData(state, null),
				initializedAt: new Date().toISOString(),
			};
			activeInstance = new GridDesigner(id, layoutDefinitions, tags, state);
			return Boolean(activeInstance);
		},
		GetInitArgs() {
			return cloneData(lastInitArgs, null);
		},
		GetCss() {
			return activeInstance?.getCss?.() || "";
		},
		GetState() {
			return activeInstance?.getState?.() || null;
		},
		GetTags() {
			return activeInstance?.getTags?.() || [];
		},
		GetSavedPresets() {
			return activeInstance?.getSavedPresets?.() || [];
		},
	};
})(window);
