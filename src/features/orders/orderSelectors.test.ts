import { describe, expect, it } from 'vitest'

import {
  buildOrderSummary,
  filterOrderGroups,
  formatPresetInput,
  formatOrderLine,
  groupLabel,
  groupPresetsByRecipe,
  speciesLabel,
  totalSelectedCount,
  type OrderGroup,
} from './orderSelectors'
import type { Preset, RecipeDraft, Species } from '../../types/recipe'

function draft(
  id: string,
  name: string,
  species: Species,
  sortOrder: number,
  unitLabel = 'unit',
): RecipeDraft {
  return {
    id,
    ownerUid: 'uid',
    name,
    species,
    unitIngredientId: 'ing_unit',
    unitLabel,
    composition: [],
    standardId: 'AAFCO_2024_CAT_ADULT',
    status: 'draft',
    sortOrder,
    createdAt: 1,
    updatedAt: 1,
  }
}

function preset(
  id: string,
  draftId: string,
  code: string,
  sortOrder: number,
  overrides: Partial<Preset> = {},
): Preset {
  return {
    id,
    draftId,
    code,
    targetWeight: 100,
    label: '',
    unitIngredientId: 'ing_unit',
    inputAmount: 1,
    inputUnitLabel: 'unit',
    sortOrder,
    createdAt: 1,
    ...overrides,
  }
}

describe('speciesLabel', () => {
  it('returns labels for species values', () => {
    expect(speciesLabel('cat')).toBeDefined()
    expect(speciesLabel('dog')).toBeDefined()
    expect(speciesLabel(null)).toBeDefined()
  })
})

describe('groupLabel', () => {
  it('combines species and draft name', () => {
    expect(groupLabel(draft('draft_cat', 'Chicken', 'cat', 0))).toContain(
      'Chicken',
    )
  })
})

describe('groupPresetsByRecipe', () => {
  it('groups presets by draft and sorts drafts by sortOrder', () => {
    const groups = groupPresetsByRecipe(
      [
        draft('draft_dog', 'Dog', 'dog', 2),
        draft('draft_cat', 'Cat', 'cat', 1),
      ],
      [
        preset('preset_b', 'draft_cat', 'a1', 2),
        preset('preset_dog', 'draft_dog', 'c0', 0),
        preset('preset_a', 'draft_cat', 'a0', 1),
      ],
    )

    expect(groups.map((group) => group.draftId)).toEqual([
      'draft_cat',
      'draft_dog',
    ])
    expect(groups[0]?.presets.map((item) => item.id)).toEqual([
      'preset_a',
      'preset_b',
    ])
  })

  it('sorts presets naturally by code for the order screen', () => {
    const groups = groupPresetsByRecipe(
      [draft('draft_cat', 'Cat', 'cat', 0)],
      [
        preset('preset_a3', 'draft_cat', 'A3', 0),
        preset('preset_a0', 'draft_cat', 'A0', 1),
        preset('preset_a7', 'draft_cat', 'A7', 2),
        preset('preset_a6', 'draft_cat', 'A6', 3),
        preset('preset_a5', 'draft_cat', 'A5', 4),
        preset('preset_a1', 'draft_cat', 'A1', 5),
        preset('preset_a2', 'draft_cat', 'A2', 6),
        preset('preset_a4', 'draft_cat', 'A4', 7),
      ],
    )

    expect(groups[0]?.presets.map((item) => item.code)).toEqual([
      'A0',
      'A1',
      'A2',
      'A3',
      'A4',
      'A5',
      'A6',
      'A7',
    ])
  })

  it('omits drafts with no presets and orphan presets', () => {
    const groups = groupPresetsByRecipe(
      [
        draft('draft_empty', 'Empty', null, 0),
        draft('draft_cat', 'Cat', 'cat', 1),
      ],
      [
        preset('preset_orphan', 'draft_missing', 'x0', 0),
        preset('preset_a', 'draft_cat', 'a0', 0),
      ],
    )

    expect(groups.map((group) => group.draftId)).toEqual(['draft_cat'])
  })

  it('uses species and unitLabel from the draft', () => {
    const groups = groupPresetsByRecipe(
      [draft('draft_cat', 'Cat', 'cat', 0, 'piece')],
      [preset('preset_a', 'draft_cat', 'a0', 0)],
    )

    expect(groups[0]?.species).toBe('cat')
    expect(groups[0]?.unitLabel).toBe('piece')
  })
})

describe('buildOrderSummary', () => {
  const groups: OrderGroup[] = groupPresetsByRecipe(
    [
      draft('draft_cat', 'Cat', 'cat', 0, 'piece'),
      draft('draft_dog', 'Dog', 'dog', 1, 'batch'),
    ],
    [
      preset('preset_a', 'draft_cat', 'a0', 0),
      preset('preset_b', 'draft_cat', 'a1', 1),
      preset('preset_c', 'draft_dog', 'c0', 0),
    ],
  )

  it('includes only selected presets and keeps group/item order', () => {
    const summary = buildOrderSummary(groups, {
      preset_b: true,
      preset_c: true,
    })

    expect(summary).toEqual([
      {
        draftId: 'draft_cat',
        label: `${speciesLabel('cat') ? `(${speciesLabel('cat')})` : ''}Cat`,
        items: [{ code: 'a1' }],
      },
      {
        draftId: 'draft_dog',
        label: `${speciesLabel('dog') ? `(${speciesLabel('dog')})` : ''}Dog`,
        items: [{ code: 'c0' }],
      },
    ])
  })

  it('omits groups with no selected presets', () => {
    expect(buildOrderSummary(groups, { preset_c: true })).toHaveLength(1)
  })
})

describe('filterOrderGroups', () => {
  const groups: OrderGroup[] = groupPresetsByRecipe(
    [
      draft('draft_cat', 'Cat Chicken', 'cat', 0),
      draft('draft_dog', 'Dog Duck', 'dog', 1),
      draft('draft_freeze', '동결 주식치킨', 'dog', 2),
    ],
    [
      preset('preset_cat', 'draft_cat', 'a0', 0),
      preset('preset_dog', 'draft_dog', 'b0', 0),
      preset('preset_freeze', 'draft_freeze', 'c0', 0),
    ],
  )

  it('keeps all groups for the all filter', () => {
    expect(
      filterOrderGroups(groups, 'all').map((group) => group.draftId),
    ).toEqual(['draft_cat', 'draft_dog', 'draft_freeze'])
  })

  it('filters non-freeze-dried groups by species', () => {
    expect(
      filterOrderGroups(groups, 'cat').map((group) => group.draftId),
    ).toEqual(['draft_cat'])
    expect(
      filterOrderGroups(groups, 'dog').map((group) => group.draftId),
    ).toEqual(['draft_dog'])
  })

  it('filters freeze-dried groups by draft name', () => {
    expect(
      filterOrderGroups(groups, 'freezeDried').map((group) => group.draftId),
    ).toEqual(['draft_freeze'])
  })

  it('동결건조와 동결텐더는 고양이·강아지에 중복 표시하지 않고 종을 보존한다', () => {
    const classified = groupPresetsByRecipe(
      [
        { ...draft('cat_raw', '고양이 생식', 'cat', 0), category: '생식' },
        { ...draft('dog_raw', '강아지 생식', 'dog', 1), category: '생식' },
        {
          ...draft('cat_freeze', '카테고리로 분류한 제품', 'cat', 2),
          category: '동결건조',
        },
        { ...draft('dog_tender', '텐더 제품', 'dog', 3), category: '동결텐더' },
        draft('cat_legacy', '동결 주식 덕', 'cat', 4),
        draft('dog_legacy', '동결 주식치킨', 'dog', 5),
        {
          ...draft('common_freeze', '치킨 캐서롤 파티', null, 6),
          category: '동결건조',
        },
        {
          ...draft('explicit_raw', '동결 이름이지만 생식으로 지정', 'cat', 7),
          category: '생식',
        },
      ],
      [],
      true,
    )
    const before = structuredClone(classified)
    expect(
      filterOrderGroups(classified, 'cat').map((item) => item.draftId),
    ).toEqual(['cat_raw', 'explicit_raw'])
    expect(
      filterOrderGroups(classified, 'dog').map((item) => item.draftId),
    ).toEqual(['dog_raw'])
    expect(
      filterOrderGroups(classified, 'freezeDried').map((item) => item.draftId),
    ).toEqual([
      'cat_freeze',
      'dog_tender',
      'cat_legacy',
      'dog_legacy',
      'common_freeze',
    ])
    expect(filterOrderGroups(classified, 'all')).toEqual(before)
    expect(classified).toEqual(before)
  })
})

describe('formatOrderLine', () => {
  it('formats a summary group with selected preset codes', () => {
    expect(
      formatOrderLine({
        draftId: 'draft_cat',
        label: 'Cat',
        items: [{ code: 'a0' }, { code: 'a1' }],
      }),
    ).toBe('Cat  a0 / a1')
  })
})

describe('formatPresetInput', () => {
  it('formats the production-unit preset amount', () => {
    expect(
      formatPresetInput(
        preset('preset_a', 'draft_cat', 'A0', 0, {
          inputAmount: 1,
          inputUnitLabel: 'piece',
        }),
      ),
    ).toBe('1 piece')
  })
})

describe('totalSelectedCount', () => {
  it('counts selected preset ids', () => {
    expect(totalSelectedCount({ preset_a: true, preset_b: true })).toBe(2)
  })
})
