import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../stores/authStore', () => ({ useAuthStore: () => 'owner' }))
vi.mock('../features/orders/orderStorage', () => ({
  useSavedOrders: () => ({
    data: [
      {
        id: 'saved-today',
        date: '2026-09-09',
        createdAt: new Date(2026, 8, 9, 10).getTime(),
        presetIds: ['p1'],
        snapshot: {
          version: 1,
          items: [
            {
              presetId: 'p1',
              draftId: 'd1',
              productLabel: '치킨',
              inputAmount: 20,
              inputUnitLabel: 'kg',
              code: 'A1',
              supplements: [],
            },
          ],
        },
      },
      {
        id: 'legacy',
        date: '2026-09-01',
        createdAt: new Date(2026, 8, 1, 10).getTime(),
        presetIds: ['deleted-preset'],
      },
    ],
  }),
  useDeleteOrder: () => ({ isPending: false, mutateAsync: vi.fn() }),
}))
import { OrderHistoryPage } from './OrderHistoryPage'

describe('날짜별 준비 내역', () => {
  it('날짜로 찾고 동일 기록의 두 재출력 주소를 제공한다', () => {
    render(
      <MemoryRouter>
        <OrderHistoryPage />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByLabelText('준비 내역 날짜'), {
      target: { value: '2026-09-09' },
    })
    expect(
      screen.queryByRole('heading', { name: '2026-09-01' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '대표용 재출력' })).toHaveAttribute(
      'href',
      '/print?order=saved-today&format=owner',
    )
    expect(screen.getByRole('link', { name: '직원용 재출력' })).toHaveAttribute(
      'href',
      '/print?order=saved-today&format=staff',
    )
    fireEvent.click(screen.getByRole('button', { name: '전체 날짜 보기' }))
    expect(screen.getByText(/당시 중량이 없어/)).toBeInTheDocument()
  })
})
