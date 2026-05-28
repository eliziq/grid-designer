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
	const first = await loadInitData("designs/init-data-1.json");
	const second = await loadInitData("designs/init-data-2.json");
	const init = (data) =>
		window.GridDesigner.Init(editorCardId, data.layoutDefinitions, data.tags, {
			...(data.state || {}),
			layoutDefinitions: data.layoutDefinitions,
		});
	console.log("init 1", first.state.currentLayoutName, first.state.currentResolutionIndex);
	window.setTimeout(() => init(first), 2000);
	console.log("after init 1", document.querySelector("#grid")?.getAttribute("style") || "");
	window.setTimeout(() => init(second), 4000);
	window.setTimeout(() => {
		console.log("init 2", second.state.currentLayoutName, second.state.currentResolutionIndex);
		console.log("after init 2", document.querySelector("#grid")?.getAttribute("style") || "");
	}, 4000);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", replayInitSequence);
} else {
	replayInitSequence();
}

