import { describe, expect, it } from 'vitest'

import {
  buildOutputOne,
  buildOutputTwo,
  buildPresetPrintViews,
  fmtPrint,
  formatCodeWithInput,
} from './printSelectors'
import type { Ingredient, Preset, RecipeDraft } from '../../types/recipe'
import { createOrderSnapshot } from '../orders/orderSnapshot'

function ingredient(
  id: string,
  kind: Ingredient['kind'],
  overrides: Partial<Ingredient> = {},
): Ingredient {
  return {
    id,
    name: id,
    kind,
    displayName: '',
    aliases: [],
    hidden: false,
    sortOrder: 0,
    ...overrides,
  }
}

function draft(
  id: string,
  name: string,
  rows: Array<{ ingredientId: string; weight: number }>,
): RecipeDraft {
  return {
    id,
    ownerUid: 'uid',
    name,
    species: 'cat',
    unitIngredientId: 'unit',
    unitLabel: '마리',
    composition: rows.map((row, index) => ({
      ingredientId: row.ingredientId,
      weight: row.weight,
      unit: 'g',
      sortOrder: index,
    })),
    standardId: '',
    status: 'draft',
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
  }
}

function preset(
  id: string,
  draftId: string,
  code: string,
  targetWeight: number,
  inputAmount = 0,
): Preset {
  return {
    id,
    draftId,
    code,
    targetWeight,
    label: '',
    unitIngredientId: 'unit',
    inputAmount,
    inputUnitLabel: '마리',
    sortOrder: 0,
    createdAt: 1,
  }
}

// 레시피: 단위원료 100g + 난각분 10g + 영양제(치환명 있음) 5g + 치환명 없는 영양제 3g
const ingredients = [
  ingredient('unit', 'ingredient'),
  ingredient('egg', 'supplement', { name: '난각분' }),
  ingredient('vitE', 'supplement', { name: '비타민E', displayName: '하늘' }),
  ingredient('plain', 'supplement', { name: '타우린' }), // 치환명 없음 → 출력2 제외
]
const drafts = [
  draft('d1', '치킨', [
    { ingredientId: 'unit', weight: 100 },
    { ingredientId: 'egg', weight: 10 },
    { ingredientId: 'vitE', weight: 5 },
    { ingredientId: 'plain', weight: 3 },
  ]),
]
// A0: 200g 목표 → ratio 2. A1: 400g → ratio 4 (inputAmount 4마리).
const presets = [
  preset('p0', 'd1', 'A0', 200),
  preset('p1', 'd1', 'A1', 400, 4),
]

describe('buildPresetPrintViews', () => {
  it('scales supplements by targetWeight/unitRow ratio', () => {
    const views = buildPresetPrintViews(
      ['p0', 'p1'],
      presets,
      drafts,
      ingredients,
    )

    expect(views).toHaveLength(2)
    expect(views[0]?.ratio).toBe(2)
    expect(views[0]?.supplements.map((s) => [s.name, s.scaledWeight])).toEqual([
      ['난각분', 20],
      ['비타민E', 10],
      ['타우린', 6],
    ])
    expect(views[0]?.productLabel).toBe('(고양이)치킨')
  })

  it('skips unknown preset ids and hidden supplements', () => {
    const hiddenIngredients = ingredients.map((item) =>
      item.id === 'vitE' ? { ...item, hidden: true } : item,
    )
    const views = buildPresetPrintViews(
      ['p0', 'missing'],
      presets,
      drafts,
      hiddenIngredients,
    )
    expect(views).toHaveLength(1)
    expect(views[0]?.supplements.map((s) => s.name)).toEqual([
      '난각분',
      '타우린',
    ])
  })
})

describe('buildOutputOne', () => {
  it('groups by product with code headers (+input) and eggshell cells', () => {
    const views = buildPresetPrintViews(
      ['p1', 'p0'],
      presets,
      drafts,
      ingredients,
    )
    const groups = buildOutputOne(views)

    expect(groups).toHaveLength(1)
    expect(groups[0]?.name).toBe('(고양이)치킨')
    // 코드순 정렬 (A0, A1) + A1은 투입량 괄호
    expect(groups[0]?.columns).toEqual([
      { header: 'A0', eggshell: '20.0g' },
      { header: 'A1 (4)', eggshell: '40.0g' },
    ])
  })
})

describe('buildOutputTwo', () => {
  it('builds eggshell-only list (desc) and alias tables by code prefix', () => {
    const views = buildPresetPrintViews(
      ['p0', 'p1'],
      presets,
      drafts,
      ingredients,
    )
    const output = buildOutputTwo(views)

    expect(output.eggshellWeights).toEqual(['40.0g', '20.0g'])
    expect(output.aliasGroups).toHaveLength(1)
    const group = output.aliasGroups[0]!
    expect(group.name).toBe('A')
    expect(group.codes).toEqual(['A0', 'A1'])
    // 치환명 있는 비타민E(하늘)만, 난각분·치환명 없는 타우린은 제외
    expect(group.rows).toEqual([
      { displayName: '하늘', weights: ['10.0g', '20.0g'] },
    ])
  })
})

describe('formatters', () => {
  it('fmtPrint rounds to 2 decimals with locale separators', () => {
    expect(fmtPrint(1234.567)).toBe('1,234.57')
    expect(fmtPrint(1000)).toBe('1,000') // 정수는 정수 그대로 (헤더용)
  })

  it('formatCodeWithInput appends inputAmount only when positive', () => {
    expect(formatCodeWithInput(preset('x', 'd1', 'B2', 100, 3))).toBe('B2 (3)')
    expect(formatCodeWithInput(preset('x', 'd1', 'B2', 100, 0))).toBe('B2')
  })
})

describe('원료 구분과 독립적인 계량 대상', () => {
  it('미설정 원료는 기존 동작, 명시적 포함·제외는 구분과 숨김에 우선한다', () => {
    const variants = ingredients.map((item) =>
      item.id === 'unit'
        ? { ...item, includeInPreparation: true, hidden: true }
        : item.id === 'egg'
          ? { ...item, includeInPreparation: false }
          : item,
    )
    const view = buildPresetPrintViews(['p0'], presets, drafts, variants)[0]!
    expect(view.supplements.map((row) => row.ingredientId)).toEqual([
      'unit',
      'vitE',
      'plain',
    ])
    expect(variants[0]!.kind).toBe('ingredient')
  })

  it('비프 30kg의 난각분과 네 원료를 대표 실제명·직원 치환명 및 저장 내역에 포함한다', () => {
    const names = [
      '찐 토마토 가루',
      '익힌 표고버섯 가루',
      '씨앗 뺀 사과 가루',
      '브로콜리',
    ]
    const beefIngredients = [
      ingredient('unit', 'ingredient', { name: '소고기' }),
      ingredient('water', 'ingredient', { name: '정제수' }),
      ingredient('egg', 'supplement', { name: '난각분' }),
      ...names.map((name, i) =>
        ingredient(`powder${i}`, 'ingredient', {
          name,
          displayName: `시험치환${i}`,
          includeInPreparation: true,
        }),
      ),
    ]
    const beef = draft('beef', '올드 패션 비프 스튜', [
      { ingredientId: 'unit', weight: 70 },
      { ingredientId: 'water', weight: 34.9 },
      { ingredientId: 'egg', weight: 0.392 },
      ...names.map((_, i) => ({ ingredientId: `powder${i}`, weight: 0.005 })),
    ])
    const beefPreset = preset('beef30', 'beef', 'X2', 30000)
    const views = buildPresetPrintViews(
      ['beef30'],
      [beefPreset],
      [beef],
      beefIngredients,
    )
    const snapshot = createOrderSnapshot(views)
    expect(snapshot.outputOne[0]!.rows).toEqual([
      { name: '난각분', weights: ['168.0g'] },
      ...names.map((name) => ({ name, weights: ['2.14g'] })),
    ])
    expect(snapshot.outputTwo.aliasGroups[0]!.rows).toEqual(
      names.map((_, i) => ({
        displayName: `시험치환${i}`,
        weights: ['2.14g'],
      })),
    )
    beefIngredients.forEach((item) => {
      item.includeInPreparation = false
      item.displayName = '변경'
    })
    expect(snapshot.items[0]!.supplements).toHaveLength(5)
    expect(snapshot.outputOne[0]!.rows![1]!.name).toBe(names[0])
    expect(snapshot.outputTwo.aliasGroups[0]!.rows[0]!.displayName).toBe(
      '시험치환0',
    )
  })
})
