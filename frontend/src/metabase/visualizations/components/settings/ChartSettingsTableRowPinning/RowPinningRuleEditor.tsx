import { useMemo } from "react";
import { t } from "ttag";

import CS from "metabase/css/core/index.css";
import {
  Box,
  Button,
  Select,
  Stack,
  Text,
  TextInputBlurChange,
} from "metabase/ui";
import type {
  ConditionalFormattingComparisonOperator,
  DatasetColumn,
  TableRowPinningSetting,
} from "metabase-types/api";

interface RowPinningRuleEditorProps {
  rule: TableRowPinningSetting;
  cols: DatasetColumn[];
  isNew?: boolean;
  onChange: (rule: TableRowPinningSetting) => void;
  onDone: () => void;
  onRemove: () => void;
}

export const RowPinningRuleEditor = ({
  rule,
  cols,
  onChange,
  onDone,
  onRemove,
}: RowPinningRuleEditorProps) => {
  const columnOptions = useMemo(() => {
    return cols.map(col => ({
      value: col.name,
      label: col.display_name || col.name,
    }));
  }, [cols]);

  const operators: {
    value: ConditionalFormattingComparisonOperator;
    label: string;
  }[] = [
    { value: "=", label: t`Equal to` },
    { value: "!=", label: t`Not equal to` },
    { value: ">=", label: t`Greater than or equal to` },
    { value: "<=", label: t`Less than or equal to` },
    { value: ">", label: t`Greater than` },
    { value: "<", label: t`Less than` },
    { value: "is-null", label: t`Is empty` },
    { value: "not-null", label: t`Not empty` },
    { value: "contains", label: t`Contains` },
    { value: "does-not-contain", label: t`Does not contain` },
    { value: "starts-with", label: t`Starts with` },
    { value: "ends-with", label: t`Ends with` },
  ];

  // We might need column-specific logic in the future

  const renderValueInput = () => {
    const isEmptyOp =
      rule.operator === "is-null" || rule.operator === "not-null";

    if (isEmptyOp) {
      return null;
    }

    const onValueChange = (value: string) => {
      onChange({
        ...rule,
        value,
      });
    };

    return (
      <TextInputBlurChange
        value={rule.value}
        onChange={e => onValueChange(e.target.value)}
        placeholder={t`Enter a value`}
        className={CS.mt1}
      />
    );
  };

  const isOperatorVisible = rule.columnName !== "";
  const isValueVisible =
    rule.columnName !== "" &&
    rule.operator !== "" &&
    rule.operator !== "is-null" &&
    rule.operator !== "not-null";

  return (
    <Stack>
      <Box>
        <Text fw={700}>{t`Column`}</Text>
        <Select
          data={columnOptions}
          value={rule.columnName}
          onChange={(value: string) => {
            onChange({
              ...rule,
              columnName: value,
            });
          }}
          placeholder={t`Select a column`}
          className={CS.mt1}
        />
      </Box>

      {isOperatorVisible && (
        <Box>
          <Text fw={700}>{t`Operator`}</Text>
          <Select
            data={operators}
            value={rule.operator}
            onChange={(value: ConditionalFormattingComparisonOperator) => {
              onChange({
                ...rule,
                operator: value,
              });
            }}
            placeholder={t`Select an operator`}
            className={CS.mt1}
          />
        </Box>
      )}

      {isValueVisible && (
        <Box>
          <Text fw={700}>{t`Value`}</Text>
          {renderValueInput()}
        </Box>
      )}

      <Box mt="md">
        <Button variant="outline" color="gray" onClick={onDone}>
          {t`Done`}
        </Button>
        <Button variant="subtle" color="red" onClick={onRemove} ml="md">
          {t`Remove`}
        </Button>
      </Box>
    </Stack>
  );
};
