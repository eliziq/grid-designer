// usage
const resolutions = {
	1536: [
		{ width: 1536, height: 640 },

		{ width: 768, height: 640 },

		{ width: 512, height: 640 },

		{ width: 1024, height: 640 },

		{ width: 384, height: 640 },

		{ width: 1152, height: 640 },
	],

	672: [{ width: 672, height: 336 }],
};

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
