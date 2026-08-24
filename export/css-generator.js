Object.assign(GridDesigner.prototype, {
	cssEscapeString(value) {
		return String(value || "")
			.replace(/\\/g, "\\\\")
			.replace(/"/g, '\\"');
	},

	cssEscapeClassName(value) {
		const className = String(value || "")
			.trim()
			.replace(/^\.+/, "");
		if (!className) return "";
		if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
			return CSS.escape(className);
		}
		return className.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
	},

	resolveAreaClassName(mappedElement, mappedTag) {
		const directGroupClass = mappedElement?.groupClass || mappedTag?.groupClass || "";
		if (String(directGroupClass || "").trim()) {
			return directGroupClass;
		}

		const elementCtrls = Array.isArray(mappedElement?.ctrls) ? mappedElement.ctrls : [];
		if (elementCtrls.length === 1) {
			const ctrlClass = elementCtrls[0]?.class;
			if (String(ctrlClass || "").trim()) return ctrlClass;
		}

		const tagCtrls = Array.isArray(mappedTag?.ctrls) ? mappedTag.ctrls : [];
		if (tagCtrls.length === 1) {
			const ctrlClass = tagCtrls[0]?.class;
			if (String(ctrlClass || "").trim()) return ctrlClass;
		}

		return "";
	},

	buildAreaContentSelector(rootSelector, groupClass) {
		const escapedClass = this.cssEscapeClassName(groupClass);
		if (!escapedClass) return "";
		return `${rootSelector} > .${escapedClass}`;
	},

	renderAreaSpecificContentRules(rootSelector, state, indent = "") {
		const areas = state?.areas || {};
		const elementsById = new Map(
			(this.state.elements || []).map((element) => [String(element.id), element]),
		);
		const tagsById = new Map((this.allowedTags || []).map((tag) => [String(tag.id), tag]));

		const rules = Object.entries(areas)
			.map(([areaId, area]) => {
				if (!area || typeof area !== "object") return "";

				const hasJustify = Object.prototype.hasOwnProperty.call(area, "justifyContent");
				const hasAlign = Object.prototype.hasOwnProperty.call(area, "alignItems");
				if (!hasJustify && !hasAlign) return "";

				const config = this.getAreaLayoutConfig(area);
				const mappedElement = elementsById.get(String(areaId));
				const mappedTag = tagsById.get(String(areaId));
				const groupClass = this.resolveAreaClassName(mappedElement, mappedTag);
				const selector = this.buildAreaContentSelector(rootSelector, groupClass);
				if (!selector) return "";

				const lines = [`${indent}${selector} {`];
				if (hasJustify) {
					const localJustify = config.justifyContent || "center";
					lines.push(`${indent}  justify-self: ${localJustify};`);
				}
				if (hasAlign) {
					const localAlign = config.alignItems || "center";
					lines.push(`${indent}  align-self: ${localAlign};`);
				}
				if (lines.length === 1) return "";
				lines.push(`${indent}}`);
				return lines.join("\n");
			})
			.filter(Boolean);

		return rules.join("\n");
	},

	getHeaderPresetStyleLines(preset) {
		switch (preset) {
			case "preset1":
				return [
					"grid-template-columns: 1fr auto 1fr;",
					"grid-template-rows: 1fr auto;",
					'grid-template-areas: "hometeamemblem versus awayteamemblem" "hometeamneme versus awayteamname";',
				];
			case "preset2":
				return [
					"grid-template-columns: 1fr auto 1fr;",
					"grid-template-rows: auto 1fr;",
					'grid-template-areas: "hometeamneme versus awayteamname" "hometeamemblem versus awayteamemblem";',
				];
			case "preset3":
				return [
					"grid-template-columns: auto 1fr auto 1fr auto;",
					"grid-template-rows: auto;",
					'grid-template-areas: "hometeamneme hometeamemblem versus awayteamemblem awayteamname";',
				];
			case "preset4":
				return [
					"grid-template-columns: 1fr auto auto auto 1fr;",
					"grid-template-rows: auto;",
					'grid-template-areas: "hometeamemblem hometeamneme versus awayteamname awayteamemblem";',
				];
			default:
				return [];
		}
	},

	renderHeaderPresetRules(rootSelector, state, indent = "") {
		const preset = this.getResolutionHeaderPreset(state);
		if (!preset) return "";

		const selector = this.buildAreaContentSelector(rootSelector, "name-emblem");
		const styleLines = this.getHeaderPresetStyleLines(preset);
		if (!selector || !styleLines.length) return "";

		return [
			`${indent}${selector} {`,
			...styleLines.map((line) => `${indent}  ${line}`),
			`${indent}}`,
		].join("\n");
	},

	generateGridTemplate(state, indent = "") {
		const areaNameById = new Map(
			(this.state.elements || []).map((element) => [
				element.id,
				element.gridArea || element.id,
			]),
		);
		const cols = Math.max(1, Number(state?.cols) || 1);
		const rowHeights = Array.isArray(state?.rowHeights) ? state.rowHeights : ["1fr"];
		const inputRows = Array.isArray(state?.gridMatrix) ? state.gridMatrix : [];
		const rows = inputRows.length > 0 ? inputRows : [Array.from({ length: cols }, () => ".")];

		const areaLines = rows
			.map((row) => {
				const normalizedRow = Array.from({ length: cols }, (_, idx) => {
					const rawId = (Array.isArray(row) ? row[idx] : null) || ".";
					if (rawId === ".") return ".";
					return areaNameById.get(rawId) || rawId;
				});
				return `${indent}  "${normalizedRow.join(" ")}"`;
			})
			.join("\n");

		return [
			`${indent}display: grid;`,
			`${indent}grid-template-columns: repeat(${cols}, 1fr);`,
			`${indent}grid-template-rows: ${rowHeights.join(" ")};`,
			`${indent}gap: 8px;`,
			`${indent}grid-template-areas:`,
			`${areaLines};`,
		].join("\n");
	},

	renderGridItemAlignmentRule(rootSelector, state, indent = "") {
		return this.renderAreaSpecificContentRules(rootSelector, state, indent);
	},

	buildCssRangeQuery(atRule, items, idx, dimension = "width") {
		if (!Array.isArray(items) || items.length <= 1) return null;
		const currentValue = Number(items[idx]?.[dimension]);
		if (!Number.isFinite(currentValue)) return null;

		if (idx === 0) {
			const nextValue = Number(items[1]?.[dimension]);
			if (!Number.isFinite(nextValue)) return null;
			return `@${atRule} (min-${dimension}: ${nextValue + 1}px)`;
		}

		if (idx === items.length - 1) {
			return `@${atRule} (max-${dimension}: ${currentValue}px)`;
		}

		const nextValue = Number(items[idx + 1]?.[dimension]);
		if (!Number.isFinite(nextValue)) return null;
		return `@${atRule} (min-${dimension}: ${nextValue + 1}px) and (max-${dimension}: ${currentValue}px)`;
	},

	collectFinishedCssGroups() {
		return this.layoutOrder
			.map((layoutName) => {
				const layoutDefinition = this.layoutDefinitions[layoutName] || {};
				const banners = this.resolutions[layoutName] || [];
				const states = this.state.resolutionStates[layoutName] || [];
				const resolutionsByPair = new Map();
				banners.forEach((res, idx) => {
					const state = states[idx];
					if (!state?.finished) return;
					const width = Number(res?.width);
					const height = Number(res?.height);
					if (!Number.isFinite(width) || !Number.isFinite(height)) return;
					const type = res.type || "custom";
					const device = res.device;
					resolutionsByPair.set(`${width}x${height}:${type}:${device}`, {
						width,
						height,
						type,
						device,
						state,
					});
				});
				const resolutions = [...resolutionsByPair.values()].sort(
					(a, b) => b.width - a.width || b.height - a.height,
				);
				if (!resolutions.length) return null;
				return {
					layoutId: String(layoutDefinition.id || ""),
					resolutions,
				};
			})
			.filter(Boolean);
	},

	renderCssResolutionBlock(rootSelector, resolution, indent = "", areaOverrideMinWidth = null) {
		const justifyItems = resolution?.state?.justifyContent || "center";
		const alignItems = resolution?.state?.alignItems || "center";
		const headerPresetRules = this.renderHeaderPresetRules(
			rootSelector,
			resolution.state,
			indent,
		);
		const rawAreaOverrides = this.renderGridItemAlignmentRule(
			rootSelector,
			resolution.state,
			indent,
		);
		const hasAreaOverrideMinWidth =
			areaOverrideMinWidth !== null && areaOverrideMinWidth !== undefined;
		const minWidth = hasAreaOverrideMinWidth ? Number(areaOverrideMinWidth) : NaN;
		const areaOverrides =
			rawAreaOverrides && Number.isFinite(minWidth)
				? [`${indent}@media (min-width: ${minWidth}px) {`, rawAreaOverrides.replace(/^/gm, `${indent}  `), `${indent}}`].join(
					"\n",
				)
				: rawAreaOverrides;

		return [
			`${indent}${rootSelector} {`,
			this.generateGridTemplate(resolution.state, `${indent}  `),
			`${indent}  justify-items: ${justifyItems};`,
			`${indent}  align-items: ${alignItems};`,
			`${indent}}`,
			headerPresetRules,
			areaOverrides,
		]
			.filter(Boolean)
			.join("\n");
	},

	renderCssHeightBlocks(rootSelector, resolutions, indent = "") {
		return resolutions
			.map((resolution, heightIndex, heightItems) => {
				const heightQuery = this.buildCssRangeQuery(
					"container box",
					heightItems,
					heightIndex,
					"height",
				);
				if (!heightQuery) {
					return this.renderCssResolutionBlock(rootSelector, resolution, indent);
				}

				return [
					`${indent}${heightQuery} {`,
					this.renderCssResolutionBlock(rootSelector, resolution, `${indent}  `),
					`${indent}}`,
				].join("\n");
			})
			.join("\n\n");
	},

	renderCssWidthGroup(rootSelector, widthGroup, widthIndex, widthItems, indent = "", areaOverrideMinWidth = null) {
		const widthQuery = this.buildCssRangeQuery(
			"container box",
			widthItems,
			widthIndex,
			"width",
		);

		if (widthGroup.resolutions.length > 1) {
			const heightBlocks = this.renderCssHeightBlocks(
				rootSelector,
				widthGroup.resolutions,
				`${indent}  `,
			);
			if (!widthQuery) return heightBlocks;
			return [`${indent}${widthQuery} {`, heightBlocks, `${indent}}`].join("\n");
		}

		const rule = this.renderCssResolutionBlock(
			rootSelector,
			widthGroup.resolutions[0],
			`${indent}  `,
			!widthQuery ? areaOverrideMinWidth : null,
		);
		if (!widthQuery) return rule;
		return [`${indent}${widthQuery} {`, rule, `${indent}}`].join("\n");
	},

	renderCssResolutionSet(rootSelector, resolutions, areaOverrideMinWidth = null) {
		if (!resolutions.length) return "";
		const widthGroupsByWidth = new Map();
		resolutions.forEach((resolution) => {
			const widthGroup = widthGroupsByWidth.get(resolution.width) || {
				width: resolution.width,
				resolutions: [],
			};
			widthGroup.resolutions.push(resolution);
			widthGroupsByWidth.set(resolution.width, widthGroup);
		});

		const widthGroups = [...widthGroupsByWidth.values()].sort((a, b) => b.width - a.width);

		return widthGroups
			.map((widthGroup, widthIndex, widthItems) =>
				this.renderCssWidthGroup(
					rootSelector,
					widthGroup,
					widthIndex,
					widthItems,
					"",
					areaOverrideMinWidth,
				),
			)
			.join("\n\n");
	},

	partitionResolutionsByType(resolutions) {
		return resolutions.reduce(
			(acc, resolution) => {
				if (resolution.device === "mobile") {
					acc.mobile.push(resolution);
				} else {
					acc.nonMobile.push(resolution);
				}
				return acc;
			},
			{ mobile: [], nonMobile: [] },
		);
	},

	renderSingleResolutionCss(group, cardSelector) {
		const singleResolution = group?.resolutions?.[0];
		const state = singleResolution?.state;
		const rootSelector = group?.layoutId
			? `[layoutid="${group.layoutId}"] ${cardSelector}`
			: cardSelector;
		if (!state) return "";
		const baseRule = this.renderCssResolutionBlock(rootSelector, singleResolution);
		if (singleResolution?.device === "mobile") {
			return ["@media (max-width: 800px) {", baseRule.replace(/^/gm, "  "), "}"].join("\n");
		}
		return baseRule;
	},

	renderCssGroup(group, cardSelector) {
		const rootSelector = group.layoutId
			? `[layoutid="${group.layoutId}"] ${cardSelector}`
			: cardSelector;
		const partitioned = this.partitionResolutionsByType(group.resolutions);
		const shouldAddNonQueryAreaMedia =
			partitioned.nonMobile.length === 1 && partitioned.mobile.length === 1;

		const blocks = [];
		const nonMobileCss = this.renderCssResolutionSet(
			rootSelector,
			partitioned.nonMobile,
			shouldAddNonQueryAreaMedia ? 801 : null,
		);
		if (nonMobileCss) {
			blocks.push(nonMobileCss);
		}

		const mobileCss = this.renderCssResolutionSet(rootSelector, partitioned.mobile);
		if (mobileCss) {
			blocks.push(
				["@media (max-width: 800px) {", mobileCss.replace(/^/gm, "  "), "}"].join("\n"),
			);
		}

		return blocks.join("\n\n");
	},

	generateCss() {
		const cardSelector = `.box[cardid="${String(this.editorCardId)}"] .stripe`;
		this.refreshFinishedStates();
		const finishedGroups = this.collectFinishedCssGroups();

		const totalFinished = finishedGroups.reduce(
			(sum, group) => sum + group.resolutions.length,
			0,
		);

		if (totalFinished === 1) {
			return this.renderSingleResolutionCss(finishedGroups[0], cardSelector);
		}

		return finishedGroups
			.map((group) => this.renderCssGroup(group, cardSelector))
			.filter(Boolean)
			.join("\n\n");
	},
});
