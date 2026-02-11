# @comic-universe/react-window-manager

Window manager for React apps with:

- Draggable/resizable/minimizable windows
- Portal-based rendering (inactive/minimized windows do not interfere with content flow)
- Focus/z-index management
- Scoped keyboard shortcuts by focused window
- Optional global shortcuts

## Installation

```bash
npm install @comic-universe/react-window-manager react-reverse-portal
```

Peer dependencies:

- `react@^19`
- `react-dom@^19`

## Quick start

Wrap your app once:

```tsx
import { WindowSystemProvider } from '@comic-universe/react-window-manager'

export function AppRoot() {
  return (
    <WindowSystemProvider>
      <App />
    </WindowSystemProvider>
  )
}
```

Define your windows as a registry:

```tsx
import type { WindowRegistry } from '@comic-universe/react-window-manager'
import { ReaderWindow } from './ReaderWindow'
import { SettingsWindow } from './SettingsWindow'

export const windows: WindowRegistry = {
  ReaderWindow: {
    component: ReaderWindow,
    windowProps: {
      title: 'Reader',
      resizable: true,
      minimizable: true
    },
    initialStatus: {
      width: 1000,
      height: 700,
      startPosition: 'center'
    }
  },
  SettingsWindow: {
    component: SettingsWindow,
    windowProps: {
      title: 'Settings',
      unique: true
    },
    initialStatus: {
      width: 640,
      height: 480,
      startPosition: 'center'
    }
  }
}
```

Open windows from anywhere inside the provider:

```tsx
import { useOpenWindow } from '@comic-universe/react-window-manager'
import { windows } from './windows'

export function Toolbar() {
  const openWindow = useOpenWindow(windows)

  return (
    <>
      <button onClick={() => openWindow({ component: 'ReaderWindow' })}>Open Reader</button>
      <button
        onClick={() =>
          openWindow({
            component: 'ReaderWindow',
            props: { chapterId: 'ch-10' }
          })
        }
      >
        Open Reader (chapter)
      </button>
    </>
  )
}
```

## Keyboard shortcuts

Scoped shortcuts automatically follow the focused window.

```tsx
import { useKeyboardShortcuts } from '@comic-universe/react-window-manager'

export function ReaderWindow({ windowId }: { windowId: string }) {
  useKeyboardShortcuts({
    owner: windowId, // optional in most window content, but explicit is fine
    shortcuts: [
      { key: 'ArrowRight', handler: () => console.log('next page') },
      { key: 'ArrowLeft', handler: () => console.log('previous page') }
    ]
  })

  return <div>Reader content</div>
}
```

Global shortcuts:

```tsx
useKeyboardShortcuts({
  global: true,
  shortcuts: [{ key: 'F1', handler: () => console.log('help') }]
})
```

## API summary

- `WindowSystemProvider`: provides window and shortcuts contexts
- `useWindowManager`: low-level manager API (`openWindow`, `focusWindow`, `closeWindow`, etc.)
- `useOpenWindow(registry)`: high-level window opener using definitions
- `useKeyboardShortcuts(...)`: register shortcut listeners
- `useKeyboardShortcutsManager()`: manual owner control (`setActiveOwner`)
- `KeyboardOwnerProvider`: explicit shortcut owner boundary

Types:

- `WindowCreateParams`
- `WindowInitialStatus`
- `WindowStartPosition`
- `WindowInstance`
- `WindowRegistry`
- `WindowDefinition`

## Styling

The UI uses utility class names (Tailwind-style). You can override visuals with:

- `windowProps.className`
- `windowProps.contentClassName`

and/or global CSS for your design system tokens.
