import type { WindowDefinition, WindowRegistry } from '../hooks/useOpenWindow'

export type WindowModule<TProps extends Record<string, unknown> = Record<string, unknown>> =
  WindowDefinition<TProps>

export type WindowModules = WindowRegistry
