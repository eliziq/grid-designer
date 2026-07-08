Object.assign(GridDesigner.prototype, {
	cssEscapeString(value) {
		return String(value || "")
			.replace(/\\/g, "\\\\")
			.replace(/"/g, '\\"');
	},

	buildAreaContentSelector(rootSelector, gridAreaName) {
		const escapedGridArea = this.cssEscapeString(gridAreaName);
		return `${rootSelector} > [data-grid-area="${escapedGridArea}"]`;
	},

	renderAreaSpecificContentRules(rootSelector, state, indent = "") {
		const areas = state?.areas || {};
		const elementsById = new Map(
			(this.state.elements || []).map((element) => [String(element.id), element]),
		);
		const globalJustify = state?.justifyContent || "center";
		const globalAlign = state?.alignItems || "center";

		const rules = Object.entries(areas)
			.map(([areaId, area]) => {
				if (!area || typeof area !== "object") return "";

				const hasJustify = Object.prototype.hasOwnProperty.call(area, "justifyContent");
				const hasAlign = Object.prototype.hasOwnProperty.call(area, "alignItems");
				if (!hasJustify && !hasAlign) return "";

				const config = this.getAreaLayoutConfig(area, state);
				const mappedElement = elementsById.get(String(areaId));
				const gridAreaName = mappedElement?.gridArea || mappedElement?.id || areaId;
				const selector = this.buildAreaContentSelector(rootSelector, gridAreaName);

				const lines = [`${indent}${selector} {`];
				if (hasJustify) {
					const localJustify = config.justifyContent || "center";
					if (localJustify !== globalJustify) {
						lines.push(`${indent}  justify-self: ${localJustify};`);
					}
				}
				if (hasAlign) {
					const localAlign = config.alignItems || "center";
					if (localAlign !== globalAlign) {
						lines.push(`${indent}  align-self: ${localAlign};`);
					}
				}
				if (lines.length === 1) return "";
				lines.push(`${indent}}`);
				return lines.join("\n");
			})
			.filter(Boolean);

		return rules.join("\n");
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
					const type = String(res?.type || "custom");
					resolutionsByPair.set(`${width}x${height}:${type}`, {
						width,
						height,
						type,
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

	renderCssResolutionBlock(rootSelector, resolution, indent = "") {
		const justifyItems = resolution?.state?.justifyContent || "center";
		const alignItems = resolution?.state?.alignItems || "center";
		const areaOverrides = this.renderGridItemAlignmentRule(rootSelector, resolution.state, indent);

		return [
			`${indent}${rootSelector} {`,
			this.generateGridTemplate(resolution.state, `${indent}  `),
			`${indent}  justify-items: ${justifyItems};`,
			`${indent}  align-items: ${alignItems};`,
			`${indent}}`,
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

	renderCssWidthGroup(rootSelector, widthGroup, widthIndex, widthItems, indent = "") {
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
		);
		if (!widthQuery) return rule;
		return [`${indent}${widthQuery} {`, rule, `${indent}}`].join("\n");
	},

	renderCssResolutionSet(rootSelector, resolutions) {
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
				this.renderCssWidthGroup(rootSelector, widthGroup, widthIndex, widthItems),
			)
			.join("\n\n");
	},

	partitionResolutionsByType(resolutions) {
		return resolutions.reduce(
			(acc, resolution) => {
				if (resolution.type === "mobile") {
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
		if (singleResolution?.type === "mobile") {
			return ["@media (max-width: 800px) {", baseRule.replace(/^/gm, "  "), "}"].join("\n");
		}
		return baseRule;
	},

	renderCssGroup(group, cardSelector) {
		const rootSelector = group.layoutId
			? `[layoutid="${group.layoutId}"] ${cardSelector}`
			: cardSelector;
		const partitioned = this.partitionResolutionsByType(group.resolutions);

		const blocks = [];
		const nonMobileCss = this.renderCssResolutionSet(rootSelector, partitioned.nonMobile);
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
