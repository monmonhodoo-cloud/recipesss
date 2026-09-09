import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type {
  Ingredient,
  Preset,
  RecipeDraft,
  SavedOrder,
  SavedOrderSnapshot,
} from '../types/recipe'

const data = vi.hoisted(() => ({
  drafts: [] as RecipeDraft[],
  presets: [] as Preset[],
  ingredients: [] as Ingredient[],
  orders: [] as SavedOrder[],
  save: vi.fn(),
  refetch: vi.fn(),
}))
vi.mock('../stores/authStore', () => ({
  useAuthStore: (select: (state: unknown) => unknown) =>
    select({ user: { uid: 'owner' } }),
}))
vi.mock('../features/recipes/recipeQueries', () => ({
  useRecipeDrafts: () => ({ data: data.drafts, refetch: data.refetch }),
}))
vi.mock('../features/presets/presetQueries', () => ({
  usePresets: () => ({ data: data.presets, refetch: data.refetch }),
}))
vi.mock('../features/ingredients/ingredientQueries', () => ({
  useIngredients: () => ({ data: data.ingredients, refetch: data.refetch }),
}))
vi.mock('../features/orders/orderStorage', () => ({
  useSavedOrders: () => ({ data: data.orders }),
  useSaveOrder: () => ({ mutateAsync: data.save, isPending: false }),
}))
vi.mock('../features/presets/presetMutations', () => ({
  useApplyDraftPresets: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../features/auth/authActions', () => ({ logout: vi.fn() }))
import { AppLayout } from '../components/AppLayout'
import { OrdersPage } from './OrdersPage'

function PrintDestination() {
  return <p>{useLocation().search}</p>
}
function renderOrders(entry = '/orders') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/print" element={<PrintDestination />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  data.refetch.mockReset()
  data.drafts = [
    {
      id: 'chicken',
      ownerUid: 'owner',
      name: '치킨',
      species: 'cat',
      unitIngredientId: 'meat',
      unitLabel: '',
      composition: [
        { ingredientId: 'meat', weight: 1000, unit: 'kg', sortOrder: 0 },
        { ingredientId: 'egg', weight: 6, unit: 'g', sortOrder: 1 },
      ],
      standardId: '',
      status: 'draft',
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1,
    },
  ]
  data.presets = Array.from({ length: 32 }, (_, i) => ({
    id: `p${i}`,
    draftId: 'chicken',
    code: `A${i}`,
    targetWeight: (i + 1) * 1000,
    label: '',
    unitIngredientId: 'meat',
    inputAmount: i + 1,
    inputUnitLabel: 'kg',
    sortOrder: i,
    createdAt: 1,
  }))
  data.ingredients = [
    {
      id: 'meat',
      name: '닭고기',
      kind: 'ingredient',
      displayName: '',
      aliases: [],
      hidden: false,
      sortOrder: 0,
    },
    {
      id: 'egg',
      name: '난각분',
      kind: 'supplement',
      displayName: '',
      aliases: [],
      hidden: false,
      sortOrder: 1,
    },
  ]
  data.orders = []
  data.save
    .mockReset()
    .mockImplementation(
      async (input: {
        presetIds: string[]
        snapshot: SavedOrderSnapshot
        now: number
      }) => {
        const date = new Date(input.now)
        const saved: SavedOrder = {
          id: 'new-order',
          presetIds: input.presetIds,
          snapshot: input.snapshot,
          createdAt: input.now,
          date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        }
        data.orders = [saved]
        return saved
      },
    )
})

describe('준비·출력 사용자 흐름', () => {
  it('이전 비활성 레시피도 선택하고 저장할 수 있다', async () => {
    data.drafts[0]!.status = 'inactive'
    renderOrders()
    fireEvent.click(screen.getByRole('checkbox', { name: '치킨 1 kg 프리셋' }))
    fireEvent.click(screen.getByRole('button', { name: '준비 목록 저장' }))
    await screen.findByRole('button', { name: '저장됨' })
    expect(data.orders[0]?.snapshot?.items).toHaveLength(1)
  })

  it('여러 제품의 프리셋과 영양제 펼치기, 미등록 프리셋 안내를 함께 보여준다', () => {
    const baseDraft = data.drafts[0]!
    const basePreset = data.presets[0]!
    data.drafts = [
      '치킨 캐서롤 파티',
      '치킨',
      '본치킨',
      '덕',
      '동결 주식 덕',
      '동결 주식 오션피쉬',
    ].map((name, i) => ({
      ...baseDraft,
      id: `d${i}`,
      name,
      species: i === 0 ? null : i === 2 ? 'dog' : 'cat',
      category: i === 0 || i > 3 ? '동결건조' : '생식',
      sortOrder: i,
    }))
    data.presets = data.drafts.slice(0, 5).flatMap((draft, i) =>
      Array.from({ length: i === 0 ? 3 : 8 }, (_, j) => ({
        ...basePreset,
        id: `${i}-${j}`,
        draftId: draft.id,
        code: `${String.fromCharCode(65 + i)}${j}`,
        inputAmount: (j + 1) * 10,
        targetWeight: (j + 1) * 10000,
        sortOrder: j,
      })),
    )
    const rendered = renderOrders(
      `/orders?presets=${data.presets
        .slice(0, 32)
        .map((item) => item.id)
        .join(',')}`,
    )
    fireEvent.click(
      screen.getAllByRole('button', { name: '계량 재료 보기' })[0]!,
    )
    fireEvent.change(
      screen.getByRole('combobox', { name: '치킨 캐서롤 파티 확인할 프리셋' }),
      { target: { value: '0-1' } },
    )
    expect(screen.getByRole('cell', { name: '120.0g' })).toBeInTheDocument()
    expect(screen.getByText('등록된 프리셋이 없습니다.')).toBeInTheDocument()
    const outputDir = process.env.RECIPE_VISUAL_QA_DIR
    if (outputDir) {
      rendered.container.querySelectorAll('select').forEach((select) => {
        Array.from(select.options).forEach((option) => {
          if (option.selected) option.setAttribute('selected', '')
          else option.removeAttribute('selected')
        })
      })
      mkdirSync(outputDir, { recursive: true })
      writeFileSync(
        join(outputDir, 'preparation.html'),
        `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>실제 React 화면 · 검증용 예시 데이터</title><link rel="stylesheet" href="app.css"></head><body>${rendered.container.innerHTML}</body></html>`,
      )
    }
  })

  it('32개 일괄 선택 → 저장 → 대표용 출력에서 동일 저장 내역을 재사용한다', async () => {
    renderOrders()
    fireEvent.click(screen.getByRole('button', { name: '현재 목록 전체 선택' }))
    fireEvent.click(screen.getByRole('button', { name: '준비 목록 저장' }))
    await screen.findByRole('button', { name: '저장됨' })
    expect(data.save).toHaveBeenCalledTimes(1)
    expect(data.orders[0]?.snapshot?.items).toHaveLength(32)
    fireEvent.click(screen.getByRole('button', { name: '대표용 A4 출력' }))
    await screen.findByText(/order=new-order&format=owner/)
    expect(data.save).toHaveBeenCalledTimes(1)
  })

  it('직원용 출력 버튼은 저장 성공 후 그 기록을 연다', async () => {
    renderOrders('/orders?presets=p0,p1')
    fireEvent.click(screen.getByRole('button', { name: '직원용 A4 출력' }))
    await screen.findByText(/order=new-order&format=staff/)
    expect(data.save).toHaveBeenCalledTimes(1)
    expect(data.orders[0]?.snapshot?.outputTwo.eggshellWeights).toHaveLength(2)
  })

  it('저장 실패 시 선택을 유지하고 재시도할 수 있다', async () => {
    data.save.mockRejectedValueOnce(new Error('연결 실패'))
    renderOrders('/orders?presets=p0')
    fireEvent.click(screen.getByRole('button', { name: '준비 목록 저장' }))
    await screen.findByRole('alert')
    expect(
      screen.getByRole('checkbox', { name: '치킨 1 kg 프리셋' }),
    ).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: '준비 목록 저장' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '저장됨' })).toBeDisabled(),
    )
  })

  it('원료 연결 경고에서 선택을 유지한 채 최신 목록을 다시 확인할 수 있다', () => {
    data.ingredients = data.ingredients.filter((item) => item.id !== 'meat')
    renderOrders('/orders?presets=p0')
    expect(
      screen.getByRole('button', { name: '준비 목록 저장' }),
    ).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '목록 새로고침' }))
    expect(data.refetch).toHaveBeenCalledTimes(3)
    expect(
      screen.getByRole('checkbox', { name: '치킨 1 kg 프리셋' }),
    ).toBeChecked()
    expect(data.save).not.toHaveBeenCalled()
  })

  it('체크한 프리셋의 영양제 중량을 즉시 미리보기에 반영한다', () => {
    renderOrders()
    fireEvent.click(screen.getByRole('button', { name: '계량 재료 보기' }))
    expect(screen.getByRole('cell', { name: '6.0g' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: '치킨 3 kg 프리셋' }))
    expect(
      screen.getByRole('combobox', { name: '치킨 확인할 프리셋' }),
    ).toHaveValue('p2')
    expect(screen.getByRole('cell', { name: '18.0g' })).toBeInTheDocument()
  })

  it('선택된 프리셋 주소를 다시 열어도 그 값으로 미리보기를 시작한다', () => {
    renderOrders('/orders?presets=p2')
    fireEvent.click(screen.getByRole('button', { name: '계량 재료 보기' }))
    expect(
      screen.getByRole('combobox', { name: '치킨 확인할 프리셋' }),
    ).toHaveValue('p2')
    expect(screen.getByRole('cell', { name: '18.0g' })).toBeInTheDocument()
  })

  it('고양이 탭에서 동결건조를 제외하고 동결건조 탭으로 돌아와도 선택을 유지한다', () => {
    data.drafts.push({
      ...data.drafts[0]!,
      id: 'freeze',
      name: '동결 주식 덕',
      category: '동결건조',
    })
    data.presets.push({
      ...data.presets[0]!,
      id: 'freeze_p',
      draftId: 'freeze',
      code: 'B0',
    })
    renderOrders('/orders?presets=freeze_p')
    fireEvent.click(screen.getByRole('button', { name: '고양이' }))
    expect(screen.getByRole('heading', { name: '치킨' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: '동결 주식 덕' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '동결건조' }))
    expect(
      screen.getByRole('checkbox', { name: '동결 주식 덕 1 kg 프리셋' }),
    ).toBeChecked()
    expect(
      screen.queryByRole('heading', { name: '치킨' }),
    ).not.toBeInTheDocument()
    expect(data.drafts[1]?.species).toBe('cat')
  })
})
