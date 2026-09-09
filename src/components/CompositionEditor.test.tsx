import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ingredient, RecipeDraft } from '../types/recipe'

const mutations = vi.hoisted(() => ({
  save: { mutateAsync: vi.fn(), isPending: false },
}))
vi.mock('../features/recipes/recipeMutations', () => ({
  useSaveComposition: () => mutations.save,
}))
import { CompositionEditor } from './CompositionEditor'

const turmeric: Ingredient = {
  id: 'turmeric',
  name: '강황가루',
  kind: 'ingredient',
  displayName: '',
  aliases: [],
  hidden: false,
  sortOrder: 0,
}
const draft: RecipeDraft = {
  id: 'beef',
  ownerUid: 'owner',
  name: '올드 패션 비프 스튜',
  species: null,
  unitIngredientId: 'ing_afkryt5v',
  unitLabel: '',
  standardId: '',
  sortOrder: 0,
  createdAt: 1,
  updatedAt: 1,
  composition: [
    { ingredientId: 'ing_afkryt5v', weight: 34.9, unit: 'g', sortOrder: 0 },
  ],
}
beforeEach(() => {
  mutations.save.mutateAsync.mockReset().mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('연결이 끊긴 구성 원료', () => {
  it('첫 원료인 강황가루 대신 연결 누락을 표시하고 저장을 막는다', () => {
    render(
      <CompositionEditor draft={draft} ingredients={[turmeric]} uid="owner" />,
    )
    const select = screen.getByRole('combobox', {
      name: '1번째 원료',
    }) as HTMLSelectElement
    expect(select.value).toBe('ing_afkryt5v')
    expect(select.selectedOptions[0]?.textContent).toContain('연결된 원료 없음')
    fireEvent.click(screen.getByRole('button', { name: '구성 저장' }))
    expect(
      screen.getByText(/1번째 행의 원료가 연결되지 않았습니다/),
    ).toBeInTheDocument()
    expect(mutations.save.mutateAsync).not.toHaveBeenCalled()
  })
  it('원료 목록 갱신으로 이름을 정상 표시하고 입력 중인 배합값을 보존한다', async () => {
    const refresh = vi.fn()
    const { rerender } = render(
      <CompositionEditor
        draft={draft}
        ingredients={[turmeric]}
        uid="owner"
        onRefreshIngredients={refresh}
      />,
    )
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '40' },
    })
    fireEvent.click(screen.getByRole('button', { name: '원료 목록 새로고침' }))
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(mutations.save.mutateAsync).not.toHaveBeenCalled()
    rerender(
      <CompositionEditor
        draft={draft}
        ingredients={[
          turmeric,
          { ...turmeric, id: 'ing_afkryt5v', name: '정제수' },
        ]}
        uid="owner"
      />,
    )
    expect(screen.queryByText('원료 목록 새로고침')).not.toBeInTheDocument()
    const select = screen.getByRole('combobox', {
      name: '1번째 원료',
    }) as HTMLSelectElement
    expect(select.selectedOptions[0]?.textContent).toBe('정제수')
    expect(screen.getByRole('spinbutton')).toHaveValue(40)
    fireEvent.click(screen.getByRole('button', { name: '구성 저장' }))
    await waitFor(() =>
      expect(mutations.save.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          composition: [{ ...draft.composition[0], weight: 40 }],
        }),
      ),
    )
  })
})
