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
	{
		id: "event_name_logo",
		name: "Event name, Team Logos",
		ctrls: [
			{
				name: "Event name",
				selected: "true",
			},
			{
				name: "Team logos",
				selected: "true",
			},
		],
		controlType: "checkbox",
	},
	{
		id: "event_date",
		name: "Event date and time",
		ctrls: [
			{
				name: "Event date (format: DD/MM/YYYY)",
				selected: "true",
			},
			{
				name: "Event start time (format: HH:MM)",
				selected: "false",
			},
			{
				name: "Displayed event date (text format)",
				selected: "false",
			},
		],
		controlType: "radio",
	},
	{
		id: "event_place",
		name: "Stadium name, Stadium description  ",
		ctrls: [
			{
				name: "Stadium name",
				selected: "true",
			},
			{
				name: "Stadium description",
				selected: "false",
			},
		],
		controlType: "checkbox",
	},
	{
		id: "additional_info",
		name: "Additional info",
	},
];
const state = {}; //not neccessary, can be used to load existing design state

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () =>
		window.GridDesigner.Init(cardId, resolutions, tags, state),
	);
} else {
	window.GridDesigner.Init(cardId, resolutions, tags, state);
}
