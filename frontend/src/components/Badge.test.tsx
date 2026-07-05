import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './Badge.tsx'

describe('Badge', () => {
  it('renders its content', () => {
    render(<Badge tone="on">RX</Badge>)
    expect(screen.getByText('RX')).toBeInTheDocument()
  })
})
