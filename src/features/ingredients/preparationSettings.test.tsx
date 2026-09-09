import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import type { Ingredient } from '../../types/recipe'

const update = vi.hoisted(() => vi.fn())
vi.mock('../../firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: (_: unknown, path: string, id: string) => `${path}/${id}`,
  updateDoc: update,
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(),
}))
import { useUpdatePreparationSettings } from './ingredientMutations'

it('본인 원료의 두 출력 필드만 갱신하고 기존 영양값 객체를 유지한다', async () => {
  update.mockResolvedValue(undefined)
  const client = new QueryClient()
  const original: Ingredient = {
    id: 'tomato',
    name: '토마토',
    kind: 'ingredient',
    hidden: false,
    displayName: '',
    aliases: [],
    sortOrder: 2,
    nutrientProfile: { calcium: 1 },
  }
  client.setQueryData(['recipesssIngredients', 'owner'], [original])
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useUpdatePreparationSettings('owner'), {
    wrapper,
  })
  await act(async () =>
    result.current.mutateAsync({
      ingredientId: 'tomato',
      includeInPreparation: true,
      displayName: ' 가 ',
    }),
  )
  expect(update).toHaveBeenCalledWith(
    'recipesssIngredients/owner/items/tomato',
    { includeInPreparation: true, displayName: '가' },
  )
  const updated = client.getQueryData<Ingredient[]>([
    'recipesssIngredients',
    'owner',
  ])![0]!
  expect(updated).toEqual({
    ...original,
    includeInPreparation: true,
    displayName: '가',
  })
  expect(updated.nutrientProfile).toBe(original.nutrientProfile)
})
