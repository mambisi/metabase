import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { t } from "ttag";

import CS from "metabase/css/core/index.css";
import {
  Box,
  Button,
  Card,
  Divider,
  Group,
  Icon,
  Stack,
  Text,
} from "metabase/ui";
import type { DatasetColumn, TableRowPinningSetting } from "metabase-types/api";

interface RowPinningRuleListingProps {
  rules: TableRowPinningSetting[];
  cols: DatasetColumn[];
  onEdit: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
}

interface SortableRuleProps {
  id: string;
  index: number;
  rule: TableRowPinningSetting;
  cols: DatasetColumn[];
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
}

const SortableRule = ({
  id,
  index,
  rule,
  cols,
  onEdit,
  onRemove,
}: SortableRuleProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getColumnDisplayName = (columnName: string) => {
    const column = cols.find(col => col.name === columnName);
    return column?.display_name || columnName;
  };

  const getOperatorDisplayText = (operator: string) => {
    const operatorMap: Record<string, string> = {
      "=": t`equal to`,
      "!=": t`not equal to`,
      ">=": t`greater than or equal to`,
      "<=": t`less than or equal to`,
      ">": t`greater than`,
      "<": t`less than`,
      "is-null": t`is empty`,
      "not-null": t`is not empty`,
      contains: t`contains`,
      "does-not-contain": t`does not contain`,
      "starts-with": t`starts with`,
      "ends-with": t`ends with`,
    };
    return operatorMap[operator] || operator;
  };

  const hasValue = rule.operator !== "is-null" && rule.operator !== "not-null";

  const getDescription = () => {
    if (!rule.columnName || !rule.operator) {
      return t`Incomplete rule`;
    }

    const columnName = getColumnDisplayName(rule.columnName);
    const operatorText = getOperatorDisplayText(rule.operator);

    if (hasValue) {
      return t`Pin rows where ${columnName} is ${operatorText} "${rule.value}"`;
    } else {
      return t`Pin rows where ${columnName} ${operatorText}`;
    }
  };

  return (
    <Card ref={setNodeRef} style={style} shadow="xs" p="sm" mb="sm" withBorder>
      <Group position="apart">
        <Box>
          <Group>
            <div {...attributes} {...listeners}>
              <Icon name="grabber" className={CS.cursorGrab} />
            </div>
            <Text>{getDescription()}</Text>
          </Group>
        </Box>
        <Group>
          <Button variant="subtle" compact onClick={() => onEdit(index)}>
            {t`Edit`}
          </Button>
          <Button
            variant="subtle"
            color="red"
            compact
            onClick={() => onRemove(index)}
          >
            {t`Remove`}
          </Button>
        </Group>
      </Group>
    </Card>
  );
};

export const RowPinningRuleListing = ({
  rules,
  cols,
  onEdit,
  onAdd,
  onRemove,
  onMove,
}: RowPinningRuleListingProps) => {
  const items = rules.map((_, index) => index.toString());

  return (
    <Stack>
      <Box>
        <Button variant="outline" onClick={onAdd}>
          {t`Add a rule`}
        </Button>
      </Box>
      <Divider my="xs" />
      {rules.length > 0 ? (
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={event => {
            const { active, over } = event;
            if (over && active.id !== over.id) {
              const fromIndex = Number(active.id);
              const toIndex = Number(over.id);
              onMove(fromIndex, toIndex);
            }
          }}
        >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            {rules.map((rule, index) => (
              <SortableRule
                key={index}
                id={index.toString()}
                index={index}
                rule={rule}
                cols={cols}
                onEdit={onEdit}
                onRemove={onRemove}
              />
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        <Text color="dimmed">{t`No row pinning rules yet. Add one to pin rows to the top of the table.`}</Text>
      )}
    </Stack>
  );
};
