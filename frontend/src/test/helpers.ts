import { createElement, type ReactElement } from 'react'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/** A QueryClient tuned for tests: no retries, no refetch noise. */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

/** Renders `ui` wrapped in a fresh QueryClientProvider. */
export function renderWithClient(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderResult & { queryClient: QueryClient } {
  const queryClient = makeTestQueryClient()
  const result = render(ui, {
    wrapper: ({ children }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
    ...options,
  })
  return { ...result, queryClient }
}
