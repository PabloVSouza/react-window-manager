import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useContext } from 'react';
import { WindowManager } from './ui/WindowManager';
import { KeyboardShortcutsProvider } from './shortcuts/KeyboardShortcutsProvider';
import { useWindowManagerStore } from './store/useWindowManagerStore';
const WindowManagerContext = createContext(null);
export function WindowSystemProvider({ children }) {
    const manager = useWindowManagerStore();
    return (_jsx(WindowManagerContext.Provider, { value: manager, children: _jsxs(KeyboardShortcutsProvider, { children: [children, _jsx(WindowManager, {})] }) }));
}
export function useWindowManager() {
    const context = useContext(WindowManagerContext);
    if (!context) {
        throw new Error('useWindowManager must be used within a WindowSystemProvider');
    }
    return context;
}
