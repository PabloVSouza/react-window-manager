import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../internal/cn'
import type { WindowInstance } from '../store/types'
import { useWindowManager } from '../WindowSystemProvider'
import { KeyboardOwnerProvider } from '../shortcuts/KeyboardShortcutsProvider'
import { IconButton } from './IconButton'
import { CloseIcon, MinusIcon, SquareIcon } from './icons'

type WindowProps = {
  window: WindowInstance
  children?: ReactNode
}

export function Window({ window, children }: WindowProps) {
  const {
    closeWindow,
    focusWindow,
    setWindowMoving,
    setWindowResizing,
    setWindowMaximized,
    setWindowMinimized
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

  const zIndex = windowStatus.isFocused ? 60 : 50

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
      className={cn(
        'pointer-events-auto absolute flex min-h-40 min-w-56 flex-col overflow-hidden rounded-lg border border-border/70 bg-card/95 text-card-foreground shadow-xl backdrop-blur-sm',
        className
      )}
      style={style}
      onPointerDownCapture={() => focusWindow(id)}
      onMouseDownCapture={() => focusWindow(id)}
    >
      {titleBar && (
        <header
          className={cn('relative flex h-10 shrink-0 items-center border-b border-border/70 bg-muted/70 px-2')}
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
              <IconButton className="h-7 w-7" onClick={() => setWindowMaximized(id, !windowStatus.isMaximized)}>
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
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
          {minimizable && (
            <IconButton
              variant="secondary"
              className="h-7 w-7"
              onClick={() => setWindowMinimized(id, true)}
            >
              <MinusIcon className="size-4" />
            </IconButton>
          )}

          {closeable && (
            <IconButton
              variant="destructive"
              className="h-7 w-7"
              onClick={() => closeWindow(id)}
            >
              <CloseIcon className="size-4" />
            </IconButton>
          )}
        </div>
      )}

      <KeyboardOwnerProvider owner={id}>
        <div className={cn('min-h-0 flex-1 overflow-auto', contentClassName)}>{children}</div>
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
