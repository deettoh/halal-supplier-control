import React from "react";
import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
} from "react-aria-components";
import { ChevronDown } from "lucide-react";
export function MaterialPicker({ materials, value, onChange, disabled }) {
  return (
    <ComboBox
      className="material-picker"
      defaultItems={materials}
      selectedKey={value}
      onSelectionChange={(key) => onChange(key === null ? null : Number(key))}
      isDisabled={disabled}
    >
      <Label>Material</Label>
      <div className="combo-input">
        <Input placeholder="Find a material, brand or supplier" />
        <Button aria-label="Show materials">
          <ChevronDown size={20} aria-hidden="true" />
        </Button>
      </div>
      <Popover className="material-popover">
        <ListBox renderEmptyState={() => "No matching materials."}>
          {(m) => (
            <ListBoxItem
              id={m.id}
              textValue={
                m.name + " · " + m.approved_brand + " · " + m.supplier_name
              }
            >
              <strong>{m.name}</strong>
              <small>
                {m.approved_brand} · {m.supplier_name}
              </small>
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  );
}
