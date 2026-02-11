import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useWindowManager } from '../WindowSystemProvider'

export type KeyboardShortcut = {
  key?: string
  code?: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
  preventDefault?: boolean
  stopPropagation?: boolean
  enabled?: boolean
  handler: (event: KeyboardEvent) => void | boolean
}

type RegisterShortcutsParams = {
  owner: string
  shortcuts: KeyboardShortcut[]
  global?: boolean
}

type KeyboardShortcutsContextValue = {
  activeOwner: string | null
  setActiveOwner: (owner: string | null) => void
  registerShortcuts: (params: RegisterShortcutsParams) => () => void
  clearOwnerShortcuts: (owner: string) => void
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null)
const KeyboardOwnerContext = createContext<string | null>(null)

function normalizeKey(value: string): string {
  return value.length === 1 ? value.toLowerCase() : value
}

function matchesShortcut(shortcut: KeyboardShortcut, event: KeyboardEvent): boolean {
  if (shortcut.enabled === false) {
    return false
  }

  if (shortcut.code && shortcut.code !== event.code) {
    return false
  }

  if (shortcut.key && normalizeKey(shortcut.key) !== normalizeKey(event.key)) {
    return false
  }

  if ((shortcut.ctrl ?? false) !== event.ctrlKey) {
    return false
  }

  if ((shortcut.alt ?? false) !== event.altKey) {
    return false
  }

  if ((shortcut.shift ?? false) !== event.shiftKey) {
    return false
  }

  if ((shortcut.meta ?? false) !== event.metaKey) {
    return false
  }

  return true
}

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const { windows } = useWindowManager()
  const [manualOwner, setManualOwner] = useState<string | null>(null)
  const [windowOwner, setWindowOwner] = useState<string | null>(null)

  const scopedShortcutsRef = useRef<Map<string, KeyboardShortcut[]>>(new Map())
  const globalShortcutsRef = useRef<Map<string, KeyboardShortcut[]>>(new Map())

  const activeOwner = manualOwner ?? windowOwner

  useEffect(() => {
    const focusedWindow = windows.find(
      (window) => window.windowStatus.isFocused && !window.windowStatus.isMinimized
    )

    setWindowOwner(focusedWindow?.id ?? null)
  }, [windows])

  const registerShortcuts = useCallback(({ owner, shortcuts, global }: RegisterShortcutsParams) => {
    const targetMap = global ? globalShortcutsRef.current : scopedShortcutsRef.current
    targetMap.set(owner, shortcuts)

    return () => {
      targetMap.delete(owner)
    }
  }, [])

  const clearOwnerShortcuts = useCallback((owner: string) => {
    scopedShortcutsRef.current.delete(owner)
    globalShortcutsRef.current.delete(owner)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const globalShortcuts = Array.from(globalShortcutsRef.current.values()).flat()
      const scopedShortcuts = activeOwner
        ? scopedShortcutsRef.current.get(activeOwner) || []
        : []

      const listeners = [...globalShortcuts, ...scopedShortcuts]

      for (let index = listeners.length - 1; index >= 0; index -= 1) {
        const shortcut = listeners[index]

        if (!matchesShortcut(shortcut, event)) {
          continue
        }

        const handled = shortcut.handler(event)

        if (shortcut.preventDefault || handled === true) {
          event.preventDefault()
        }

        if (shortcut.stopPropagation || handled === true) {
          event.stopPropagation()
        }

        break
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [activeOwner])

  const contextValue = useMemo<KeyboardShortcutsContextValue>(
    () => ({
      activeOwner,
      setActiveOwner: setManualOwner,
      registerShortcuts,
      clearOwnerShortcuts
    }),
    [activeOwner, registerShortcuts, clearOwnerShortcuts]
  )

  return (
    <KeyboardShortcutsContext.Provider value={contextValue}>
      {children}
    </KeyboardShortcutsContext.Provider>
  )
}

export function useKeyboardShortcutsManager() {
  const context = useContext(KeyboardShortcutsContext)

  if (!context) {
    throw new Error('useKeyboardShortcutsManager must be used within KeyboardShortcutsProvider')
  }

  return context
}

export function KeyboardOwnerProvider({
  owner,
  children
}: {
  owner: string
  children: ReactNode
}) {
  return <KeyboardOwnerContext.Provider value={owner}>{children}</KeyboardOwnerContext.Provider>
}

type UseKeyboardShortcutsParams = {
  owner?: string
  shortcuts: KeyboardShortcut[]
  global?: boolean
  enabled?: boolean
}

function generateListenerOwnerId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `shortcut-${globalThis.crypto.randomUUID()}`
  }

  return `shortcut-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

export function useKeyboardShortcuts({
  owner,
  shortcuts,
  global = false,
  enabled = true
}: UseKeyboardShortcutsParams) {
  const { activeOwner, registerShortcuts } = useKeyboardShortcutsManager()
  const contextOwner = useContext(KeyboardOwnerContext)
  const fallbackOwnerRef = useRef(generateListenerOwnerId())

  useEffect(() => {
    if (!enabled) {
      return
    }

    const resolvedOwner = global
      ? owner || contextOwner || fallbackOwnerRef.current
      : owner || contextOwner || activeOwner

    if (!resolvedOwner) {
      return
    }

    return registerShortcuts({ owner: resolvedOwner, shortcuts, global })
  }, [owner, contextOwner, activeOwner, shortcuts, global, enabled, registerShortcuts])
}
