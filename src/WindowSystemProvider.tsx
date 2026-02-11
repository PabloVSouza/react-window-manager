import { createContext, type ReactNode, useContext } from 'react'
import { WindowManager } from './ui/WindowManager'
import { KeyboardShortcutsProvider } from './shortcuts/KeyboardShortcutsProvider'
import { useWindowManagerStore } from './store/useWindowManagerStore'
import type {
  WindowCreateParams,
  WindowInitialStatus,
  WindowInstance,
  WindowManagerStore,
  WindowStartPosition,
  WindowStatus
} from './store/types'

const WindowManagerContext = createContext<WindowManagerStore | null>(null)

export function WindowSystemProvider({ children }: { children: ReactNode }) {
  const manager = useWindowManagerStore()

  return (
    <WindowManagerContext.Provider value={manager}>
      <KeyboardShortcutsProvider>
        {children}
        <WindowManager />
      </KeyboardShortcutsProvider>
    </WindowManagerContext.Provider>
  )
}

export function useWindowManager() {
  const context = useContext(WindowManagerContext)

  if (!context) {
    throw new Error('useWindowManager must be used within a WindowSystemProvider')
  }

  return context
}

export type {
  WindowCreateParams,
  WindowInitialStatus,
  WindowInstance,
  WindowManagerStore as WindowManagerContextValue,
  WindowStartPosition,
  WindowStatus
}
