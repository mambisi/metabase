import { arrayMove } from "@dnd-kit/sortable";
import { useState } from "react";

import type { DatasetColumn, TableRowPinningSetting } from "metabase-types/api";

import { RowPinningRuleEditor } from "./RowPinningRuleEditor";
import { RowPinningRuleListing } from "./RowPinningRuleListing";
import { DEFAULTS } from "./constants";

export interface ChartSettingsTableRowPinningProps {
  value: TableRowPinningSetting[];
  onChange: (rules: TableRowPinningSetting[]) => void;
  cols: DatasetColumn[];
}

export const ChartSettingsTableRowPinning = ({
  value,
  onChange,
  cols,
}: ChartSettingsTableRowPinningProps) => {
  const [editingRule, setEditingRule] = useState<number | null>(null);
  const [editingRuleIsNew, setEditingRuleIsNew] = useState<boolean | null>(
    null,
  );

  if (editingRule !== null && value[editingRule]) {
    return (
      <RowPinningRuleEditor
        rule={value[editingRule]}
        cols={cols}
        isNew={!!editingRuleIsNew}
        onChange={rule => {
          onChange([
            ...value.slice(0, editingRule),
            rule,
            ...value.slice(editingRule + 1),
          ]);
        }}
        onRemove={() => {
          onChange([
            ...value.slice(0, editingRule),
            ...value.slice(editingRule + 1),
          ]);
          setEditingRule(null);
          setEditingRuleIsNew(null);
        }}
        onDone={() => {
          setEditingRule(null);
          setEditingRuleIsNew(null);
        }}
      />
    );
  } else {
    return (
      <RowPinningRuleListing
        rules={value}
        cols={cols}
        onEdit={index => {
          setEditingRule(index);
          setEditingRuleIsNew(false);
        }}
        onAdd={async () => {
          await onChange([
            {
              ...DEFAULTS,
              // if there's a single column use that by default
              columnName: cols.length === 1 ? cols[0].name : "",
            },
            ...value,
          ]);
          setEditingRuleIsNew(true);
          setEditingRule(0);
        }}
        onRemove={index => {
          onChange([...value.slice(0, index), ...value.slice(index + 1)]);
        }}
        onMove={(from, to) => {
          onChange(arrayMove(value, from, to));
        }}
      />
    );
  }
};
