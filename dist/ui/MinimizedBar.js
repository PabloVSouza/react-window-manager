import { jsx as _jsx } from "react/jsx-runtime";
import { MinimizedItem } from './MinimizedItem';
export function MinimizedBar({ windows }) {
    return (_jsx("footer", { className: "pointer-events-auto absolute bottom-0 left-0 z-70 flex w-full items-center gap-2 overflow-x-auto  p-2", children: [...windows].reverse().map((window) => (_jsx(MinimizedItem, { id: window.id, title: window.title }, window.id))) }));
}
