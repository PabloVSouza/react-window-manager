import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '../internal/cn';
const variantClassName = {
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
};
export function IconButton({ variant = 'ghost', className, children, ...props }) {
    return (_jsx("button", { type: "button", className: cn('inline-flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50', variantClassName[variant], className), ...props, children: children }));
}
