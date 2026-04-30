(function () {
	const scriptsToLoad = [
		"grid-designer-class.js",
		"grid-designer-state.js",
		"grid-designer-layout.js",
		"grid-designer-render.js",
		"grid-designer-interactions.js",
		"grid-designer-api.js",
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


