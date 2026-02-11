import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowManager } from '../WindowSystemProvider';
const KeyboardShortcutsContext = createContext(null);
const KeyboardOwnerContext = createContext(null);
function normalizeKey(value) {
    return value.length === 1 ? value.toLowerCase() : value;
}
function matchesShortcut(shortcut, event) {
    if (shortcut.enabled === false) {
        return false;
    }
    if (shortcut.code && shortcut.code !== event.code) {
        return false;
    }
    if (shortcut.key && normalizeKey(shortcut.key) !== normalizeKey(event.key)) {
        return false;
    }
    if ((shortcut.ctrl ?? false) !== event.ctrlKey) {
        return false;
    }
    if ((shortcut.alt ?? false) !== event.altKey) {
        return false;
    }
    if ((shortcut.shift ?? false) !== event.shiftKey) {
        return false;
    }
    if ((shortcut.meta ?? false) !== event.metaKey) {
        return false;
    }
    return true;
}
export function KeyboardShortcutsProvider({ children }) {
    const { windows } = useWindowManager();
    const [manualOwner, setManualOwner] = useState(null);
    const [windowOwner, setWindowOwner] = useState(null);
    const scopedShortcutsRef = useRef(new Map());
    const globalShortcutsRef = useRef(new Map());
    const activeOwner = manualOwner ?? windowOwner;
    useEffect(() => {
        const focusedWindow = windows.find((window) => window.windowStatus.isFocused && !window.windowStatus.isMinimized);
        setWindowOwner(focusedWindow?.id ?? null);
    }, [windows]);
    const registerShortcuts = useCallback(({ owner, shortcuts, global }) => {
        const targetMap = global ? globalShortcutsRef.current : scopedShortcutsRef.current;
        targetMap.set(owner, shortcuts);
        return () => {
            targetMap.delete(owner);
        };
    }, []);
    const clearOwnerShortcuts = useCallback((owner) => {
        scopedShortcutsRef.current.delete(owner);
        globalShortcutsRef.current.delete(owner);
    }, []);
    useEffect(() => {
        const onKeyDown = (event) => {
            const globalShortcuts = Array.from(globalShortcutsRef.current.values()).flat();
            const scopedShortcuts = activeOwner
                ? scopedShortcutsRef.current.get(activeOwner) || []
                : [];
            const listeners = [...globalShortcuts, ...scopedShortcuts];
            for (let index = listeners.length - 1; index >= 0; index -= 1) {
                const shortcut = listeners[index];
                if (!matchesShortcut(shortcut, event)) {
                    continue;
                }
                const handled = shortcut.handler(event);
                if (shortcut.preventDefault || handled === true) {
                    event.preventDefault();
                }
                if (shortcut.stopPropagation || handled === true) {
                    event.stopPropagation();
                }
                break;
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [activeOwner]);
    const contextValue = useMemo(() => ({
        activeOwner,
        setActiveOwner: setManualOwner,
        registerShortcuts,
        clearOwnerShortcuts
    }), [activeOwner, registerShortcuts, clearOwnerShortcuts]);
    return (_jsx(KeyboardShortcutsContext.Provider, { value: contextValue, children: children }));
}
export function useKeyboardShortcutsManager() {
    const context = useContext(KeyboardShortcutsContext);
    if (!context) {
        throw new Error('useKeyboardShortcutsManager must be used within KeyboardShortcutsProvider');
    }
    return context;
}
export function KeyboardOwnerProvider({ owner, children }) {
    return _jsx(KeyboardOwnerContext.Provider, { value: owner, children: children });
}
function generateListenerOwnerId() {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return `shortcut-${globalThis.crypto.randomUUID()}`;
    }
    return `shortcut-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}
export function useKeyboardShortcuts({ owner, shortcuts, global = false, enabled = true }) {
    const { activeOwner, registerShortcuts } = useKeyboardShortcutsManager();
    const contextOwner = useContext(KeyboardOwnerContext);
    const fallbackOwnerRef = useRef(generateListenerOwnerId());
    useEffect(() => {
        if (!enabled) {
            return;
        }
        const resolvedOwner = global
            ? owner || contextOwner || fallbackOwnerRef.current
            : owner || contextOwner || activeOwner;
        if (!resolvedOwner) {
            return;
        }
        return registerShortcuts({ owner: resolvedOwner, shortcuts, global });
    }, [owner, contextOwner, activeOwner, shortcuts, global, enabled, registerShortcuts]);
}
