import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastContainer } from './Toast.tsx'
import { useToastStore } from '../stores/toastStore.ts'

afterEach(() => useToastStore.setState({ toasts: [] }))

describe('ToastContainer', () => {
  it('renders nothing when the queue is empty', () => {
    const { container } = render(<ToastContainer />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a pushed toast', () => {
    useToastStore.getState().push('Tx started', 'success')
    render(<ToastContainer />)
    expect(screen.getByText('Tx started')).toBeInTheDocument()
  })

  it('dismisses a toast when its close button is pressed', async () => {
    useToastStore.getState().push('boom', 'error')
    render(<ToastContainer />)
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
  })
})
