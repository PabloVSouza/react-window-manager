import { createElement, useCallback } from 'react';
import { useWindowManager } from '../WindowSystemProvider';
function generateWindowId(component, unique) {
    if (unique) {
        return component;
    }
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return `${component}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}
export function useOpenWindow(registry) {
    const { openWindow } = useWindowManager();
    return useCallback(({ component, props = {} }) => {
        const definition = registry[component];
        if (!definition) {
            return;
        }
        const { component: Component, windowProps = {}, initialStatus = {} } = definition;
        const windowId = generateWindowId(component, windowProps.unique);
        openWindow({
            ...windowProps,
            id: windowId,
            initialStatus,
            content: createElement(Component, {
                ...props,
                windowId
            })
        });
    }, [openWindow, registry]);
}
