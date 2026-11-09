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
  /**
   * Fire even while the user is typing in a field (input, textarea, select, combobox,
   * contenteditable). By default a field keeps the keys it uses itself; shortcuts with
   * Ctrl/Alt/Meta, function keys (F1-F24) and Escape still fire there.
   */
  allowInEditable?: boolean
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

const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="textbox"], [role="spinbutton"]'

const NON_EDITABLE_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit'
])

function editableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false
  }

  const editable = target.closest(EDITABLE_SELECTOR)

  if (!editable) {
    return false
  }

  return !(editable instanceof HTMLInputElement && NON_EDITABLE_INPUT_TYPES.has(editable.type))
}

/** Keys the focused element (or an ancestor) handles itself: `data-keys="Enter ArrowDown"`. */
function ownKeys(target: EventTarget | null): string[] {
  if (!(target instanceof Element)) {
    return []
  }

  return target.closest('[data-keys]')?.getAttribute('data-keys')?.split(/\s+/) ?? []
}

function firesWhileEditing(shortcut: KeyboardShortcut): boolean {
  if (shortcut.allowInEditable || shortcut.ctrl || shortcut.alt || shortcut.meta) {
    return true
  }

  const key = shortcut.key ?? shortcut.code ?? ''
  return key === 'Escape' || /^F([1-9]|1[0-9]|2[0-4])$/.test(key)
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
      if (ownKeys(event.target).includes(event.key)) {
        return
      }

      const editing = editableTarget(event.target)
      const globalShortcuts = Array.from(globalShortcutsRef.current.values()).flat()
      const scopedShortcuts = activeOwner ? scopedShortcutsRef.current.get(activeOwner) || [] : []

      const listeners = [...globalShortcuts, ...scopedShortcuts]

      for (let index = listeners.length - 1; index >= 0; index -= 1) {
        const shortcut = listeners[index]

        if (!matchesShortcut(shortcut, event)) {
          continue
        }

        if (editing && !firesWhileEditing(shortcut)) {
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

export function KeyboardOwnerProvider({ owner, children }: { owner: string; children: ReactNode }) {
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
