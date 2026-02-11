import { useEffect, useRef } from 'react'
import { InPortal, OutPortal } from 'react-reverse-portal'
import { useWindowManager } from '../WindowSystemProvider'
import { KeyboardOwnerProvider } from '../shortcuts/KeyboardShortcutsProvider'
import { Window } from './Window'
import { MinimizedBar } from './MinimizedBar'

export function WindowManager() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { windows, setContainerSize, mouseCapture, removeMovingResizing, focusWindow } =
    useWindowManager()

  useEffect(() => {
    const element = containerRef.current

    if (!element) {
      return
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect()
      setContainerSize({ width: rect.width, height: rect.height })
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    window.addEventListener('resize', updateSize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [setContainerSize])

  const activeWindows = windows.filter((window) => !window.windowStatus.isMinimized)
  const minimizedWindows = windows.filter((window) => window.windowStatus.isMinimized)
  const isInteracting = windows.some(
    (window) => window.windowStatus.isMoving || window.windowStatus.isResizing
  )
  const activeWindowLayers = activeWindows.map((window, index) => {
    const baseZIndex = 200 + index * 2

    return {
      window,
      backdropZIndex: window.overlay ? baseZIndex : null,
      windowZIndex: baseZIndex + 1 + (window.windowStatus.isFocused ? 1000 : 0)
    }
  })

  useEffect(() => {
    if (!isInteracting) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      mouseCapture(event)
    }

    const stopInteraction = () => {
      removeMovingResizing()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopInteraction)
    window.addEventListener('blur', stopInteraction)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopInteraction)
      window.removeEventListener('blur', stopInteraction)
    }
  }, [isInteracting, mouseCapture, removeMovingResizing])

  return (
    <div ref={containerRef} className="pointer-events-none fixed inset-0 z-[100]">
      {windows.map((window) => (
        <InPortal key={`portal-${window.id}`} node={window.portalNode}>
          <KeyboardOwnerProvider owner={window.id}>
            <div
              className="contents"
              onPointerDownCapture={() => focusWindow(window.id)}
              onMouseDownCapture={() => focusWindow(window.id)}
            >
              {window.content}
            </div>
          </KeyboardOwnerProvider>
        </InPortal>
      ))}

      {activeWindowLayers.map(({ window, backdropZIndex, windowZIndex }) => (
        <div key={window.id} className="contents">
          {window.overlay && backdropZIndex !== null && (
            <div
              className="pointer-events-auto absolute inset-0 bg-black/30 backdrop-blur-sm"
              style={{ zIndex: backdropZIndex }}
              onPointerDownCapture={() => focusWindow(window.id)}
              onMouseDownCapture={() => focusWindow(window.id)}
            />
          )}

          <Window window={window} zIndex={windowZIndex}>
            <OutPortal node={window.portalNode} />
          </Window>
        </div>
      ))}

      {!!minimizedWindows.length && <MinimizedBar windows={minimizedWindows} />}
    </div>
  )
}
