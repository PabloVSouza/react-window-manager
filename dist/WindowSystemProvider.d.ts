import { type ReactNode } from 'react';
import type { WindowCreateParams, WindowInitialStatus, WindowInstance, WindowManagerStore, WindowStartPosition, WindowStatus } from './store/types';
export declare function WindowSystemProvider({ children }: {
    children: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function useWindowManager(): WindowManagerStore;
export type { WindowCreateParams, WindowInitialStatus, WindowInstance, WindowManagerStore as WindowManagerContextValue, WindowStartPosition, WindowStatus };
//# sourceMappingURL=WindowSystemProvider.d.ts.map