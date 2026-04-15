// usage
const resolutions = [
	{ width: 360, height: 800 },
	{ width: 600, height: 400 },
	{ width: 768, height: 1024 },
	{ width: 1024, height: 768 },
	{ width: 1536, height: 864 },
];

const cardId = 123;
const tags = [
	{ id: "title", name: "Title" },
	{ id: "desc", name: "Desc" },
	{ id: "button", name: "Button" },
];
const state = {}; //not neccessary, can be used to load existing design state

document.addEventListener("DOMContentLoaded", () =>
	window.GridDesigner.Init(cardId, resolutions, tags, state),
);
