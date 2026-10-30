import type { Row } from "./api";
export type Field = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string | number; label: string }[];
  value?: any;
  min?: string;
  max?: string;
};
export type Dialog = {
  title: string;
  fields: Field[];
  submit: (v: Row) => Promise<void>;
  description?: string;
};
export type OpenForm = (
  title: string,
  fields: Field[],
  submit: Dialog["submit"],
  description?: string,
) => void;
