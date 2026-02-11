import { createElement, useCallback, type ComponentType } from 'react'
import { useWindowManager } from '../WindowSystemProvider'
import type { WindowCreateParams, WindowInitialStatus } from '../store/types'

type WindowComponent<TProps extends Record<string, unknown>> = ComponentType<TProps>

export type WindowDefinition<TProps extends Record<string, unknown> = Record<string, unknown>> = {
  component: WindowComponent<TProps>
  windowProps?: Omit<WindowCreateParams, 'id' | 'content' | 'initialStatus'>
  initialStatus?: WindowInitialStatus
}

export type WindowRegistry = Record<string, WindowDefinition>

type OpenWindowParams<TKey extends string> = {
  component: TKey
  props?: Record<string, unknown>
}

function generateWindowId(component: string, unique?: boolean): string {
  if (unique) {
    return component
  }

  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `${component}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

export function useOpenWindow<TRegistry extends WindowRegistry>(registry: TRegistry) {
  const { openWindow } = useWindowManager()

  return useCallback(
    <TKey extends keyof TRegistry & string>({ component, props = {} }: OpenWindowParams<TKey>) => {
      const definition = registry[component]

      if (!definition) {
        return
      }

      const { component: Component, windowProps = {}, initialStatus = {} } = definition
      const windowId = generateWindowId(component, windowProps.unique)

      openWindow({
        ...windowProps,
        id: windowId,
        initialStatus,
        content: createElement(Component as WindowComponent<Record<string, unknown>>, {
          ...props,
          windowId
        })
      })
    },
    [openWindow, registry]
  )
}
