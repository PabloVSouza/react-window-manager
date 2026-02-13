# @pablovsouza/react-window-manager

Window manager for React apps with:

- Draggable/resizable/minimizable windows
- Portal-based rendering (inactive/minimized windows do not interfere with content flow)
- Focus/z-index management
- Scoped keyboard shortcuts by focused window
- Optional global shortcuts

## Version

Current stable version: `0.7.0`

## Installation

```bash
npm install @pablovsouza/react-window-manager
```

Install from GitHub (pre-publish/local validation):

```bash
npm install @pablovsouza/react-window-manager@github:PabloVSouza/react-window-manager
```

Peer dependencies:

- `react@^19`
- `react-dom@^19`

Styling behavior:

- The package builds and ships its own CSS (`dist/styles.css`).
- CSS is auto-loaded when you import the package entrypoint.
- No host Tailwind source scanning is required for the window manager UI.

## Quick start

Wrap your app once using the registry-driven provider (recommended):

```tsx
import { WindowProvider } from '@pablovsouza/react-window-manager'
import { windows } from './windows'

export function AppRoot() {
  return (
    <WindowProvider registry={windows}>
      <App />
    </WindowProvider>
  )
}
```

Define your windows as a registry:

```tsx
import type { WindowRegistry } from '@pablovsouza/react-window-manager'
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

Definitions can also be dynamic (responsive) by using resolver functions:

```tsx
import type { WindowRegistry } from '@pablovsouza/react-window-manager'

export const windows: WindowRegistry = {
  LoginWindow: {
    component: LoginWindow,
    initialStatus: ({ isMobile }) =>
      isMobile
        ? {
            startPosition: 'topLeft',
            width: '100%',
            height: '100%'
          }
        : {
            startPosition: 'center',
            width: '40%'
          }
  }
}
```

Open windows from anywhere inside the provider:

```tsx
import { useOpenWindow } from '@pablovsouza/react-window-manager'

export function Toolbar() {
  const openWindow = useOpenWindow()

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

Per-call overrides are supported:

```tsx
openWindow({
  component: 'ReaderWindow',
  windowProps: { minimizable: false, title: 'Reader Preview' },
  initialStatus: { startPosition: 'topRight', width: 840, height: 600 }
})
```

Overlay windows (stacked blurred backdrop):

```tsx
openWindow({
  component: 'ReaderWindow',
  windowProps: { overlay: true, minimizable: false }
})
```

Content-based sizing (responsive by default when size is not hardcoded):

- If `initialStatus.width` is omitted, width auto-fits content.
- If `initialStatus.height` is omitted, height auto-fits content.
- If either is provided, that axis stays fixed.
- Auto-sized windows are clamped to viewport bounds and react to content changes.

Example:

```tsx
openWindow({
  component: 'SettingsWindow',
  initialStatus: {
    startPosition: 'center',
    height: 480 // fixed height
    // width omitted => auto-fit width from content
  }
})
```

Position anchors:

- `initialStatus.positionAnchor: 'none'` (default): free position after open.
- `initialStatus.positionAnchor: 'startPosition'`: keeps the semantic anchor on container resize.
  Example: `startPosition: 'center'` stays centered while viewport changes.

## Advanced usage

Use `WindowSystemProvider` directly only when you want low-level control and pass registries manually:

```tsx
import { WindowSystemProvider, useOpenWindow } from '@pablovsouza/react-window-manager'
import { windows } from './windows'

function Toolbar() {
  const openWindow = useOpenWindow(windows)
  return <button onClick={() => openWindow({ component: 'ReaderWindow' })}>Open</button>
}
```

## Keyboard shortcuts

Scoped shortcuts automatically follow the focused window.

```tsx
import { useKeyboardShortcuts } from '@pablovsouza/react-window-manager'

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

- `WindowProvider`: recommended provider (window system + registry context)
- `WindowSystemProvider`: low-level provider without registry context
- `useWindowManager`: low-level manager API (`openWindow`, `focusWindow`, `closeWindow`, etc.)
- `useOpenWindow()`: window opener using `WindowProvider` registry
- `useOpenWindow(registry)`: manual registry mode for advanced usage
- `useKeyboardShortcuts(...)`: register shortcut listeners
- `useKeyboardShortcutsManager()`: manual owner control (`setActiveOwner`)
- `KeyboardOwnerProvider`: explicit shortcut owner boundary

Types:

- `WindowCreateParams`
- `WindowInitialStatus`
- `WindowStartPosition`
- `WindowPositionAnchor`
- `WindowInstance`
- `WindowRegistry`
- `WindowDefinition`
- `WindowDefinitionResolveContext`

## Styling

The UI is authored with utility classes and compiled into package CSS at build time.
You can override visuals with:

- `windowProps.className`
- `windowProps.contentClassName`

and/or global CSS for your design system tokens.
