import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { InPortal, OutPortal } from 'react-reverse-portal';
import { useWindowManager } from '../WindowSystemProvider';
import { KeyboardOwnerProvider } from '../shortcuts/KeyboardShortcutsProvider';
import { Window } from './Window';
import { MinimizedBar } from './MinimizedBar';
export function WindowManager() {
    const containerRef = useRef(null);
    const { windows, setContainerSize, mouseCapture, removeMovingResizing, focusWindow } = useWindowManager();
    useEffect(() => {
        const element = containerRef.current;
        if (!element) {
            return;
        }
        const updateSize = () => {
            const rect = element.getBoundingClientRect();
            setContainerSize({ width: rect.width, height: rect.height });
        };
        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(element);
        window.addEventListener('resize', updateSize);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateSize);
        };
    }, [setContainerSize]);
    const activeWindows = windows.filter((window) => !window.windowStatus.isMinimized);
    const minimizedWindows = windows.filter((window) => window.windowStatus.isMinimized);
    const isInteracting = windows.some((window) => window.windowStatus.isMoving || window.windowStatus.isResizing);
    useEffect(() => {
        if (!isInteracting) {
            return;
        }
        const handleMouseMove = (event) => {
            mouseCapture(event);
        };
        const stopInteraction = () => {
            removeMovingResizing();
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', stopInteraction);
        window.addEventListener('blur', stopInteraction);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', stopInteraction);
            window.removeEventListener('blur', stopInteraction);
        };
    }, [isInteracting, mouseCapture, removeMovingResizing]);
    return (_jsxs("div", { ref: containerRef, className: "pointer-events-none fixed inset-0 z-[100]", children: [windows.map((window) => (_jsx(InPortal, { node: window.portalNode, children: _jsx(KeyboardOwnerProvider, { owner: window.id, children: _jsx("div", { className: "contents", onPointerDownCapture: () => focusWindow(window.id), onMouseDownCapture: () => focusWindow(window.id), children: window.content }) }) }, `portal-${window.id}`))), activeWindows.map((window) => (_jsx(Window, { window: window, children: _jsx(OutPortal, { node: window.portalNode }) }, window.id))), !!minimizedWindows.length && _jsx(MinimizedBar, { windows: minimizedWindows })] }));
}
