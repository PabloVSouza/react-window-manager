import { createContext, type ReactNode, useContext, useState, useSyncExternalStore } from 'react'
import { WindowManager as WindowDesktop } from './ui/WindowManager'
import { KeyboardShortcutsProvider } from './shortcuts/KeyboardShortcutsProvider'
import { createWindowManager } from './store/createWindowManager'
import type {
  WindowCreateParams,
  WindowInitialStatus,
  WindowInstance,
  WindowManager,
  WindowManagerStore,
  WindowStartPosition,
  WindowStatus
} from './store/types'

const WindowManagerContext = createContext<WindowManagerStore | null>(null)

type WindowSystemProviderProps = {
  children: ReactNode
  /**
   * A manager from `createWindowManager()`, to open and close windows outside React too.
   * Without one, the provider creates its own.
   */
  manager?: WindowManager
  /**
   * Render the desktop (the layer the windows live in) over the whole viewport. Pass false to
   * place `<WindowDesktop />` yourself, inside your layout.
   */
  renderDesktop?: boolean
}

export function WindowSystemProvider({
  children,
  manager,
  renderDesktop = true
}: WindowSystemProviderProps) {
  const [ownManager] = useState(() => manager ?? createWindowManager())
  const store = manager ?? ownManager
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)

  return (
    <WindowManagerContext.Provider value={state}>
      <KeyboardShortcutsProvider>
        {children}
        {renderDesktop && <WindowDesktop />}
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

export { WindowDesktop, createWindowManager }

export type {
  WindowCreateParams,
  WindowInitialStatus,
  WindowInstance,
  WindowManager,
  WindowManagerStore as WindowManagerContextValue,
  WindowStartPosition,
  WindowStatus
}
