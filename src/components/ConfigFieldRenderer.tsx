// HealthVault — Reusable config field renderer for AI provider setup

import type { ProviderConfigField } from '../adapters/types';

interface ConfigFieldRendererProps {
  fields: ProviderConfigField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** CSS classes for input/select backgrounds (default: 'bg-surface-800 border border-surface-600') */
  inputClassName?: string;
  /** CSS classes for labels (default: 'text-sm text-surface-300') */
  labelClassName?: string;
}

export default function ConfigFieldRenderer({
  fields,
  values,
  onChange,
  inputClassName = 'bg-surface-800 border border-surface-600',
  labelClassName = 'text-sm text-surface-300',
}: ConfigFieldRendererProps) {
  return (
    <>
      {fields.map((field) => (
        <div key={field.key}>
          {field.type === 'info' ? (
            <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-lg p-3">
              <p className="text-xs text-yellow-300 font-medium">
                {field.label}
              </p>
              {field.placeholder && (
                <p className="text-xs text-yellow-200/70 mt-1">
                  {field.placeholder}
                </p>
              )}
            </div>
          ) : (
            <>
              <label className={`${labelClassName} block mb-1`}>
                {field.label}
                {field.required && (
                  <span className="text-danger-500 ml-0.5">*</span>
                )}
              </label>
              {field.type === 'select' ? (
                <select
                  value={values[field.key] ?? field.defaultValue ?? ''}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className={`w-full ${inputClassName} rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-primary-500`}
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === 'password' ? 'password' : 'text'}
                  value={values[field.key] ?? ''}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={`w-full ${inputClassName} rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500`}
                />
              )}
            </>
          )}
        </div>
      ))}
    </>
  );
}
