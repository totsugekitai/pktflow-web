import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal.tsx'

describe('Modal', () => {
  it('renders title and content', () => {
    render(
      <Modal title="Add port" onClose={() => {}}>
        <p>body</p>
      </Modal>,
    )
    expect(screen.getByRole('dialog', { name: 'Add port' })).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('closes on the close button', async () => {
    const onClose = vi.fn()
    render(
      <Modal title="Add port" onClose={onClose}>
        <p>body</p>
      </Modal>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(
      <Modal title="Add port" onClose={onClose}>
        <p>body</p>
      </Modal>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })
})
