"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/shared/form-bits";
import { cn } from "@/lib/utils";

export function TextField({
  name,
  label,
  defaultValue,
  errors,
  className,
  hint,
  ...props
}: { name: string; label: string; defaultValue?: string | number | null; errors?: string[]; hint?: string } & Omit<
  React.ComponentProps<typeof Input>,
  "name" | "defaultValue"
>) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue ?? ""} aria-invalid={errors?.length ? true : undefined} {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError errors={errors} />
    </div>
  );
}

export function TextAreaField({
  name,
  label,
  defaultValue,
  errors,
  className,
  rows = 3,
  hint,
}: { name: string; label: string; defaultValue?: string | null; errors?: string[]; className?: string; rows?: number; hint?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} defaultValue={defaultValue ?? ""} rows={rows} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError errors={errors} />
    </div>
  );
}

export function SelectField({
  name,
  label,
  defaultValue,
  options,
  className,
  onValueChange,
  value,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  value?: string;
  options: { value: string; label: string }[];
  className?: string;
  onValueChange?: (v: string) => void;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <Select name={name} defaultValue={defaultValue} value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CheckField({
  name,
  label,
  description,
  defaultChecked,
  checked,
  onCheckedChange,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onCheckedChange?: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary/40 has-[:checked]:bg-secondary/50">
      <Checkbox
        name={name}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        checked={checked}
        onCheckedChange={onCheckedChange ? (v) => onCheckedChange(v === true) : undefined}
        className="mt-0.5"
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}

export const STATUS_OPTIONS = [
  { value: "draft", label: "Rascunho" },
  { value: "published", label: "Publicado" },
  { value: "archived", label: "Arquivado" },
];
