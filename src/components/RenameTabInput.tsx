import { Input } from "antd";
import type { InputRef } from "antd";

type RenameTabInputProps = {
  inputRef: (node: InputRef | null) => void;
  defaultValue: string;
  onChange: (value: string) => void;
};

export function RenameTabInput({ inputRef, defaultValue, onChange }: RenameTabInputProps) {
  return (
    <Input
      ref={inputRef}
      autoFocus
      defaultValue={defaultValue}
      maxLength={80}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
