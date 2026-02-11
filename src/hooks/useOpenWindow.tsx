import { createElement, useCallback, type ComponentType } from 'react'
import { useWindowManager } from '../WindowSystemProvider'
import { useWindowRegistry } from '../WindowProvider'
import type { WindowCreateParams, WindowInitialStatus } from '../store/types'

type WindowComponent<TProps extends Record<string, unknown>> = ComponentType<TProps>

export type WindowDefinitionResolveContext = {
  viewport: {
    width: number
    height: number
  }
  isMobile: boolean
}

type Resolvable<T> = T | ((context: WindowDefinitionResolveContext) => T)

export type WindowDefinition<TProps extends Record<string, unknown> = Record<string, unknown>> = {
  component: WindowComponent<TProps>
  windowProps?: Resolvable<Omit<WindowCreateParams, 'id' | 'content' | 'initialStatus'>>
  initialStatus?: Resolvable<WindowInitialStatus>
}

export type WindowRegistry = Record<string, WindowDefinition>

type OpenWindowParams<TKey extends string> = {
  component: TKey
  props?: Record<string, unknown>
  windowProps?: Omit<WindowCreateParams, 'id' | 'content' | 'initialStatus'>
  initialStatus?: WindowInitialStatus
}

const resolveDefinitionValue = <T,>(
  value: Resolvable<T> | undefined,
  context: WindowDefinitionResolveContext
): T | undefined => {
  if (typeof value === 'function') {
    return (value as (ctx: WindowDefinitionResolveContext) => T)(context)
  }

  return value
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

export function useOpenWindow<TRegistry extends WindowRegistry = WindowRegistry>(registry?: TRegistry) {
  const { openWindow, closeWindow } = useWindowManager()
  const registryFromProvider = useWindowRegistry()
  const resolvedRegistry = (registry || registryFromProvider) as TRegistry | null

  return useCallback(
    <TKey extends keyof TRegistry & string>({
      component,
      props = {},
      windowProps,
      initialStatus
    }: OpenWindowParams<TKey>) => {
      if (!resolvedRegistry) {
        throw new Error(
          'useOpenWindow requires a registry argument or usage within WindowProvider with a registry.'
        )
      }

      const definition = resolvedRegistry[component]

      if (!definition) {
        return
      }

      const resolveContext: WindowDefinitionResolveContext = {
        viewport: {
          width: globalThis.window?.innerWidth ?? 0,
          height: globalThis.window?.innerHeight ?? 0
        },
        isMobile: globalThis.window?.matchMedia?.('(max-width: 768px)').matches ?? false
      }

      const resolvedWindowProps = resolveDefinitionValue(definition.windowProps, resolveContext)
      const resolvedInitialStatus = resolveDefinitionValue(definition.initialStatus, resolveContext)

      const mergedWindowProps = {
        ...(resolvedWindowProps || {}),
        ...(windowProps || {})
      }
      const mergedInitialStatus = {
        ...(resolvedInitialStatus || {}),
        ...(initialStatus || {})
      }
      const { component: Component } = definition
      const windowId = generateWindowId(component, mergedWindowProps.unique)

      openWindow({
        ...mergedWindowProps,
        id: windowId,
        initialStatus: mergedInitialStatus,
        content: createElement(Component as WindowComponent<Record<string, unknown>>, {
          ...props,
          windowId,
          closeSelf: () => closeWindow(windowId)
        })
      })
    },
    [closeWindow, openWindow, resolvedRegistry]
  )
}
