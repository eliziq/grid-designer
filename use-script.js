//can switch id and layout name
const layoutDefinitions = {
	"Single event for GOLD": {
		id: 547,
		width: 1536,
		type: "Cross Selling",
		sizes: [
			{
				width: 1536,
				height: 704,
			},
			{
				width: 672,
				height: 756,
			},
		],
	},
	"Vertical events for VIP + GOLD + SILVER": {
		id: 509,
		width: 1536,
		type: "Cross Selling",
		sizes: [
			{
				width: 1536,
				height: 128,
			},
			{
				width: 672,
				height: 336,
			},
		],
	},
	"Main Page": {
		id: 101,
		width: 1536,
		type: "Cross Selling",
		sizes: [
			{
				width: 512,
				height: 576,
			},
			{
				width: 672,
				height: 840,
			},
			{
				width: 1024,
				height: 576,
			},
		],
	},
};

const cardId = 123;

const tags = [
	[
		{
			id: "Event_NameAndLogo",
			name: "Event name, Team logos",
			gridArea: "namewrap",
			ctrls: [
				{
					name: "Event name",
					selected: "false",
					tag: "Name",
				},
				{
					name: "Team logos",
					selected: "false",
					tag: "TeamsLogo",
				},
			],
			controlType: "checkbox",
		},

		{
			id: "Event_Counter",
			name: "Sold counter",
			gridArea: "prodcnt",
			ctrls: [
				{
					name: "Sold counter",
					selected: "true",
					tag: "Counter",
				},
			],
			controlType: "checkbox",
		},

		{
			id: "Event_Date",
			name: "Event date (format: DD/MM/YYYY), Event start time (format: HH:MM), Displayed event date (text format)",
			gridArea: "boxdates",
			ctrls: [
				{
					name: "Event date (format: DD/MM/YYYY)",
					selected: "true",
					tag: "Day",
				},
				{
					name: "Event start time (format: HH:MM)",
					selected: "false",
					tag: "Hour",
				},
				{
					name: "Displayed event date (text format)",
					selected: "false",
					tag: "DisplayDate",
				},
			],
			controlType: "radio",
		},

		{
			id: "Event_Btns",
			name: "Buy parking ticket, Link to more information about the event",
			gridArea: "prodcnt",
			ctrls: [
				{
					name: "Buy parking ticket",
					selected: "false",
					tag: "BuyUrlParking",
				},
				{
					name: "Link to more information about the event",
					selected: "false",
					tag: "InfoUrl",
				},
			],
			controlType: "checkbox",
		},
	],
];
const state = {}; //not neccessary, can be used to load existing design state

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () =>
		window.GridDesigner.Init(cardId, layoutDefinitions, tags, state),
	);
} else {
	window.GridDesigner.Init(cardId, layoutDefinitions, tags, state);
}
