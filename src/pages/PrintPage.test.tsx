import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
const reads = vi.hoisted(() => ({
  drafts: vi.fn(),
  presets: vi.fn(),
  ingredients: vi.fn(),
}))
vi.mock('../stores/authStore', () => ({ useAuthStore: () => 'owner' }))
vi.mock('../features/orders/orderStorage', () => ({
  useSavedOrders: () => ({
    isSuccess: true,
    data: [
      {
        id: 'saved',
        date: '2026-09-09',
        presetIds: ['deleted'],
        snapshot: {
          version: 1,
          items: [{ supplements: [] }],
          outputOne: [
            {
              name: '저장 당시 치킨',
              columns: [{ header: 'I1 (20)', eggshell: '122.22g' }],
            },
          ],
          outputTwo: { eggshellWeights: ['122.22g'], aliasGroups: [] },
        },
      },
    ],
  }),
}))
vi.mock('../features/recipes/recipeQueries', () => ({
  useRecipeDrafts: reads.drafts,
}))
vi.mock('../features/presets/presetQueries', () => ({
  usePresets: reads.presets,
}))
vi.mock('../features/ingredients/ingredientQueries', () => ({
  useIngredients: reads.ingredients,
}))
vi.mock('@react-pdf/renderer', () => ({
  PDFViewer: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
  PDFDownloadLink: () => <a>PDF 다운로드</a>,
}))
vi.mock('../features/print/OrderPdf', () => ({
  OrderPdf1: ({ groups }: { groups: unknown }) => (
    <pre>{JSON.stringify(groups)}</pre>
  ),
  OrderPdf2: ({ output }: { output: unknown }) => (
    <pre>{JSON.stringify(output)}</pre>
  ),
}))
import { PrintPage } from './PrintPage'

describe('저장된 양식 재출력', () => {
  it('원본을 읽지 못하거나 프리셋이 삭제되어도 당시 표를 출력한다', () => {
    for (const read of Object.values(reads))
      read.mockReturnValue({ data: undefined })
    render(
      <MemoryRouter initialEntries={['/print?order=saved&format=owner']}>
        <PrintPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/저장 당시 치킨/)).toHaveTextContent('122.22g')
    expect(screen.getByText(/저장 당시 치킨/)).toHaveTextContent('I1 (20)')
    for (const read of Object.values(reads))
      expect(read).toHaveBeenCalledWith(undefined)
  })
})
