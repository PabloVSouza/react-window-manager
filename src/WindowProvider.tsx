import { createContext, useContext, type ReactNode } from 'react'
import { WindowSystemProvider } from './WindowSystemProvider'
import type { WindowRegistry } from './hooks/useOpenWindow'

const WindowRegistryContext = createContext<WindowRegistry | null>(null)

type WindowProviderProps = {
  children: ReactNode
  registry: WindowRegistry
}

export function WindowProvider({ children, registry }: WindowProviderProps) {
  return (
    <WindowRegistryContext.Provider value={registry}>
      <WindowSystemProvider>{children}</WindowSystemProvider>
    </WindowRegistryContext.Provider>
  )
}

export function useWindowRegistry() {
  return useContext(WindowRegistryContext)
}
