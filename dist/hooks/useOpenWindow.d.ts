import { type ComponentType } from 'react';
import type { WindowCreateParams, WindowInitialStatus } from '../store/types';
type WindowComponent<TProps extends Record<string, unknown>> = ComponentType<TProps>;
export type WindowDefinition<TProps extends Record<string, unknown> = Record<string, unknown>> = {
    component: WindowComponent<TProps>;
    windowProps?: Omit<WindowCreateParams, 'id' | 'content' | 'initialStatus'>;
    initialStatus?: WindowInitialStatus;
};
export type WindowRegistry = Record<string, WindowDefinition>;
type OpenWindowParams<TKey extends string> = {
    component: TKey;
    props?: Record<string, unknown>;
};
export declare function useOpenWindow<TRegistry extends WindowRegistry>(registry: TRegistry): <TKey extends keyof TRegistry & string>({ component, props }: OpenWindowParams<TKey>) => void;
export {};
//# sourceMappingURL=useOpenWindow.d.ts.map