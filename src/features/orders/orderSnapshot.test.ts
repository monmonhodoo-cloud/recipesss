import { describe, expect, it } from 'vitest'
import { buildPresetPrintViews } from '../print/printSelectors'
import { filterOrderGroups, groupPresetsByRecipe } from './orderSelectors'
import {
  createOrderSnapshot,
  isSamePreparation,
  localDateKey,
  preparationIssues,
} from './orderSnapshot'
import type {
  Ingredient,
  Preset,
  RecipeDraft,
  SavedOrder,
} from '../../types/recipe'

const draft: RecipeDraft = {
  id: 'chicken',
  ownerUid: 'user',
  name: '치킨 캐서롤 파티',
  species: null,
  category: '동결텐더',
  unitIngredientId: 'meat',
  unitLabel: '',
  composition: [
    { ingredientId: 'meat', weight: 1000, unit: 'kg', sortOrder: 0 },
    { ingredientId: 'eggshell', weight: 6.111, unit: 'g', sortOrder: 1 },
    { ingredientId: 'supplement', weight: 0.0005, unit: 'g', sortOrder: 2 },
  ],
  standardId: '',
  status: 'draft',
  sortOrder: 0,
  createdAt: 1,
  updatedAt: 1,
}
const ingredients: Ingredient[] = [
  {
    id: 'meat',
    name: '닭가슴살',
    kind: 'ingredient',
    displayName: '',
    aliases: [],
    hidden: false,
    sortOrder: 0,
  },
  {
    id: 'eggshell',
    name: '난각분',
    kind: 'supplement',
    displayName: '',
    aliases: [],
    hidden: false,
    sortOrder: 1,
  },
  {
    id: 'supplement',
    name: '영양제 원명',
    kind: 'supplement',
    displayName: '가',
    aliases: [],
    hidden: false,
    sortOrder: 2,
  },
]
const preset: Preset = {
  id: 'p20',
  draftId: draft.id,
  code: 'I1',
  targetWeight: 20000,
  label: '',
  unitIngredientId: 'meat',
  inputAmount: 20,
  inputUnitLabel: 'kg',
  sortOrder: 0,
  createdAt: 1,
}
const views = () =>
  buildPresetPrintViews(
    [preset.id],
    [structuredClone(preset)],
    [structuredClone(draft)],
    structuredClone(ingredients),
  )

describe('준비 내역 스냅샷', () => {
  it('원본·치환명·프리셋 코드 변경 및 삭제 이후에도 두 출력물과 소량 중량을 보존한다', () => {
    const currentViews = views()
    const snapshot = createOrderSnapshot(currentViews)
    const original = structuredClone(snapshot)
    currentViews[0]!.preset.code = 'I9'
    currentViews[0]!.draft.name = '변경된 이름'
    currentViews[0]!.supplements[1]!.displayName = '다'
    currentViews[0]!.supplements[1]!.scaledWeight = 999
    currentViews.splice(0)
    expect(snapshot).toEqual(original)
    expect(snapshot.outputOne[0]!.columns[0]).toEqual({
      header: 'I1 (20)',
      eggshell: '122.22g',
    })
    expect(snapshot.outputTwo.aliasGroups[0]!.rows[0]).toEqual({
      displayName: '가',
      weights: ['0.01g'],
    })
  })

  it('Firestore에서 필드 순서가 바뀌어도 같은 날짜·내용은 재저장하지 않는다', () => {
    const snapshot = createOrderSnapshot(views())
    const now = new Date(2026, 8, 9, 20, 0).getTime()
    const reordered = JSON.parse(
      JSON.stringify(snapshot, (key, value: unknown) => {
        void key
        return value && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(Object.entries(value).reverse())
          : value
      }),
    ) as typeof snapshot
    const order: SavedOrder = {
      id: 'saved',
      date: localDateKey(now),
      createdAt: now,
      presetIds: [preset.id],
      snapshot: reordered,
    }
    expect(isSamePreparation(order, snapshot, now)).toBe(true)
    expect(isSamePreparation(order, snapshot, now + 86400000)).toBe(false)
    const changed = structuredClone(snapshot)
    changed.items[0]!.code = 'I2'
    expect(isSamePreparation(order, changed, now)).toBe(false)
    expect(
      isSamePreparation({ ...order, snapshot: undefined }, snapshot, now),
    ).toBe(false)
  })

  it('수십 개 선택을 양쪽 출력에 빠짐없이 저장한다', () => {
    const presets = Array.from({ length: 60 }, (_, i) => ({
      ...preset,
      id: `p${i}`,
      code: `I${i}`,
      inputAmount: i + 1,
    }))
    const snapshot = createOrderSnapshot(
      buildPresetPrintViews(
        presets.map((item) => item.id),
        presets,
        [draft],
        ingredients,
      ),
    )
    expect(snapshot.items).toHaveLength(60)
    expect(snapshot.outputOne.flatMap((item) => item.columns)).toHaveLength(60)
    expect(snapshot.outputTwo.eggshellWeights).toHaveLength(60)
    expect(
      snapshot.outputTwo.aliasGroups.flatMap((item) => item.codes),
    ).toHaveLength(60)
  })

  it('끊긴 레시피·기준 원료 연결과 미확인 원료 병합을 빈 출력물로 저장하지 않는다', () => {
    expect(preparationIssues(['deleted'], [], ingredients)).not.toHaveLength(0)
    const currentViews = views()
    currentViews[0]!.draft.unitIngredientId = 'missing'
    currentViews[0]!.preset.unitIngredientId = 'missing'
    currentViews[0]!.draft.mergeReviewPending = true
    expect(
      preparationIssues([preset.id], currentViews, ingredients).join(' '),
    ).toContain('기준 원료')
    expect(
      preparationIssues([preset.id], currentViews, ingredients).join(' '),
    ).toContain('원료 병합')
  })

  it('이름에 동결이 없는 텐더와 프리셋 없는 제품도 준비 화면에서 찾는다', () => {
    const groups = groupPresetsByRecipe([draft], [], true)
    expect(groups).toHaveLength(1)
    expect(filterOrderGroups(groups, 'freezeDried')).toHaveLength(1)
    expect(
      filterOrderGroups(
        [{ ...groups[0]!, category: '생식', draftName: '동결 이름만 남음' }],
        'freezeDried',
      ),
    ).toHaveLength(0)
  })
})
