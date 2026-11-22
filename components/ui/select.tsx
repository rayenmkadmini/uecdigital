"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  icon?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, options, children, icon, id, ...props }, ref) => {
    const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={generatedId}
            className="block text-xs font-semibold text-slate-300"
          >
            {label}
            {props.required && <span className="text-uec-red ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 rtl:left-auto rtl:right-0 rtl:pl-0 rtl:pr-3">
              {icon}
            </div>
          )}
          <select
            id={generatedId}
            ref={ref}
            aria-invalid={!!error}
            className={cn(
              "w-full appearance-none bg-[#111827] text-slate-100 text-xs sm:text-sm rounded-lg border border-[#1F2937] hover:border-slate-700 focus:border-uec-blue focus:ring-1 focus:ring-uec-blue focus:outline-none transition-all duration-150 py-2.5 px-3 pr-9 rtl:pr-3 rtl:pl-9 disabled:opacity-50 disabled:cursor-not-allowed",
              icon ? "pl-9 rtl:pl-3 rtl:pr-9" : "",
              error ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : "",
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="bg-[#111827] text-slate-200 py-1"
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 rtl:right-auto rtl:left-0 rtl:pr-0 rtl:pl-3">
            <ChevronDown size={15} />
          </div>
        </div>
        {error && (
          <p className="text-xs text-rose-400 font-medium" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="text-[11px] text-slate-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
