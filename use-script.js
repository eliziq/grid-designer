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
		id: "Event_Counter",
		name: "Sold counter",
		ctrls: [
			{
				name: "Sold counter",
				selected: "true",
			},
		],
		controlType: "checkbox",
	},
	{
		id: "Event_DefaultPrice",
		name: "Default price",
		ctrls: [
			{
				name: "Default price",
				selected: "true",
			},
		],
		controlType: "checkbox",
	},
	{
		id: "Event_Tournament",
		name: "Competition name",
		ctrls: [
			{
				name: "Competition name",
				selected: "true",
			},
		],
		controlType: "checkbox",
	},
	{
		id: "Event_DescriptionHeader",
		name: "Sales status",
		ctrls: [
			{
				name: "Sales status",
				selected: "true",
			},
		],
		controlType: "checkbox",
	},
	{
		id: "Event_ShortDescription",
		name: "Short event description (max. 300 characters)",
		ctrls: [
			{
				name: "Short event description (max. 300 characters)",
				selected: "true",
			},
		],
		controlType: "checkbox",
	},
	{
		id: "Event_NameAndLogo",
		name: "Event name, Team logos",
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
		id: "Event_Date",
		name: "Event date (format: DD/MM/YYYY), Event start time (format: HH:MM), Displayed event date (text format)",
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
		id: "Event_Place",
		name: "Stadium name, Venue/Stadium description",
		ctrls: [
			{
				name: "Stadium name",
				selected: "true",
			},
			{
				name: "Venue/Stadium description",
				selected: "true",
			},
		],
		controlType: "checkbox",
	},
	{
		id: "Event_Btns",
		name: "Buy parking ticket, Link to more information about the event",
		ctrls: [
			{
				name: "Buy parking ticket",
				selected: "true",
			},
			{
				name: "Link to more information about the event",
				selected: "true",
			},
		],
		controlType: "checkbox",
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
