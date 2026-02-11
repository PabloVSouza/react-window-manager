import type { ButtonHTMLAttributes, ReactNode } from 'react';
type IconButtonVariant = 'ghost' | 'secondary' | 'destructive';
type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: IconButtonVariant;
    children: ReactNode;
};
export declare function IconButton({ variant, className, children, ...props }: IconButtonProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=IconButton.d.ts.map