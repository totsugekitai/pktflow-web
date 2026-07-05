import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithClient } from './test/helpers.ts'
import { App } from './App.tsx'

describe('App', () => {
  it('renders the dashboard shell', async () => {
    renderWithClient(<App />)
    expect(screen.getByRole('heading', { name: 'pktflow' })).toBeInTheDocument()
    expect(await screen.findByText(/no ports yet/i)).toBeInTheDocument()
  })
})
