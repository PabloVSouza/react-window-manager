import { type ReactNode } from 'react';
export type KeyboardShortcut = {
    key?: string;
    code?: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
    preventDefault?: boolean;
    stopPropagation?: boolean;
    enabled?: boolean;
    handler: (event: KeyboardEvent) => void | boolean;
};
type RegisterShortcutsParams = {
    owner: string;
    shortcuts: KeyboardShortcut[];
    global?: boolean;
};
type KeyboardShortcutsContextValue = {
    activeOwner: string | null;
    setActiveOwner: (owner: string | null) => void;
    registerShortcuts: (params: RegisterShortcutsParams) => () => void;
    clearOwnerShortcuts: (owner: string) => void;
};
export declare function KeyboardShortcutsProvider({ children }: {
    children: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function useKeyboardShortcutsManager(): KeyboardShortcutsContextValue;
export declare function KeyboardOwnerProvider({ owner, children }: {
    owner: string;
    children: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
type UseKeyboardShortcutsParams = {
    owner?: string;
    shortcuts: KeyboardShortcut[];
    global?: boolean;
    enabled?: boolean;
};
export declare function useKeyboardShortcuts({ owner, shortcuts, global, enabled }: UseKeyboardShortcutsParams): void;
export {};
//# sourceMappingURL=KeyboardShortcutsProvider.d.ts.map