import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent
} from 'react'
import { createHtmlPortalNode } from 'react-reverse-portal'
import type {
  WindowCreateParams,
  WindowInitialStatus,
  WindowInstance,
  WindowManagerStore,
  WindowMeasure,
  WindowPositionAnchor,
  WindowStartPosition
} from './types'

const defaultContainerSize = { width: 0, height: 0 }
const defaultInitialStatus: WindowInitialStatus & { startPosition: WindowStartPosition } = {
  isMaximized: false,
  isMinimized: false,
  isFocused: true,
  width: 720,
  height: 480,
  startPosition: 'center',
  positionAnchor: 'none'
}

const MIN_WINDOW_WIDTH = 320
const MIN_WINDOW_HEIGHT = 220

const parseMeasure = (value: WindowMeasure | undefined, container: number, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()

    if (trimmed.endsWith('%')) {
      const percent = Number.parseFloat(trimmed.slice(0, -1))
      if (Number.isFinite(percent)) {
        return (container * percent) / 100
      }
    }

    const parsed = Number.parseFloat(trimmed)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const getSizeBounds = (container: { width: number; height: number }) => ({
  maxWidth: container.width > 0 ? container.width : MIN_WINDOW_WIDTH,
  maxHeight: container.height > 0 ? container.height : MIN_WINDOW_HEIGHT,
  minWidth: Math.min(MIN_WINDOW_WIDTH, container.width > 0 ? container.width : MIN_WINDOW_WIDTH),
  minHeight: Math.min(
    MIN_WINDOW_HEIGHT,
    container.height > 0 ? container.height : MIN_WINDOW_HEIGHT
  )
})

const isHorizontallyCentered = (startPosition: WindowStartPosition): boolean =>
  startPosition === 'topCenter' || startPosition === 'center' || startPosition === 'bottomCenter'

const isVerticallyCentered = (startPosition: WindowStartPosition): boolean =>
  startPosition === 'centerLeft' || startPosition === 'center' || startPosition === 'centerRight'

const hasStartPositionAnchor = (
  positionAnchor: WindowPositionAnchor | undefined
): boolean => positionAnchor === 'startPosition'

const resolvePositionByStart = (
  startPosition: WindowStartPosition,
  width: number,
  height: number,
  container: { width: number; height: number }
): { left: number; top: number } => {
  const positions: Record<WindowStartPosition, { left: number; top: number }> = {
    topLeft: { left: 0, top: 0 },
    topCenter: { left: (container.width - width) / 2, top: 0 },
    topRight: { left: container.width - width, top: 0 },
    centerLeft: { left: 0, top: (container.height - height) / 2 },
    center: { left: (container.width - width) / 2, top: (container.height - height) / 2 },
    centerRight: { left: container.width - width, top: (container.height - height) / 2 },
    bottomLeft: { left: 0, top: container.height - height },
    bottomCenter: { left: (container.width - width) / 2, top: container.height - height },
    bottomRight: { left: container.width - width, top: container.height - height }
  }

  return positions[startPosition]
}

const focusWindowInList = (windows: WindowInstance[], id: string): WindowInstance[] => {
  return windows.map((window) => ({
    ...window,
    windowStatus: {
      ...window.windowStatus,
      isFocused: window.id === id
    }
  }))
}

export function useWindowManagerStore(): WindowManagerStore {
  const [windows, setWindows] = useState<WindowInstance[]>([])
  const [containerSize, setContainerSizeState] = useState(defaultContainerSize)
  const containerSizeRef = useRef(defaultContainerSize)
  const idCounter = useRef(0)

  const setContainerSize = useCallback((size: { width: number; height: number }) => {
    const normalized = {
      width: Math.max(0, Math.round(size.width)),
      height: Math.max(0, Math.round(size.height))
    }
    const current = containerSizeRef.current
    if (current.width === normalized.width && current.height === normalized.height) {
      return
    }

    containerSizeRef.current = normalized

    setContainerSizeState(normalized)

    setWindows((currentWindows) => {
      if (!normalized.width || !normalized.height) {
        return currentWindows
      }

      let changed = false
      const nextWindows = currentWindows.map((window) => {
        if (window.windowStatus.isMaximized) {
          const isSameMaximized =
            window.windowStatus.top === 0 &&
            window.windowStatus.left === 0 &&
            window.windowStatus.width === normalized.width &&
            window.windowStatus.height === normalized.height &&
            window.originalContainerSize?.width === normalized.width &&
            window.originalContainerSize?.height === normalized.height

          if (isSameMaximized) {
            return window
          }

          changed = true
          return {
            ...window,
            windowStatus: {
              ...window.windowStatus,
              top: 0,
              left: 0,
              width: normalized.width,
              height: normalized.height
            },
            originalContainerSize: normalized
          }
        }

        const bounds = getSizeBounds(normalized)
        const measuredDesiredWidth = window.contentSize
          ? Math.max(MIN_WINDOW_WIDTH, window.contentSize.width + window.contentSize.frameWidth)
          : window.preferredSize.width
        const measuredDesiredHeight = window.contentSize
          ? Math.max(MIN_WINDOW_HEIGHT, window.contentSize.height + window.contentSize.frameHeight)
          : window.preferredSize.height

        const configuredWidth =
          window.initialStatus.width !== undefined
            ? parseMeasure(window.initialStatus.width, normalized.width, window.windowStatus.width)
            : window.windowStatus.width
        const configuredHeight =
          window.initialStatus.height !== undefined
            ? parseMeasure(window.initialStatus.height, normalized.height, window.windowStatus.height)
            : window.windowStatus.height

        const targetWidth = window.autoSize.width
          ? Math.max(measuredDesiredWidth, window.preferredSize.width)
          : window.manualSize
            ? window.windowStatus.width
            : configuredWidth
        const targetHeight = window.autoSize.height
          ? Math.max(measuredDesiredHeight, window.preferredSize.height)
          : window.manualSize
            ? window.windowStatus.height
            : configuredHeight

        const width = clamp(targetWidth, bounds.minWidth, bounds.maxWidth)
        const height = clamp(targetHeight, bounds.minHeight, bounds.maxHeight)
        const left = window.windowStatus.left
        const top = window.windowStatus.top
        const startPosition = window.initialStatus.startPosition || 'center'
        const startPos = resolvePositionByStart(startPosition, width, height, normalized)
        const keepAnchored =
          !window.manualPosition && hasStartPositionAnchor(window.initialStatus.positionAnchor)

        if (window.pendingInitialPosition) {
          const nextLeft = clamp(startPos.left, 0, Math.max(0, normalized.width - width))
          const nextTop = clamp(startPos.top, 0, Math.max(0, normalized.height - height))
          const nextPreferredWidth = window.autoSize.width
            ? Math.max(window.preferredSize.width, width)
            : window.preferredSize.width
          const nextPreferredHeight = window.autoSize.height
            ? Math.max(window.preferredSize.height, height)
            : window.preferredSize.height

          const isSamePending =
            window.windowStatus.width === width &&
            window.windowStatus.height === height &&
            window.windowStatus.left === nextLeft &&
            window.windowStatus.top === nextTop &&
            window.preferredSize.width === nextPreferredWidth &&
            window.preferredSize.height === nextPreferredHeight &&
            window.originalContainerSize?.width === normalized.width &&
            window.originalContainerSize?.height === normalized.height

          if (isSamePending) {
            return window
          }

          changed = true
          return {
            ...window,
            pendingInitialPosition: false,
            preferredSize: {
              width: nextPreferredWidth,
              height: nextPreferredHeight
            },
            windowStatus: {
              ...window.windowStatus,
              width,
              height,
              left: nextLeft,
              top: nextTop
            },
            originalContainerSize: normalized
          }
        }

        const outOfBounds =
          left < 0 ||
          top < 0 ||
          left + width > normalized.width ||
          top + height > normalized.height

        if (!outOfBounds) {
          let nextLeft = left
          let nextTop = top

          if (keepAnchored && window.initialStatus.left === undefined) {
            nextLeft = startPos.left
          } else if (
            !window.manualPosition &&
            window.initialStatus.left === undefined &&
            window.autoSize.width &&
            isHorizontallyCentered(startPosition)
          ) {
            nextLeft = nextLeft - (width - window.windowStatus.width) / 2
          }

          if (keepAnchored && window.initialStatus.top === undefined) {
            nextTop = startPos.top
          } else if (
            !window.manualPosition &&
            window.initialStatus.top === undefined &&
            window.autoSize.height &&
            isVerticallyCentered(startPosition)
          ) {
            nextTop = nextTop - (height - window.windowStatus.height) / 2
          }

          nextLeft = clamp(nextLeft, 0, Math.max(0, normalized.width - width))
          nextTop = clamp(nextTop, 0, Math.max(0, normalized.height - height))

          const nextPreferredWidth = window.autoSize.width
            ? Math.max(window.preferredSize.width, width)
            : window.preferredSize.width
          const nextPreferredHeight = window.autoSize.height
            ? Math.max(window.preferredSize.height, height)
            : window.preferredSize.height

          const unchanged =
            window.windowStatus.width === width &&
            window.windowStatus.height === height &&
            window.windowStatus.left === nextLeft &&
            window.windowStatus.top === nextTop &&
            window.preferredSize.width === nextPreferredWidth &&
            window.preferredSize.height === nextPreferredHeight &&
            window.originalContainerSize?.width === normalized.width &&
            window.originalContainerSize?.height === normalized.height

          if (unchanged) {
            return window
          }

          changed = true
          return {
            ...window,
            preferredSize: {
              width: nextPreferredWidth,
              height: nextPreferredHeight
            },
            windowStatus: {
              ...window.windowStatus,
              width,
              height,
              left: nextLeft,
              top: nextTop
            },
            originalContainerSize: normalized
          }
        }

        let nextLeft = left
        let nextTop = top

        if (keepAnchored) {
          if (window.initialStatus.left === undefined) {
            nextLeft = startPos.left
          }

          if (window.initialStatus.top === undefined) {
            nextTop = startPos.top
          }
        } else if (
          window.originalContainerSize &&
          window.originalContainerSize.width &&
          window.originalContainerSize.height
        ) {
          const heightRatio = normalized.height / window.originalContainerSize.height
          const widthRatio = normalized.width / window.originalContainerSize.width
          nextLeft = left * widthRatio
          nextTop = top * heightRatio
        } else {
          const startPos = resolvePositionByStart(
            window.initialStatus.startPosition || 'center',
            width,
            height,
            normalized
          )
          const initialLeft =
            window.initialStatus.left !== undefined
              ? parseMeasure(window.initialStatus.left, normalized.width, startPos.left)
              : startPos.left
          const initialTop =
            window.initialStatus.top !== undefined
              ? parseMeasure(window.initialStatus.top, normalized.height, startPos.top)
              : startPos.top
          nextLeft = initialLeft
          nextTop = initialTop
        }

        nextLeft = clamp(nextLeft, 0, Math.max(0, normalized.width - width))
        nextTop = clamp(nextTop, 0, Math.max(0, normalized.height - height))

        const nextPreferredWidth = window.autoSize.width
          ? Math.max(window.preferredSize.width, width)
          : window.preferredSize.width
        const nextPreferredHeight = window.autoSize.height
          ? Math.max(window.preferredSize.height, height)
          : window.preferredSize.height

        const unchanged =
          window.windowStatus.width === width &&
          window.windowStatus.height === height &&
          window.windowStatus.left === nextLeft &&
          window.windowStatus.top === nextTop &&
          window.preferredSize.width === nextPreferredWidth &&
          window.preferredSize.height === nextPreferredHeight &&
          window.originalContainerSize?.width === normalized.width &&
          window.originalContainerSize?.height === normalized.height

        if (unchanged) {
          return window
        }

        changed = true
        return {
          ...window,
          preferredSize: {
            width: nextPreferredWidth,
            height: nextPreferredHeight
          },
          windowStatus: {
            ...window.windowStatus,
            width,
            height,
            left: nextLeft,
            top: nextTop
          },
          originalContainerSize: normalized
        }
      })

      return changed ? nextWindows : currentWindows
    })
  }, [])

  const focusWindow = useCallback((id: string) => {
    setWindows((currentWindows) => focusWindowInList(currentWindows, id))
  }, [])

  const closeWindow = useCallback((id: string) => {
    setWindows((currentWindows) => {
      const filtered = currentWindows.filter((window) => window.id !== id)

      if (!filtered.length) {
        return filtered
      }

      if (filtered.some((window) => window.windowStatus.isFocused)) {
        return filtered
      }

      const lastWindow = filtered[filtered.length - 1]
      return focusWindowInList(filtered, lastWindow.id)
    })
  }, [])

  const setWindowMoving = useCallback((id: string, moving: boolean) => {
    setWindows((currentWindows) =>
      currentWindows.map((window) => {
        if (window.id !== id || window.windowStatus.isMaximized || !window.movable) {
          return window
        }

        return {
          ...window,
          manualPosition: window.manualPosition || moving,
          windowStatus: {
            ...window.windowStatus,
            isMoving: moving
          }
        }
      })
    )
  }, [])

  const setWindowResizing = useCallback((id: string, resizing: boolean) => {
    setWindows((currentWindows) =>
      currentWindows.map((window) => {
        if (window.id !== id || window.windowStatus.isMaximized || !window.resizable) {
          return window
        }

        return {
          ...window,
          manualSize: window.manualSize || resizing,
          windowStatus: {
            ...window.windowStatus,
            isResizing: resizing
          }
        }
      })
    )
  }, [])

  const setWindowMinimized = useCallback((id: string, minimized: boolean) => {
    setWindows((currentWindows) => {
      const updated = currentWindows.map((window) => {
        if (window.id !== id) {
          return window
        }

        return {
          ...window,
          windowStatus: {
            ...window.windowStatus,
            isMinimized: minimized,
            isMoving: false,
            isResizing: false,
            isFocused: !minimized
          }
        }
      })

      return minimized ? updated : focusWindowInList(updated, id)
    })
  }, [])

  const setWindowMaximized = useCallback(
    (id: string, maximized: boolean) => {
      setWindows((currentWindows) =>
        currentWindows.map((window) => {
          if (window.id !== id || !window.maximizable) {
            return window
          }

          if (maximized) {
            return {
              ...window,
              restoreStatus: {
                width: window.windowStatus.width,
                height: window.windowStatus.height,
                left: window.windowStatus.left,
                top: window.windowStatus.top
              },
              windowStatus: {
                ...window.windowStatus,
                isMaximized: true,
                isMoving: false,
                isResizing: false,
                left: 0,
                top: 0,
                width: containerSize.width || window.windowStatus.width,
                height: containerSize.height || window.windowStatus.height
              }
            }
          }

          if (!window.restoreStatus) {
            return {
              ...window,
              windowStatus: {
                ...window.windowStatus,
                isMaximized: false
              }
            }
          }

          return {
            ...window,
            windowStatus: {
              ...window.windowStatus,
              ...window.restoreStatus,
              isMaximized: false,
              isMoving: false,
              isResizing: false
            }
          }
        })
      )
    },
    [containerSize.height, containerSize.width]
  )

  const syncWindowContentSize = useCallback(
    (
      id: string,
      content: { width: number; height: number; frameWidth: number; frameHeight: number }
    ) => {
      setWindows((currentWindows) => {
        let changed = false
        const nextWindows = currentWindows.map((window) => {
          if (window.id !== id) {
            return window
          }

          if (
            window.windowStatus.isMaximized ||
            window.windowStatus.isMinimized ||
            window.windowStatus.isMoving ||
            window.windowStatus.isResizing
          ) {
            return window
          }

          if (!window.autoSize.width && !window.autoSize.height) {
            return window
          }

          const desiredWidth = window.autoSize.width
            ? Math.max(MIN_WINDOW_WIDTH, content.width + content.frameWidth)
            : window.windowStatus.width
          const desiredHeight = window.autoSize.height
            ? Math.max(MIN_WINDOW_HEIGHT, content.height + content.frameHeight)
            : window.windowStatus.height
          const preferredWidth = window.autoSize.width
            ? Math.max(window.preferredSize.width, desiredWidth)
            : window.preferredSize.width
          const preferredHeight = window.autoSize.height
            ? Math.max(window.preferredSize.height, desiredHeight)
            : window.preferredSize.height

          const bounds = getSizeBounds(containerSize)
          const nextWidth = clamp(preferredWidth, bounds.minWidth, bounds.maxWidth)
          const nextHeight = clamp(preferredHeight, bounds.minHeight, bounds.maxHeight)

          if (
            Math.abs(nextWidth - window.windowStatus.width) < 1 &&
            Math.abs(nextHeight - window.windowStatus.height) < 1
          ) {
            const sameContent =
              window.contentSize?.width === content.width &&
              window.contentSize?.height === content.height &&
              window.contentSize?.frameWidth === content.frameWidth &&
              window.contentSize?.frameHeight === content.frameHeight

            if (sameContent) {
              return window
            }

            changed = true
            return {
              ...window,
              contentSize: content
            }
          }

          const startPosition = window.initialStatus.startPosition || 'center'
          let nextLeft = window.windowStatus.left
          let nextTop = window.windowStatus.top

          if (!window.manualPosition && window.initialStatus.left === undefined && window.autoSize.width) {
            if (isHorizontallyCentered(startPosition)) {
              nextLeft = nextLeft - (nextWidth - window.windowStatus.width) / 2
            }
          }

          if (!window.manualPosition && window.initialStatus.top === undefined && window.autoSize.height) {
            if (isVerticallyCentered(startPosition)) {
              nextTop = nextTop - (nextHeight - window.windowStatus.height) / 2
            }
          }

          nextLeft = clamp(nextLeft, 0, Math.max(0, containerSize.width - nextWidth))
          nextTop = clamp(nextTop, 0, Math.max(0, containerSize.height - nextHeight))

          const sameContent =
            window.contentSize?.width === content.width &&
            window.contentSize?.height === content.height &&
            window.contentSize?.frameWidth === content.frameWidth &&
            window.contentSize?.frameHeight === content.frameHeight
          const unchangedPositionSize =
            window.windowStatus.width === nextWidth &&
            window.windowStatus.height === nextHeight &&
            window.windowStatus.left === nextLeft &&
            window.windowStatus.top === nextTop &&
            window.preferredSize.width === preferredWidth &&
            window.preferredSize.height === preferredHeight

          if (sameContent && unchangedPositionSize) {
            return window
          }

          changed = true
          return {
            ...window,
            contentSize: content,
            preferredSize: {
              width: preferredWidth,
              height: preferredHeight
            },
            windowStatus: {
              ...window.windowStatus,
              width: nextWidth,
              height: nextHeight,
              left: nextLeft,
              top: nextTop
            }
          }
        })

        return changed ? nextWindows : currentWindows
      })
    },
    [containerSize]
  )

  const updateWindow = useCallback((id: string, patch: Partial<WindowCreateParams>) => {
    setWindows((currentWindows) =>
      currentWindows.map((window) => {
        if (window.id !== id) {
          return window
        }

        return {
          ...window,
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.content !== undefined ? { content: patch.content } : {}),
          ...(patch.className !== undefined ? { className: patch.className } : {}),
          ...(patch.contentClassName !== undefined
            ? { contentClassName: patch.contentClassName }
            : {}),
          ...(patch.overlay !== undefined ? { overlay: patch.overlay } : {}),
          ...(patch.closeable !== undefined ? { closeable: patch.closeable } : {}),
          ...(patch.maximizable !== undefined ? { maximizable: patch.maximizable } : {}),
          ...(patch.minimizable !== undefined ? { minimizable: patch.minimizable } : {}),
          ...(patch.resizable !== undefined ? { resizable: patch.resizable } : {}),
          ...(patch.movable !== undefined ? { movable: patch.movable } : {}),
          ...(patch.titleBar !== undefined ? { titleBar: patch.titleBar } : {})
        }
      })
    )
  }, [])

  const openWindow = useCallback(
    (params: WindowCreateParams): string => {
      idCounter.current += 1
      const generatedId = `window-${idCounter.current}`
      const id = params.id || generatedId

      setWindows((currentWindows) => {
        const existing = currentWindows.find((window) => window.id === id)

        if (params.unique && existing) {
          return currentWindows.map((window) => {
            if (window.id !== id) {
              return {
                ...window,
                windowStatus: {
                  ...window.windowStatus,
                  isFocused: false
                }
              }
            }

            const nextInitialStatus = {
              ...defaultInitialStatus,
              ...(params.initialStatus || {})
            }

            const bounds = getSizeBounds(containerSize)
            const width = clamp(
              parseMeasure(nextInitialStatus.width, containerSize.width, window.windowStatus.width),
              bounds.minWidth,
              bounds.maxWidth
            )
            const height = clamp(
              parseMeasure(nextInitialStatus.height, containerSize.height, window.windowStatus.height),
              bounds.minHeight,
              bounds.maxHeight
            )

            const startPosition = nextInitialStatus.startPosition || 'center'
            const startPos = resolvePositionByStart(startPosition, width, height, containerSize)

            const left = clamp(
              nextInitialStatus.left !== undefined
                ? parseMeasure(nextInitialStatus.left, containerSize.width, startPos.left)
                : startPos.left,
              0,
              Math.max(0, containerSize.width - width)
            )

            const top = clamp(
              nextInitialStatus.top !== undefined
                ? parseMeasure(nextInitialStatus.top, containerSize.height, startPos.top)
                : startPos.top,
              0,
              Math.max(0, containerSize.height - height)
            )

            const nextIsMaximized = nextInitialStatus.isMaximized ?? false
            const nextWindowStatus = {
              ...window.windowStatus,
              isFocused: true,
              isMinimized: false,
              isMaximized: nextIsMaximized,
              width: nextIsMaximized ? containerSize.width || window.windowStatus.width : width,
              height: nextIsMaximized ? containerSize.height || window.windowStatus.height : height,
              left: nextIsMaximized ? 0 : left,
              top: nextIsMaximized ? 0 : top
            }

            return {
              ...window,
              title: params.title ?? window.title,
              content: params.content,
              overlay: params.overlay ?? window.overlay,
              closeable: params.closeable ?? window.closeable,
              className: params.className ?? window.className,
              contentClassName: params.contentClassName ?? window.contentClassName,
              maximizable: params.maximizable ?? window.maximizable,
              minimizable: params.minimizable ?? window.minimizable,
              resizable: params.resizable ?? window.resizable,
              movable: params.movable ?? window.movable,
              titleBar: params.titleBar ?? window.titleBar,
              autoSize: {
                width: nextInitialStatus.width === undefined,
                height: nextInitialStatus.height === undefined
              },
              preferredSize: {
                width: width,
                height: height
              },
              pendingInitialPosition:
                (nextInitialStatus.left === undefined || nextInitialStatus.top === undefined) &&
                (!containerSize.width || !containerSize.height),
              manualPosition: false,
              manualSize: false,
              initialStatus: nextInitialStatus,
              restoreStatus: nextIsMaximized
                ? {
                    width: window.windowStatus.width,
                    height: window.windowStatus.height,
                    left: window.windowStatus.left,
                    top: window.windowStatus.top
                  }
                : window.restoreStatus,
              windowStatus: nextWindowStatus
            }
          })
        }

        const initialStatus = {
          ...defaultInitialStatus,
          ...(params.initialStatus || {})
        }

        const autoSizeWidth = params.initialStatus?.width === undefined
        const autoSizeHeight = params.initialStatus?.height === undefined
        const bounds = getSizeBounds(containerSize)

        const width = clamp(
          parseMeasure(initialStatus.width, containerSize.width, 720),
          bounds.minWidth,
          bounds.maxWidth
        )
        const height = clamp(
          parseMeasure(initialStatus.height, containerSize.height, 480),
          bounds.minHeight,
          bounds.maxHeight
        )

        const startPosition = initialStatus.startPosition || 'center'
        const startPos = resolvePositionByStart(startPosition, width, height, containerSize)

        const left = clamp(
          initialStatus.left !== undefined
            ? parseMeasure(initialStatus.left, containerSize.width, startPos.left)
            : startPos.left,
          0,
          Math.max(0, containerSize.width - width)
        )

        const top = clamp(
          initialStatus.top !== undefined
            ? parseMeasure(initialStatus.top, containerSize.height, startPos.top)
            : startPos.top,
          0,
          Math.max(0, containerSize.height - height)
        )

        const nextWindow: WindowInstance = {
          id,
          title: params.title,
          content: params.content,
          portalNode: createHtmlPortalNode(),
          overlay: params.overlay ?? false,
          closeable: params.closeable ?? true,
          className: params.className,
          contentClassName: params.contentClassName,
          maximizable: params.maximizable ?? true,
          minimizable: params.minimizable ?? true,
          resizable: params.resizable ?? true,
          movable: params.movable ?? true,
          unique: params.unique ?? false,
          titleBar: params.titleBar ?? true,
          autoSize: {
            width: autoSizeWidth,
            height: autoSizeHeight
          },
          preferredSize: {
            width,
            height
          },
          pendingInitialPosition:
            (initialStatus.left === undefined || initialStatus.top === undefined) &&
            (!containerSize.width || !containerSize.height),
          manualPosition: false,
          manualSize: false,
          initialStatus,
          windowStatus: {
            isMoving: false,
            isResizing: false,
            isMaximized: initialStatus.isMaximized ?? false,
            isMinimized: initialStatus.isMinimized ?? false,
            isFocused: initialStatus.isFocused ?? true,
            width,
            height,
            left,
            top
          },
          originalContainerSize: containerSize
        }

        const blurred = currentWindows.map((window) => ({
          ...window,
          windowStatus: {
            ...window.windowStatus,
            isFocused: false
          }
        }))

        return [...blurred, nextWindow]
      })

      return id
    },
    [containerSize]
  )

  const mouseCapture = useCallback(
    (event: { movementX: number; movementY: number } | ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
      const { movementX, movementY } = event

      if (!movementX && !movementY) {
        return
      }

      setWindows((currentWindows) => {
        const movingWindow = currentWindows.find((window) => window.windowStatus.isMoving)
        const resizingWindow = currentWindows.find((window) => window.windowStatus.isResizing)

        if (!movingWindow && !resizingWindow) {
          return currentWindows
        }

        return currentWindows.map((window) => {
          if (movingWindow && window.id === movingWindow.id) {
            const nextLeft = clamp(
              window.windowStatus.left + movementX,
              0,
              Math.max(0, containerSize.width - window.windowStatus.width)
            )
            const nextTop = clamp(
              window.windowStatus.top + movementY,
              0,
              Math.max(0, containerSize.height - window.windowStatus.height)
            )

            return {
              ...window,
              windowStatus: {
                ...window.windowStatus,
                left: nextLeft,
                top: nextTop
              }
            }
          }

          if (resizingWindow && window.id === resizingWindow.id) {
            const maxWidth = Math.max(MIN_WINDOW_WIDTH, containerSize.width - window.windowStatus.left)
            const maxHeight = Math.max(
              MIN_WINDOW_HEIGHT,
              containerSize.height - window.windowStatus.top
            )

            const nextWidth = clamp(window.windowStatus.width + movementX, MIN_WINDOW_WIDTH, maxWidth)
            const nextHeight = clamp(
              window.windowStatus.height + movementY,
              MIN_WINDOW_HEIGHT,
              maxHeight
            )

            return {
              ...window,
              windowStatus: {
                ...window.windowStatus,
            width: nextWidth,
            height: nextHeight
          }
        }
          }

          return window
        })
      })
    },
    [containerSize.height, containerSize.width]
  )

  const removeMovingResizing = useCallback(() => {
    setWindows((currentWindows) =>
      currentWindows.map((window) => ({
        ...window,
        windowStatus: {
          ...window.windowStatus,
          isMoving: false,
          isResizing: false
        }
      }))
    )
  }, [])

  const clearWindows = useCallback(() => {
    setWindows([])
  }, [])

  return useMemo(
    () => ({
      windows,
      containerSize,
      setContainerSize,
      mouseCapture,
      removeMovingResizing,
      openWindow,
      closeWindow,
      focusWindow,
      setWindowMinimized,
      setWindowMaximized,
      setWindowMoving,
      setWindowResizing,
      syncWindowContentSize,
      updateWindow,
      clearWindows
    }),
    [
      windows,
      containerSize,
      setContainerSize,
      mouseCapture,
      removeMovingResizing,
      openWindow,
      closeWindow,
      focusWindow,
      setWindowMinimized,
      setWindowMaximized,
      setWindowMoving,
      setWindowResizing,
      syncWindowContentSize,
      updateWindow,
      clearWindows
    ]
  )
}
