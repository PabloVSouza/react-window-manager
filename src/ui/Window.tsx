import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { cn } from '../internal/cn'
import type { WindowInstance } from '../store/types'
import { useWindowManager } from '../WindowSystemProvider'
import { KeyboardOwnerProvider } from '../shortcuts/KeyboardShortcutsProvider'
import { IconButton } from './IconButton'
import { CloseIcon, MinusIcon, SquareIcon } from './icons'

type WindowProps = {
  window: WindowInstance
  zIndex: number
  children?: ReactNode
}

/** The element last focused inside each window's portal node; outlives the frame (minimize). */
const lastFocusByContent = new WeakMap<HTMLElement, HTMLElement>()

export function Window({ window, zIndex, children }: WindowProps) {
  const {
    closeWindow,
    focusWindow,
    setWindowMoving,
    setWindowResizing,
    setWindowMaximized,
    setWindowMinimized,
    syncWindowContentSize
  } = useWindowManager()

  const {
    id,
    title,
    closeable,
    maximizable,
    minimizable,
    resizable,
    movable,
    titleBar,
    className,
    contentClassName,
    windowStatus
  } = window
  const sectionRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  // Keep the window's cursor. Its content lives in a portal node that is moved into this frame on
  // mount (twice under StrictMode) and again when the window is restored, and moving a node drops
  // the focus of the field inside it, so `autoFocus` and the user's cursor would be lost. A layout
  // effect, so it listens before the content (mounted after the frames) takes the focus.
  useLayoutEffect(() => {
    const section = sectionRef.current
    const content = window.portalNode.element
    if (!section) {
      return
    }

    const remember = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && content.contains(event.target)) {
        lastFocusByContent.set(content, event.target)
      }
    }
    section.addEventListener('focusin', remember)

    const restore = globalThis.window.requestAnimationFrame(() => {
      const last = lastFocusByContent.get(content)
      const active = document.activeElement
      if (last?.isConnected && section.contains(last) && (!active || active === document.body)) {
        last.focus({ preventScroll: true })
      }
    })

    return () => {
      section.removeEventListener('focusin', remember)
      globalThis.window.cancelAnimationFrame(restore)
    }
  }, [window.portalNode])

  useEffect(() => {
    const sectionElement = sectionRef.current
    const contentElement = contentRef.current
    if (!sectionElement || !contentElement) {
      return
    }

    let frame = 0

    const measure = () => {
      const section = sectionRef.current
      const contentNode = contentRef.current
      if (!section || !contentNode) {
        return
      }

      const contentWidth = Math.ceil(contentNode.scrollWidth)
      // An auto-height window measures its content itself: the scroll area's scrollHeight is never
      // below the area's own height, so the window could grow but never shrink back.
      const contentHeight = window.autoSize.height
        ? Math.ceil(window.portalNode.element.getBoundingClientRect().height)
        : Math.ceil(contentNode.scrollHeight)
      const frameWidth = Math.ceil(section.offsetWidth - contentNode.clientWidth)
      const frameHeight = Math.ceil(section.offsetHeight - contentNode.clientHeight)

      syncWindowContentSize(id, {
        width: contentWidth,
        height: contentHeight,
        frameWidth,
        frameHeight
      })
    }

    const scheduleMeasure = () => {
      if (frame) {
        globalThis.window.cancelAnimationFrame(frame)
      }
      frame = globalThis.window.requestAnimationFrame(measure)
    }

    scheduleMeasure()

    const contentObserver = new ResizeObserver(scheduleMeasure)
    contentObserver.observe(contentElement)

    const sectionObserver = new ResizeObserver(scheduleMeasure)
    sectionObserver.observe(sectionElement)

    // The content itself (it can shrink inside an unchanged scroll area).
    const portalObserver = new ResizeObserver(scheduleMeasure)
    portalObserver.observe(window.portalNode.element)

    return () => {
      if (frame) {
        globalThis.window.cancelAnimationFrame(frame)
      }
      contentObserver.disconnect()
      sectionObserver.disconnect()
      portalObserver.disconnect()
    }
  }, [id, syncWindowContentSize, children, window.autoSize.height, window.portalNode])

  // Keyboard focus follows the focused window: a window that becomes the focused one (opened,
  // clicked, restored, or the one left when another closes) takes the keyboard focus unless it
  // already has it, back on the element last focused in it (or on the window itself). Keys then
  // reach the window the manager routes them to. Runs before the content's own effects, so a
  // window that focuses a field when it opens still gets its way.
  useEffect(() => {
    const section = sectionRef.current
    if (!section || !windowStatus.isFocused || windowStatus.isMinimized) {
      return
    }

    if (section.contains(document.activeElement)) {
      return
    }

    const last = lastFocusByContent.get(window.portalNode.element)
    if (last?.isConnected && section.contains(last)) {
      last.focus({ preventScroll: true })
    } else {
      section.focus({ preventScroll: true })
    }
  }, [window.portalNode, windowStatus.isFocused, windowStatus.isMinimized])

  // Content fills a window whose height is fixed (or maximized), so it can lay itself out in that
  // height (a list that scrolls, buttons at the bottom). An auto-height window takes the
  // content's own height instead.
  const fillHeight = !window.autoSize.height || windowStatus.isMaximized
  useLayoutEffect(() => {
    window.portalNode.element.style.height = fillHeight ? '100%' : ''
  }, [window.portalNode, fillHeight])

  const style: CSSProperties = windowStatus.isMaximized
    ? {
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex
      }
    : {
        top: `${windowStatus.top}px`,
        left: `${windowStatus.left}px`,
        width: `${windowStatus.width}px`,
        height: `${windowStatus.height}px`,
        zIndex
      }

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      className={cn(
        'pointer-events-auto absolute flex outline-none flex-col overflow-hidden rounded-lg border border-border/70 bg-card/95 text-card-foreground shadow-xl backdrop-blur-sm',
        className
      )}
      style={style}
      onPointerDownCapture={() => {
        if (!windowStatus.isFocused) {
          focusWindow(id)
        }
      }}
      onFocusCapture={() => {
        // Keyboard focus moving into the window (Tab, a script) makes it the focused window.
        if (!windowStatus.isFocused) {
          focusWindow(id)
        }
      }}
    >
      {titleBar && (
        <header
          className={cn(
            'relative flex h-10 shrink-0 items-center border-b border-border/70 bg-muted/70 px-2'
          )}
          onMouseDown={(event) => {
            if (!movable || event.button !== 0) {
              return
            }

            event.preventDefault()
            setWindowMoving(id, true)
          }}
          onDoubleClick={() => {
            if (!maximizable) {
              return
            }

            setWindowMaximized(id, !windowStatus.isMaximized)
          }}
        >
          <p className="truncate px-2 text-sm font-medium">{title || id}</p>

          <div className="ml-auto flex items-center gap-1">
            {minimizable && (
              <IconButton className="h-7 w-7" onClick={() => setWindowMinimized(id, true)}>
                <MinusIcon className="size-4" />
              </IconButton>
            )}

            {maximizable && (
              <IconButton
                className="h-7 w-7"
                onClick={() => setWindowMaximized(id, !windowStatus.isMaximized)}
              >
                <SquareIcon className="size-3.5" />
              </IconButton>
            )}

            {closeable && (
              <IconButton
                className="h-7 w-7 hover:bg-destructive/20 hover:text-destructive"
                onClick={() => closeWindow(id)}
              >
                <CloseIcon className="size-4" />
              </IconButton>
            )}
          </div>
        </header>
      )}

      {!titleBar && (
        <div className="absolute right-2 top-2 z-50 flex items-center gap-1">
          {minimizable && (
            <IconButton
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setWindowMinimized(id, true)}
            >
              <MinusIcon className="size-4" />
            </IconButton>
          )}

          {closeable && (
            <IconButton
              className="h-7 w-7 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
              onClick={() => closeWindow(id)}
            >
              <CloseIcon className="size-4" />
            </IconButton>
          )}
        </div>
      )}

      <KeyboardOwnerProvider owner={id}>
        <div ref={contentRef} className={cn('min-h-0 flex-1 overflow-auto', contentClassName)}>
          {children}
        </div>
      </KeyboardOwnerProvider>

      {resizable && !windowStatus.isMaximized && (
        <button
          type="button"
          className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-gradient-to-tl from-border/90 to-transparent"
          onMouseDown={(event) => {
            if (event.button !== 0) {
              return
            }

            event.preventDefault()
            setWindowResizing(id, true)
          }}
          aria-label="Resize window"
        />
      )}
    </section>
  )
}
