(function () {
	const scriptsToLoad = [
		"core/class.js",
		"components/confirm-dialog.js",
		"core/state.js",
		"core/tag-sync.js",
		"components/resolution-option-component.js",
		"components/tag-component.js",
		"components/area-controls-component.js",
		"core/resolutions.js",
		"export/css-generator.js",
		"layout/layout.js",
		"render/render.js",
		"render/tag-layout-controls.js",
		"render/tag-panel.js",
		"interactions/interactions.js",
		"interactions/pointer.js",
		"api/api.js",
		"use-script.js",
	];

	const loadScript = (src) =>
		new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = src;
			script.async = false;
			script.onload = () => resolve(src);
			script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
			document.body.appendChild(script);
		});

	(async () => {
		for (const src of scriptsToLoad) {
			await loadScript(src);
		}
	})().catch((error) => {
		console.error(error);
	});
})();
