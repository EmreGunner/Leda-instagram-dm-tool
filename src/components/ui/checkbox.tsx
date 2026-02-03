"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CheckboxProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, checked, onCheckedChange, ...props }, ref) => (
        <div
            className={cn(
                "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground relative bg-background",
                className
            )}
            onClick={() => onCheckedChange?.(!checked)}
        >
            <input
                type="checkbox"
                className="sr-only"
                ref={ref}
                checked={checked}
                onChange={(e) => onCheckedChange?.(e.target.checked)}
                readOnly // We handle click on parent div for custom styling
                {...props}
            />
            <div className={cn(
                "flex items-center justify-center w-full h-full text-current pointer-events-none transition-opacity",
                checked ? "opacity-100" : "opacity-0"
            )}>
                <Check className="h-3 w-3" />
            </div>
        </div>
    )
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
