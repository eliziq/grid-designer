async function loadInitData(path) {
	const response = await fetch(path);
	return response.json();
}

const editorCardId = "gridDesignerDemo";

function ensureEditorRoot() {
	if (document.getElementById(editorCardId)) return;
	const root = document.createElement("div");
	root.id = editorCardId;
	while (document.body.firstChild) root.appendChild(document.body.firstChild);
	document.body.appendChild(root);
}

async function replayInitSequence() {
	ensureEditorRoot();
	const design = await loadInitData("designs/init-data-6.json");
	const init = (data) =>
		window.GridDesigner.Init(editorCardId, data.layoutDefinitions, data.tags, {
			...(data.state || {}),
			layoutDefinitions: data.layoutDefinitions,
		});
	init(design);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", replayInitSequence);
} else {
	replayInitSequence();
}
