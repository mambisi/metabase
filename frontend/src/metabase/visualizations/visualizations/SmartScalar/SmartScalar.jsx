/* eslint-disable react/prop-types */
import cx from "classnames";
import { useEffect, useMemo, useRef } from "react";
import { t } from "ttag";

import DashboardS from "metabase/css/dashboard.module.css";
import { getIsNightMode } from "metabase/dashboard/selectors";
import { color, lighten } from "metabase/lib/colors";
import { formatValue } from "metabase/lib/formatting/value";
import { useSelector } from "metabase/lib/redux";
import { isEmpty } from "metabase/lib/validate";
import EmbedFrameS from "metabase/public/components/EmbedFrame/EmbedFrame.module.css";
import { Box, Flex, Text, Tooltip, useMantineTheme } from "metabase/ui";
import ScalarValue, {
  ScalarWrapper,
} from "metabase/visualizations/components/ScalarValue";
import { compactifyValue } from "metabase/visualizations/lib/scalar_utils";
import { columnSettings } from "metabase/visualizations/lib/settings/column";
import { fieldSetting } from "metabase/visualizations/lib/settings/utils";
import {
  getDefaultSize,
  getMinSize,
} from "metabase/visualizations/shared/utils/sizes";
import { isNumeric } from "metabase-lib/v1/types/utils/isa";

import { ScalarContainer } from "../Scalar/Scalar.styled";

import { SmartScalarComparisonWidget } from "./SettingsComponents/SmartScalarSettingsWidgets";
import { VariationIcon, VariationValue } from "./SmartScalar.styled";
import { CHANGE_TYPE_OPTIONS, computeTrend } from "./compute";
import {
  DASHCARD_HEADER_HEIGHT,
  ICON_SIZE,
  MAX_COMPARISONS,
  TOOLTIP_ICON_SIZE,
  VIZ_SETTINGS_DEFAULTS,
} from "./constants";
import {
  formatChangeAutoPrecision,
  getChangeWidth,
  getColumnsForComparison,
  getComparisonOptions,
  getComparisons,
  getDefaultComparison,
  getValueHeight,
  getValueWidth,
  isSuitableScalarColumn,
  validateComparisons,
} from "./utils";

export function SmartScalar({
  onVisualizationClick,
  isDashboard,
  settings,
  visualizationIsClickable,
  series,
  rawSeries,
  gridSize,
  width,
  height,
  totalNumGridCols,
  fontFamily,
  onRenderError,
}) {
  const scalarRef = useRef(null);

  const insights = rawSeries?.[0].data?.insights;
  const { trend, error } = useMemo(
    () =>
      computeTrend(series, insights, settings, {
        formatValue,
        getColor: color,
      }),
    [series, insights, settings],
  );

  useEffect(() => {
    if (error) {
      onRenderError(error.message);
    }
  }, [error, onRenderError]);

  if (trend == null) {
    return null;
  }

  const { value, clicked, comparisons, formatOptions } = trend;

  const innerHeight = isDashboard ? height - DASHCARD_HEADER_HEIGHT : height;

  const isClickable = onVisualizationClick != null;

  const handleClick = () => {
    if (
      scalarRef.current &&
      onVisualizationClick &&
      visualizationIsClickable(clicked)
    ) {
      onVisualizationClick({ ...clicked, element: scalarRef.current });
    }
  };

  const { displayValue, fullScalarValue } = compactifyValue(
    value,
    width,
    formatOptions,
  );

  return (
    <ScalarWrapper>
      <ScalarContainer
        className={cx(
          DashboardS.fullscreenNormalText,
          DashboardS.fullscreenNightText,
          EmbedFrameS.fullscreenNightText,
        )}
        data-testid="scalar-container"
        tooltip={fullScalarValue}
        alwaysShowTooltip={fullScalarValue !== displayValue}
        isClickable={isClickable}
      >
        <span onClick={handleClick} ref={scalarRef}>
          <ScalarValue
            fontFamily={fontFamily}
            gridSize={gridSize}
            height={getValueHeight(innerHeight)}
            totalNumGridCols={totalNumGridCols}
            value={displayValue}
            width={getValueWidth(width)}
          />
        </span>
      </ScalarContainer>
      {comparisons.map((comparison, index) => (
        <Box maw="100%" key={index} data-testid="scalar-previous-value">
          <PreviousValueComparison
            comparison={comparison}
            fontFamily={fontFamily}
            formatOptions={formatOptions}
            width={width}
          />
        </Box>
      ))}
    </ScalarWrapper>
  );
}

function PreviousValueComparison({
  comparison,
  width,
  fontFamily,
  formatOptions,
}) {
  const {
    changeType,
    percentChange,
    comparisonDescStr,
    comparisonValue,
    changeArrowIconName,
    changeColor,
    display,
  } = comparison;

  // Get the current value from parent component
  const currentValue = formatOptions._currentValue;

  const theme = useMantineTheme();
  const isNightMode = useSelector(getIsNightMode);

  const fittedChangeDisplay =
    changeType === CHANGE_TYPE_OPTIONS.CHANGED.CHANGE_TYPE
      ? formatChangeAutoPrecision(percentChange, {
          fontFamily,
          fontWeight: 900,
          width: getChangeWidth(width),
        })
      : display.percentChange;

  const VariationPercent = ({ inTooltip, iconSize, children }) => {
    const noChangeColor =
      inTooltip || isNightMode
        ? lighten(theme.fn.themeColor("text-medium"), 0.3)
        : "text-light";

    return (
      <Flex align="center" maw="100%" c={changeColor ?? noChangeColor}>
        {changeArrowIconName && (
          <VariationIcon name={changeArrowIconName} size={iconSize} />
        )}
        <VariationValue showTooltip={false}>{children}</VariationValue>
      </Flex>
    );
  };

  // Enhanced tooltip showing both current and comparison values
  const tooltipContent = (() => {
    const hasComparisonValue = !isEmpty(comparisonValue);
    const hasCurrentValue = !isEmpty(currentValue);

    if (!hasCurrentValue && !hasComparisonValue) {
      return (
        <Box>
          <Text c="var(--mb-color-tooltip-text-main)">
            No comparison data available
          </Text>
        </Box>
      );
    }

    return (
      <Box>
        <Flex direction="column" gap="xs">
          {hasCurrentValue && (
            <Flex align="center" justify="space-between" gap="md">
              <Text
                fw={600}
                c="var(--mb-color-tooltip-text-main)"
                component="span"
              >
                Current:
              </Text>
              <Text c="var(--mb-color-tooltip-text-main)" component="span">
                {formatValue(currentValue, formatOptions)}
              </Text>
            </Flex>
          )}
          {hasComparisonValue && (
            <Flex align="center" justify="space-between" gap="md">
              <Text
                fw={600}
                c="var(--mb-color-tooltip-text-main)"
                component="span"
              >
                {comparisonDescStr || "Comparison"}:
              </Text>
              <Text c="var(--mb-color-tooltip-text-main)" component="span">
                {display.comparisonValue ||
                  formatValue(comparisonValue, formatOptions)}
              </Text>
            </Flex>
          )}
          {(hasCurrentValue || hasComparisonValue) &&
            changeType === CHANGE_TYPE_OPTIONS.CHANGED.CHANGE_TYPE && (
              <Flex align="center" justify="space-between" gap="md">
                <Text
                  fw={600}
                  c="var(--mb-color-tooltip-text-main)"
                  component="span"
                >
                  Difference:
                </Text>
                <VariationPercent iconSize={TOOLTIP_ICON_SIZE} inTooltip>
                  {display.percentChange}
                </VariationPercent>
              </Flex>
            )}
        </Flex>
      </Box>
    );
  })();

  return (
    <Tooltip position="bottom" label={tooltipContent} withArrow>
      <Flex
        wrap="wrap"
        align="center"
        justify="center"
        mx="sm"
        lh="1.2rem"
        className={cx(
          DashboardS.fullscreenNormalText,
          DashboardS.fullscreenNightText,
          EmbedFrameS.fullscreenNightText,
        )}
      >
        <VariationPercent iconSize={ICON_SIZE}>
          {fittedChangeDisplay}
        </VariationPercent>
      </Flex>
    </Tooltip>
  );
}

Object.assign(SmartScalar, {
  uiName: t`Trend`,
  identifier: "smartscalar",
  iconName: "smartscalar",
  canSavePng: true,

  minSize: getMinSize("smartscalar"),
  defaultSize: getDefaultSize("smartscalar"),

  settings: {
    ...fieldSetting("scalar.field", {
      section: t`Data`,
      title: t`Primary number`,
      fieldFilter: isSuitableScalarColumn,
    }),
    "scalar.comparisons": {
      section: t`Data`,
      title: t`Comparisons`,
      widget: SmartScalarComparisonWidget,
      getValue: (series, vizSettings) => getComparisons(series, vizSettings),
      isValid: (series, vizSettings) =>
        validateComparisons(series, vizSettings),
      getDefault: (series, vizSettings) =>
        getDefaultComparison(series, vizSettings),
      getProps: (series, vizSettings) => {
        const cols = series[0].data.cols;
        return {
          maxComparisons: MAX_COMPARISONS,
          comparableColumns: getColumnsForComparison(cols, vizSettings),
          options: getComparisonOptions(series, vizSettings),
          series,
          settings: vizSettings,
        };
      },
      readDependencies: ["scalar.field"],
    },
    "scalar.switch_positive_negative": {
      section: t`Display`,
      title: t`Switch positive / negative colors?`,
      widget: "toggle",
      inline: true,
      default: VIZ_SETTINGS_DEFAULTS["scalar.switch_positive_negative"],
    },
    "scalar.compact_primary_number": {
      section: t`Display`,
      title: t`Compact number`,
      widget: "toggle",
      inline: true,
      default: VIZ_SETTINGS_DEFAULTS["scalar.compact_primary_number"],
    },
    ...columnSettings({
      section: t`Display`,
      getColumns: (
        [
          {
            data: { cols },
          },
        ],
        settings,
      ) => [
        // try and find a selected field setting
        cols.find(col => col.name === settings["scalar.field"]) ||
          // fall back to the second column
          cols[1] ||
          // but if there's only one column use that
          cols[0],
      ],
      readDependencies: ["scalar.field"],
    }),
    click_behavior: {},
  },

  // Scalar visualizations are now sensible for any numeric data
  isSensible({ cols }) {
    if (!cols || !Array.isArray(cols)) {
      return false;
    }
    return cols.some(col => isNumeric(col));
  },

  // Check that we have at least one numeric column that can be displayed
  checkRenderable([{ data: { cols, rows } = {} } = {}], settings) {
    if (!cols || !Array.isArray(cols)) {
      throw new Error(t`No data available to display`);
    }

    const hasSuitableColumns = cols.some(col => isNumeric(col));
    if (!hasSuitableColumns) {
      throw new Error(
        t`This visualization requires at least one numeric column`,
      );
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      throw new Error(t`No data available to display`);
    }
  },
});
