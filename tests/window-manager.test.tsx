import { StrictMode, useEffect, useRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  WindowSystemProvider,
  createWindowManager,
  useKeyboardShortcuts,
  type KeyboardShortcut,
  type WindowCreateParams
} from '../src'

const nextFrame = () =>
  act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))

/** Renders a window system with its own manager, opening the windows given. */
const renderWindows = async (...windows: WindowCreateParams[]) => {
  const manager = createWindowManager()
  render(
    <StrictMode>
      <WindowSystemProvider manager={manager}>
        <span />
      </WindowSystemProvider>
    </StrictMode>
  )
  await act(async () => {
    windows.forEach((window) => manager.openWindow(window))
  })
  await nextFrame()
  await nextFrame()
  return manager
}

const Shortcuts = ({
  shortcuts,
  priority
}: {
  shortcuts: KeyboardShortcut[]
  priority?: number
}) => {
  useKeyboardShortcuts({ shortcuts, priority })
  return null
}

describe('focus', () => {
  it('keeps autoFocus when the content moves into its frame', async () => {
    await renderWindows({ id: 'w1', content: <input aria-label="name" autoFocus /> })
    expect(document.activeElement).toBe(screen.getByLabelText('name'))
  })

  it('restores the focused field when a minimized window comes back', async () => {
    const manager = await renderWindows({
      id: 'w1',
      content: (
        <>
          <input aria-label="first" autoFocus />
          <input aria-label="second" />
        </>
      )
    })
    screen.getByLabelText('second').focus()
    await act(async () => manager.setWindowMinimized('w1', true))
    await act(async () => manager.setWindowMinimized('w1', false))
    await nextFrame()
    expect(document.activeElement).toBe(screen.getByLabelText('second'))
  })
})

describe('keyboard focus follows the focused window', () => {
  it('moves into a window that opens without a field to focus, and back when it closes', async () => {
    const manager = await renderWindows({
      id: 'a',
      content: <input aria-label="field a" autoFocus />
    })
    expect(document.activeElement).toBe(screen.getByLabelText('field a'))

    await act(async () => {
      manager.openWindow({ id: 'b', title: 'B', content: <p>list</p> })
    })
    const b = screen.getByText('list').closest('section')
    expect(b?.contains(document.activeElement)).toBe(true)

    await act(async () => manager.closeWindow('b'))
    expect(document.activeElement).toBe(screen.getByLabelText('field a'))
  })
})

describe('keyboard shortcuts', () => {
  it('leaves plain keys to a focused field; function keys and opt-ins still fire', async () => {
    const letter = vi.fn()
    const f6 = vi.fn()
    const down = vi.fn()
    await renderWindows({
      id: 'w1',
      content: (
        <>
          <Shortcuts
            shortcuts={[
              { key: 'a', handler: letter },
              { key: 'F6', handler: f6 },
              { key: 'ArrowDown', allowInEditable: true, handler: down }
            ]}
          />
          <input aria-label="name" autoFocus />
        </>
      )
    })
    const input = screen.getByLabelText('name')
    fireEvent.keyDown(input, { key: 'a' })
    fireEvent.keyDown(input, { key: 'F6' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(letter).not.toHaveBeenCalled()
    expect(f6).toHaveBeenCalledTimes(1)
    expect(down).toHaveBeenCalledTimes(1)
  })

  it('leaves Enter to a focused button and data-keys to their element', async () => {
    const enter = vi.fn()
    const f5 = vi.fn()
    await renderWindows({
      id: 'w1',
      content: (
        <>
          <Shortcuts
            shortcuts={[
              { key: 'Enter', handler: enter },
              { key: 'F5', handler: f5 }
            ]}
          />
          <button autoFocus>ok</button>
          <div data-keys="F5">
            <span tabIndex={0}>picker</span>
          </div>
        </>
      )
    })
    fireEvent.keyDown(screen.getByText('ok'), { key: 'Enter' })
    fireEvent.keyDown(screen.getByText('picker'), { key: 'F5' })
    expect(enter).not.toHaveBeenCalled()
    expect(f5).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByText('picker'), { key: 'Enter' })
    expect(enter).toHaveBeenCalledTimes(1)
  })

  it('keeps every registration of a window, by priority', async () => {
    const calls: string[] = []
    const Two = ({ withLow }: { withLow: boolean }) => (
      <>
        <Shortcuts shortcuts={[{ key: 'F2', handler: () => calls.push('high') }]} priority={1} />
        {withLow && <Shortcuts shortcuts={[{ key: 'F3', handler: () => calls.push('low') }]} />}
      </>
    )
    const manager = await renderWindows({ id: 'w1', content: <Two withLow /> })
    fireEvent.keyDown(document.body, { key: 'F2' })
    fireEvent.keyDown(document.body, { key: 'F3' })
    expect(calls).toEqual(['high', 'low'])

    // Unmounting one registration keeps the other.
    await act(async () => manager.updateWindow('w1', { content: <Two withLow={false} /> }))
    fireEvent.keyDown(document.body, { key: 'F2' })
    fireEvent.keyDown(document.body, { key: 'F3' })
    expect(calls).toEqual(['high', 'low', 'high'])
  })

  it('passes a key on when a handler returns false; skips keys already handled', async () => {
    const calls: string[] = []
    await renderWindows({
      id: 'w1',
      content: (
        <>
          <Shortcuts shortcuts={[{ key: 'Escape', handler: () => calls.push('close') }]} />
          <Shortcuts
            priority={1}
            shortcuts={[
              {
                handler: (event) => {
                  calls.push(`any:${event.key}`)
                  return false
                }
              }
            ]}
          />
        </>
      )
    })
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(calls).toEqual(['any:Escape', 'close'])

    const handled = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    handled.preventDefault()
    document.body.dispatchEvent(handled)
    expect(calls).toEqual(['any:Escape', 'close'])
  })
})

describe('manager outside React', () => {
  it('opens and closes windows, calling onClose; clearWindows closes newest first', async () => {
    const closed: string[] = []
    const manager = await renderWindows()
    await act(async () => {
      manager.openWindow({ id: 'a', content: <p>A</p>, onClose: () => closed.push('a') })
      manager.openWindow({ id: 'b', content: <p>B</p>, onClose: () => closed.push('b') })
      manager.openWindow({ id: 'c', content: <p>C</p>, onClose: () => closed.push('c') })
    })
    expect(screen.getByText('B')).toBeTruthy()
    await act(async () => manager.closeWindow('b'))
    expect(closed).toEqual(['b'])
    expect(screen.queryByText('B')).toBeNull()
    await act(async () => manager.clearWindows())
    expect(closed).toEqual(['b', 'c', 'a'])
    expect(manager.getState().windows).toHaveLength(0)
  })

  it('keeps a position and minimum size given before the desktop is measured', async () => {
    const manager = createWindowManager()
    manager.openWindow({
      id: 'w1',
      content: <p>W</p>,
      initialStatus: { left: 40, top: 30, width: 200, height: 150, minWidth: 150, minHeight: 100 }
    })
    manager.setContainerSize({ width: 1000, height: 700 })
    const { windowStatus } = manager.getState().windows[0]
    expect(windowStatus).toMatchObject({ left: 40, top: 30, width: 200, height: 150 })
  })
})

describe('content', () => {
  it('fills a fixed-height window and wraps it in bodyClassName', async () => {
    const Probe = () => {
      const ref = useRef<HTMLDivElement>(null)
      useEffect(() => {
        ref.current?.setAttribute('data-ready', 'yes')
      })
      return <div ref={ref}>probe</div>
    }
    const manager = await renderWindows(
      {
        id: 'fixed',
        content: <Probe />,
        bodyClassName: 'flex flex-col',
        initialStatus: { width: 400, height: 300 }
      },
      { id: 'auto', content: <p>auto</p> }
    )
    const [fixed, auto] = manager.getState().windows
    expect(fixed.portalNode.element.style.height).toBe('100%')
    expect(auto.portalNode.element.style.height).toBe('')
    expect(screen.getByText('probe').parentElement?.className).toContain('flex flex-col')
  })
})
