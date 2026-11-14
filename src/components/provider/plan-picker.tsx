"use client";
import { ALL_FEATURES, FEATURES, PLAN_NAMES, PLAN_PRESETS, type Feature } from "@/lib/features";
import { FormField } from "@/components/app/form-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export interface PlanValue { plan: string; features: Feature[]; maxStaff: number }

/** The plan fills in the module toggles; changing a toggle by hand turns the plan into "Custom". */
export function PlanPicker({ value, onChange }: { value: PlanValue; onChange: (v: PlanValue) => void }) {
  const choose = (plan: string) => {
    const p = PLAN_PRESETS[plan];
    onChange(p ? { plan, features: [...p.features], maxStaff: p.maxStaff } : { ...value, plan });
  };
  const toggle = (f: Feature, on: boolean) =>
    onChange({ ...value, plan: "Custom", features: ALL_FEATURES.filter((x) => (x === f ? on : value.features.includes(x))) });
  return (
    <div className="grid gap-3 sm:col-span-full sm:grid-cols-2">
      <FormField label="Plan" description="Picks the modules below. You can still switch any of them.">
        <select value={value.plan} onChange={(e) => choose(e.target.value)} className="h-9 w-full rounded-lg border bg-background px-2 text-sm">
          {PLAN_NAMES.map((n) => <option key={n}>{n}</option>)}
        </select>
      </FormField>
      <FormField label="Staff logins" description="0 = unlimited.">
        <Input type="number" min={0} max={1000} value={value.maxStaff} onChange={(e) => onChange({ ...value, plan: "Custom", maxStaff: Math.max(0, Number(e.target.value) || 0) })} />
      </FormField>
      <fieldset className="rounded-xl border p-3 sm:col-span-2">
        <legend className="px-1 text-xs font-medium text-muted-foreground">Modules for this seller (billing, khata, stock and reports are always on)</legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ALL_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/50">
              <Switch id={`feat-${f}`} checked={value.features.includes(f)} onCheckedChange={(on) => toggle(f, on)} />
              <label htmlFor={`feat-${f}`} className="min-w-0 cursor-pointer text-sm">
                <span className="block font-medium">{FEATURES[f].label}</span>
                <span className="block text-xs text-muted-foreground">{FEATURES[f].note}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    </div>
  );
}
