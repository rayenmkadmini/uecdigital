"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, icon, ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-uec-muted rtl:left-auto rtl:right-0 rtl:pl-0 rtl:pr-3.5">
              {icon}
            </div>
          )}
          <input
            type={type}
            ref={ref}
            aria-invalid={!!error}
            className={cn(
              "w-full bg-[#111827] text-uec-text placeholder-uec-muted/50 text-sm rounded-lg border border-uec-border focus:border-uec-blue focus:ring-1 focus:ring-uec-blue focus:outline-none transition-all duration-150 py-2.5 px-3.5",
              icon ? "pl-10 rtl:pl-3.5 rtl:pr-10" : "",
              error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-red-400 font-medium pl-1 rtl:pl-0 rtl:pr-1" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
