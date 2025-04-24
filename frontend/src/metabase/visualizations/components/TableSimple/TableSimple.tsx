import cx from "classnames";
import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import _ from "underscore";

import ExplicitSize from "metabase/components/ExplicitSize";
import { Ellipsified } from "metabase/core/components/Ellipsified";
import CS from "metabase/css/core/index.css";
import DashboardS from "metabase/css/dashboard.module.css";
import { alpha, color } from "metabase/lib/colors";
import EmbedFrameS from "metabase/public/components/EmbedFrame/EmbedFrame.module.css";
import { isColumnRightAligned } from "metabase/visualizations/lib/table";
import type { ClickObject } from "metabase-lib";
import { isID } from "metabase-lib/v1/types/utils/isa";
import type {
  Card,
  DatasetColumn,
  DatasetData,
  RowValue,
  Series,
  VisualizationSettings,
} from "metabase-types/api";

import { TableCell } from "./TableCell";
import {
  ContentContainer,
  Root,
  SortIcon,
  Table,
  TableContainer,
  TableHeaderCellContent,
} from "./TableSimple.styled";

function getBoundingClientRectSafe(ref: {
  current?: HTMLElement | null;
}): Partial<DOMRect> {
  return ref.current?.getBoundingClientRect?.() ?? {};
}

function formatCellValueForSorting(value: RowValue, column: DatasetColumn) {
  if (typeof value === "string") {
    if (isID(column) && /^\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    // for strings we should be case insensitive
    return value.toLowerCase();
  }
  if (value === null) {
    return undefined;
  }
  return value;
}

interface TableSimpleProps {
  card: Card;
  data: DatasetData;
  rawData?: DatasetData; // Original data before column filtering
  series: Series;
  settings: VisualizationSettings;
  height: number;
  isDashboard?: boolean;
  isEditing?: boolean;
  isPivoted: boolean;
  className?: string;
  getColumnTitle: (colIndex: number) => string;
  getExtraDataForClick: (clickObject: ClickObject) => Record<string, unknown>;
  onVisualizationClick?: (clickObject: ClickObject) => void;
  visualizationIsClickable?: (clickObject: ClickObject) => boolean;
}

const TableSimpleInner = forwardRef<HTMLDivElement, TableSimpleProps>(
  function TableSimpleInner(
    {
      data,
      rawData,
      series,
      settings,
      height,
      isPivoted,
      className,
      onVisualizationClick,
      visualizationIsClickable,
      getColumnTitle,
      getExtraDataForClick,
    }: TableSimpleProps,
    ref,
  ) {
    const [pageSize, setPageSize] = useState(100); // Initial page size for faster loading
    const [sortColumn, setSortColumn] = useState<number | null>(null);
    const [sortDirection, setSortDirection] = useState("asc");
    const [visibleRowsCount, setVisibleRowsCount] = useState(100); // Initial visible rows count
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const headerRef = useRef(null);
    const firstRowRef = useRef(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
      const { height: headerHeight = 0 } = getBoundingClientRectSafe(headerRef);
      const { height: rowHeight = 0 } = getBoundingClientRectSafe(firstRowRef);

      if (rowHeight > 0) {
        // Calculate how many rows can fit in the visible area
        const visibleRows = Math.max(
          15,
          Math.floor((height - headerHeight) / rowHeight),
        );

        // Set page size to visible rows + buffer
        setPageSize(visibleRows);
        setVisibleRowsCount(visibleRows);
      }
    }, [height]);

    const setSort = useCallback(
      (colIndex: number) => {
        // Reset to initial visible rows when sorting changes
        setVisibleRowsCount(pageSize);

        if (sortColumn === colIndex) {
          setSortDirection(direction => (direction === "asc" ? "desc" : "asc"));
        } else {
          setSortColumn(colIndex);
        }
      },
      [sortColumn, pageSize],
    );

    const checkIsVisualizationClickable = useCallback(
      (clickedItem: ClickObject) => {
        return Boolean(
          onVisualizationClick &&
            visualizationIsClickable &&
            visualizationIsClickable(clickedItem),
        );
      },
      [onVisualizationClick, visualizationIsClickable],
    );

    const { rows, cols } = data;
    const getCellBackgroundColor = settings["table._cell_background_getter"];

    const rowIndexes = useMemo(() => {
      let indexes = _.range(0, rows.length);

      if (sortColumn != null) {
        indexes = _.sortBy(indexes, rowIndex => {
          const value = rows[rowIndex][sortColumn];
          const column = cols[sortColumn];
          return formatCellValueForSorting(value, column);
        });
      }

      if (sortDirection === "desc") {
        indexes.reverse();
      }

      // Apply conditional row pinning if enabled
      const rowPinningRules = settings["table.row_pinning"] || [];
      if (rowPinningRules.length > 0) {
        // For each row, check if it matches any pinning rule
        const matchesRules = new Set<number>();

        rowPinningRules.forEach(rule => {
          if (!rule.columnName || !rule.operator) {
            return; // Skip incomplete rules
          }

          // Find the column index for this rule
          const columnIndex = cols.findIndex(
            col => col.name === rule.columnName,
          );
          if (columnIndex === -1) {
            return; // Column not found
          }

          // Check each row against this rule
          indexes.forEach(rowIndex => {
            const cellValue = rows[rowIndex][columnIndex];
            let matches = false;

            // Convert rule.value to the appropriate type for comparison
            const ruleValueForComparison = (() => {
              // Try to convert to number if it looks like a number
              if (!isNaN(Number(rule.value)) && rule.value !== "") {
                return Number(rule.value);
              }
              return rule.value;
            })();

            switch (rule.operator) {
              case "=": {
                // Handle type conversion for comparison
                const cellStr = String(cellValue);
                const ruleStr = String(ruleValueForComparison);
                matches = cellStr === ruleStr;
                break;
              }
              case "!=": {
                const cellStrNe = String(cellValue);
                const ruleStrNe = String(ruleValueForComparison);
                matches = cellStrNe !== ruleStrNe;
                break;
              }
              case ">":
                // For these operators, try to ensure numeric comparison
                if (typeof cellValue === "number") {
                  matches = cellValue > Number(ruleValueForComparison);
                } else {
                  matches = String(cellValue) > String(ruleValueForComparison);
                }
                break;
              case "<":
                if (typeof cellValue === "number") {
                  matches = cellValue < Number(ruleValueForComparison);
                } else {
                  matches = String(cellValue) < String(ruleValueForComparison);
                }
                break;
              case ">=":
                if (typeof cellValue === "number") {
                  matches = cellValue >= Number(ruleValueForComparison);
                } else {
                  matches = String(cellValue) >= String(ruleValueForComparison);
                }
                break;
              case "<=":
                if (typeof cellValue === "number") {
                  matches = cellValue <= Number(ruleValueForComparison);
                } else {
                  matches = String(cellValue) <= String(ruleValueForComparison);
                }
                break;
              case "is-null":
                matches = cellValue == null || cellValue === "";
                break;
              case "not-null":
                matches = cellValue != null && cellValue !== "";
                break;
              case "contains":
                matches = String(cellValue).includes(rule.value);
                break;
              case "does-not-contain":
                matches = !String(cellValue).includes(rule.value);
                break;
              case "starts-with":
                matches = String(cellValue).startsWith(rule.value);
                break;
              case "ends-with":
                matches = String(cellValue).endsWith(rule.value);
                break;
            }

            if (matches) {
              matchesRules.add(rowIndex);
            }
          });
        });

        // Sort rows with matching rules to the top
        if (matchesRules.size > 0) {
          const [pinnedRows, unpinnedRows] = _.partition(indexes, index =>
            matchesRules.has(index),
          );
          return [...pinnedRows, ...unpinnedRows];
        }
      }

      return indexes;
    }, [cols, rows, sortColumn, sortDirection, settings]);

    // Get lazy loaded rows based on visible count
    const paginatedRowIndexes = useMemo(() => {
      // If total rows is less than the pageSize, show all rows
      if (rows.length <= visibleRowsCount) {
        return rowIndexes;
      }
      // Otherwise, use lazy loading to show only the visible rows
      return rowIndexes.slice(0, visibleRowsCount);
    }, [rowIndexes, visibleRowsCount, rows.length]);

    // Load more rows when user scrolls
    const handleScroll = useCallback(() => {
      if (isLoadingMore || visibleRowsCount >= rows.length) {
        return;
      }

      const container = tableContainerRef.current;
      if (!container) {
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrolledToBottom = scrollHeight - scrollTop - clientHeight < 200; // Load more when we're 200px from bottom

      if (scrolledToBottom) {
        setIsLoadingMore(true);
        // Using setTimeout to avoid blocking the main thread
        setTimeout(() => {
          setVisibleRowsCount(prev => Math.min(prev + pageSize, rows.length));
          setIsLoadingMore(false);
        }, 100);
      }
    }, [isLoadingMore, visibleRowsCount, rows.length, pageSize]);

    const renderColumnHeader = useCallback(
      (col: DatasetColumn, colIndex: number) => {
        // Skip columns that are only included for pinning
        // Type cast to access the custom property added by Table component
        if (
          (col as DatasetColumn & { visibility_for_pinning_only?: boolean })
            .visibility_for_pinning_only
        ) {
          return null;
        }

        const iconName = sortDirection === "desc" ? "chevrondown" : "chevronup";
        const onClick = () => setSort(colIndex);
        return (
          <th key={colIndex} data-testid="column-header">
            <TableHeaderCellContent
              isSorted={colIndex === sortColumn}
              onClick={onClick}
              isRightAligned={isColumnRightAligned(col)}
            >
              <Ellipsified>{getColumnTitle(colIndex)}</Ellipsified>
              <SortIcon name={iconName} />
            </TableHeaderCellContent>
          </th>
        );
      },
      [sortColumn, sortDirection, getColumnTitle, setSort],
    );

    // Identify pinned rows based on conditional rules
    const getPinnedRowInfo = useCallback(() => {
      // Get all row pinning rules
      const rowPinningRules = settings["table.row_pinning"] || [];
      if (rowPinningRules.length === 0) {
        return {
          isPinned: () => false,
          pinnedColumnIndexes: new Map<number, number>(),
        };
      }

      // For each row, check if it matches any pinning rule
      const pinnedRows = new Map<number, number>(); // rowIndex -> columnIndex that caused pinning

      // Use raw data if available for checking all columns (visible or not)
      const rowsToCheck = rawData ? rawData.rows : data.rows;
      const colsToCheck = rawData ? rawData.cols : data.cols;

      rowPinningRules.forEach(rule => {
        if (!rule.columnName || !rule.operator) {
          return; // Skip incomplete rules
        }

        // Find the column index for this rule in the original data
        const columnIndex = colsToCheck.findIndex(
          col => col.name === rule.columnName,
        );
        if (columnIndex === -1) {
          return; // Column not found
        }

        // Check each row against this rule
        rowIndexes.forEach(rowIndex => {
          // Skip if the row is already pinned by a higher-priority rule
          if (pinnedRows.has(rowIndex)) {
            return;
          }

          // Use the value from the original dataset
          const cellValue = rowsToCheck[rowIndex][columnIndex];
          let matches = false;

          // Convert rule.value to the appropriate type for comparison
          const ruleValueForComparison = (() => {
            // Try to convert to number if it looks like a number
            if (!isNaN(Number(rule.value)) && rule.value !== "") {
              return Number(rule.value);
            }
            return rule.value;
          })();
          switch (rule.operator) {
            case "=": {
              // Handle type conversion for comparison
              const cellStr = String(cellValue);
              const ruleStr = String(ruleValueForComparison);
              matches = cellStr === ruleStr;
              break;
            }
            case "!=": {
              const cellStrNe = String(cellValue);
              const ruleStrNe = String(ruleValueForComparison);
              matches = cellStrNe !== ruleStrNe;
              break;
            }
            case ">":
              // For these operators, try to ensure numeric comparison
              if (typeof cellValue === "number") {
                matches = cellValue > Number(ruleValueForComparison);
              } else {
                matches = String(cellValue) > String(ruleValueForComparison);
              }
              break;
            case "<":
              if (typeof cellValue === "number") {
                matches = cellValue < Number(ruleValueForComparison);
              } else {
                matches = String(cellValue) < String(ruleValueForComparison);
              }
              break;
            case ">=":
              if (typeof cellValue === "number") {
                matches = cellValue >= Number(ruleValueForComparison);
              } else {
                matches = String(cellValue) >= String(ruleValueForComparison);
              }
              break;
            case "<=":
              if (typeof cellValue === "number") {
                matches = cellValue <= Number(ruleValueForComparison);
              } else {
                matches = String(cellValue) <= String(ruleValueForComparison);
              }
              break;
            case "is-null":
              matches = cellValue == null || cellValue === "";
              break;
            case "not-null":
              matches = cellValue != null && cellValue !== "";
              break;
            case "contains":
              matches = String(cellValue).includes(rule.value);
              break;
            case "does-not-contain":
              matches = !String(cellValue).includes(rule.value);
              break;
            case "starts-with":
              matches = String(cellValue).startsWith(rule.value);
              break;
            case "ends-with":
              matches = String(cellValue).endsWith(rule.value);
              break;
          }

          if (matches) {
            pinnedRows.set(rowIndex, columnIndex);
          }
        });
      });

      return {
        isPinned: (rowIdx: number) => pinnedRows.has(rowIdx),
        pinnedColumnIndexes: pinnedRows,
      };
    }, [settings, rowIndexes, rawData, data]);

    const { isPinned, pinnedColumnIndexes } = getPinnedRowInfo();

    // Get all pinned row indexes in order
    const pinnedRowIndexes = useMemo(() => {
      return rowIndexes.filter(idx => isPinned(idx));
    }, [rowIndexes, isPinned]);

    const renderRow = useCallback(
      (rowIndex: number, index: number) => {
        const ref = index === 0 ? firstRowRef : null;
        const rowIsPinned = isPinned(rowIndex);
        const pinnedColumnIndex = pinnedColumnIndexes.get(rowIndex);

        // Calculate the position for this pinned row
        const pinnedRowPosition = rowIsPinned
          ? pinnedRowIndexes.indexOf(rowIndex)
          : -1;

        return (
          <tr
            key={rowIndex}
            ref={ref}
            data-testid="table-row"
            data-allow-page-break-after
            style={
              rowIsPinned
                ? {
                    backgroundColor: "var(--mb-color-bg-light)",
                    position: "sticky",
                    top: `${35 + pinnedRowPosition * 35}px`, // Position based on row order
                    zIndex: 1,
                    boxShadow: `0 1px 2px ${alpha(color("shadow"), 0.1)}`, // Add shadow for visual separation
                  }
                : undefined
            }
          >
            {data.rows[rowIndex].map((value, columnIndex) => {
              // Skip rendering cells for columns that are only for pinning
              // Type cast to access the custom property added by Table component
              if (
                (
                  cols[columnIndex] as DatasetColumn & {
                    visibility_for_pinning_only?: boolean;
                  }
                ).visibility_for_pinning_only
              ) {
                return null;
              }

              return (
                <TableCell
                  key={`${rowIndex}-${columnIndex}`}
                  value={value}
                  data={data}
                  series={series}
                  settings={settings}
                  rowIndex={rowIndex}
                  columnIndex={columnIndex}
                  isPivoted={isPivoted}
                  getCellBackgroundColor={getCellBackgroundColor}
                  getExtraDataForClick={getExtraDataForClick}
                  checkIsVisualizationClickable={checkIsVisualizationClickable}
                  onVisualizationClick={onVisualizationClick}
                  style={
                    rowIsPinned && columnIndex === pinnedColumnIndex
                      ? {
                          fontWeight: "bold",
                        }
                      : undefined
                  }
                />
              );
            })}
          </tr>
        );
      },
      [
        data,
        cols,
        series,
        settings,
        isPivoted,
        checkIsVisualizationClickable,
        getCellBackgroundColor,
        getExtraDataForClick,
        onVisualizationClick,
        firstRowRef,
        isPinned,
        pinnedColumnIndexes,
        pinnedRowIndexes,
      ],
    );

    // Add effect to register scroll event listener
    useLayoutEffect(() => {
      const container = tableContainerRef.current;
      if (!container) {
        return;
      }

      container.addEventListener("scroll", handleScroll);

      return () => {
        container.removeEventListener("scroll", handleScroll);
      };
    }, [handleScroll]);

    return (
      <Root className={className} ref={ref}>
        <ContentContainer>
          <TableContainer
            ref={tableContainerRef}
            className={cx(CS.scrollShow, CS.scrollShowHover)}
          >
            <Table
              className={cx(
                DashboardS.fullscreenNormalText,
                DashboardS.fullscreenNightText,
                EmbedFrameS.fullscreenNightText,
              )}
            >
              <thead ref={headerRef}>
                <tr>
                  {cols
                    .filter(
                      col =>
                        !(
                          col as DatasetColumn & {
                            visibility_for_pinning_only?: boolean;
                          }
                        ).visibility_for_pinning_only,
                    )
                    .map(renderColumnHeader)}
                </tr>
              </thead>
              <tbody>{paginatedRowIndexes.map(renderRow)}</tbody>
            </Table>
            {isLoadingMore && rows.length > visibleRowsCount && (
              <div
                style={{
                  textAlign: "center",
                  padding: "10px",
                  color: "var(--mb-color-text-medium)",
                }}
              >
                Loading more rows...
              </div>
            )}
          </TableContainer>
        </ContentContainer>
      </Root>
    );
  },
);

export const TableSimple = ExplicitSize<TableSimpleProps>({
  refreshMode: props =>
    props.isDashboard && !props.isEditing ? "debounceLeading" : "throttle",
})(TableSimpleInner);
