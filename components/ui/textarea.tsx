"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showCount?: boolean;
  maxLength?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      showCount,
      maxLength,
      value,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const currentLength = typeof value === "string" ? value.length : 0;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <div className="flex items-center justify-between">
            <label
              htmlFor={generatedId}
              className="block text-xs font-semibold text-slate-300"
            >
              {label}
              {props.required && <span className="text-uec-red ml-1">*</span>}
            </label>
            {showCount && maxLength && (
              <span className="text-[10px] text-slate-500 font-mono">
                {currentLength}/{maxLength}
              </span>
            )}
          </div>
        )}
        <textarea
          id={generatedId}
          ref={ref}
          value={value}
          maxLength={maxLength}
          aria-invalid={!!error}
          className={cn(
            "w-full bg-[#111827] text-slate-100 placeholder-slate-500 text-xs sm:text-sm rounded-lg border border-[#1F2937] hover:border-slate-700 focus:border-uec-blue focus:ring-1 focus:ring-uec-blue focus:outline-none transition-all duration-150 p-3 min-h-[90px] resize-y leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed",
            error ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : "",
            className
          )}
          {...props}
        />
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

Textarea.displayName = "Textarea";
