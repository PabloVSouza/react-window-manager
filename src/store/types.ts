import type { ReactNode } from 'react'
import type { HtmlPortalNode } from 'react-reverse-portal'

export type WindowStartPosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'centerLeft'
  | 'center'
  | 'centerRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight'

export type WindowMeasure = number | string
export type WindowPositionAnchor = 'none' | 'startPosition'

export type WindowInitialStatus = {
  isMaximized?: boolean
  isMinimized?: boolean
  isFocused?: boolean
  width?: WindowMeasure
  height?: WindowMeasure
  left?: WindowMeasure
  top?: WindowMeasure
  startPosition?: WindowStartPosition
  positionAnchor?: WindowPositionAnchor
  /** Smallest size the window opens at and can be resized to (default 320×220). */
  minWidth?: number
  minHeight?: number
}

export type WindowCreateParams = {
  id?: string
  title?: string
  content: ReactNode
  overlay?: boolean
  closeable?: boolean
  className?: string
  contentClassName?: string
  /** Classes of the element that wraps the window's content (inside the scroll area). */
  bodyClassName?: string
  maximizable?: boolean
  minimizable?: boolean
  resizable?: boolean
  movable?: boolean
  unique?: boolean
  titleBar?: boolean
  initialStatus?: WindowInitialStatus
  /** Called once when the window closes (close button, `closeWindow`, `clearWindows`). */
  onClose?: () => void
}

export type WindowStatus = {
  isMoving: boolean
  isResizing: boolean
  isMaximized: boolean
  isMinimized: boolean
  isFocused: boolean
  width: number
  height: number
  left: number
  top: number
}

export type WindowInstance = {
  id: string
  title?: string
  content: ReactNode
  portalNode: HtmlPortalNode
  overlay: boolean
  closeable: boolean
  className?: string
  contentClassName?: string
  bodyClassName?: string
  onClose?: () => void
  maximizable: boolean
  minimizable: boolean
  resizable: boolean
  movable: boolean
  unique: boolean
  titleBar: boolean
  autoSize: {
    width: boolean
    height: boolean
  }
  pendingInitialPosition: boolean
  manualPosition: boolean
  manualSize: boolean
  contentSize?: {
    width: number
    height: number
    frameWidth: number
    frameHeight: number
  }
  preferredSize: {
    width: number
    height: number
  }
  initialStatus: WindowInitialStatus & { startPosition: WindowStartPosition }
  windowStatus: WindowStatus
  originalContainerSize?: { width: number; height: number }
  restoreStatus?: Pick<WindowStatus, 'width' | 'height' | 'left' | 'top'>
}

export type WindowManagerActions = {
  setContainerSize: (size: { width: number; height: number }) => void
  mouseCapture: (event: { movementX: number; movementY: number }) => void
  removeMovingResizing: () => void
  openWindow: (params: WindowCreateParams) => string
  /** Closes a window and calls its `onClose`. */
  closeWindow: (id: string) => void
  focusWindow: (id: string) => void
  setWindowMinimized: (id: string, minimized: boolean) => void
  setWindowMaximized: (id: string, maximized: boolean) => void
  setWindowMoving: (id: string, moving: boolean) => void
  setWindowResizing: (id: string, resizing: boolean) => void
  syncWindowContentSize: (
    id: string,
    content: { width: number; height: number; frameWidth: number; frameHeight: number }
  ) => void
  updateWindow: (id: string, patch: Partial<WindowCreateParams>) => void
  /** Closes every window, newest first, calling each one's `onClose`. */
  clearWindows: () => void
}

export type WindowManagerStore = WindowManagerActions & {
  windows: WindowInstance[]
  containerSize: { width: number; height: number }
}

/** A window manager created with `createWindowManager()`: usable outside React. */
export type WindowManager = WindowManagerActions & {
  /** The current windows and container size (a new object after every change). */
  getState: () => WindowManagerStore
  subscribe: (listener: () => void) => () => void
}
