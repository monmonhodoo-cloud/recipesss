import {
  buildOutputOne,
  buildOutputTwo,
  type PresetPrintView,
} from '../print/printSelectors'
import type {
  Ingredient,
  SavedOrder,
  SavedOrderSnapshot,
} from '../../types/recipe'

export function localDateKey(now: number): string {
  const date = new Date(now)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function createOrderSnapshot(
  views: PresetPrintView[],
): SavedOrderSnapshot {
  // 순서를 고정해 같은 선택의 두 양식을 열 때 중복 저장하지 않는다.
  const sorted = [...views].sort((a, b) =>
    a.preset.id.localeCompare(b.preset.id),
  )
  return {
    version: 1,
    items: sorted.map(({ preset, productLabel, supplements }) => ({
      presetId: preset.id,
      draftId: preset.draftId,
      productLabel,
      code: preset.code,
      inputAmount: preset.inputAmount,
      inputUnitLabel: preset.inputUnitLabel,
      supplements: supplements.map((row) => ({ ...row })),
    })),
    outputOne: buildOutputOne(sorted),
    outputTwo: buildOutputTwo(sorted),
  }
}

export function isSamePreparation(
  order: SavedOrder | undefined,
  snapshot: SavedOrderSnapshot,
  now: number,
): boolean {
  return Boolean(
    order?.snapshot &&
    order.date === localDateKey(now) &&
    JSON.stringify(canonicalValue(order.snapshot)) ===
      JSON.stringify(canonicalValue(snapshot)),
  )
}

// Firestore는 객체 키 순서를 보존하지 않는다. 저장 전후의 내용만 비교한다.
function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalValue(item)]),
    )
  return value
}

export function preparationIssues(
  ids: string[],
  views: PresetPrintView[],
  ingredients: Ingredient[],
): string[] {
  const issues = new Set<string>()
  if (new Set(ids).size !== views.length)
    issues.add(
      '삭제되었거나 연결되지 않은 프리셋이 있습니다. 선택을 다시 확인해주세요.',
    )
  const ingredientById = new Map(ingredients.map((item) => [item.id, item]))
  const codes = new Set<string>()
  for (const view of views) {
    const label = `${view.productLabel} ${view.preset.code}`
    if (view.draft.mergeReviewPending)
      issues.add(
        `${view.productLabel}: 원료 병합 결과를 레시피 관리에서 먼저 확인해주세요.`,
      )
    if (view.draft.status === 'inactive')
      issues.add(`${view.productLabel}: 사용 중단한 레시피입니다.`)
    const unitId = view.preset.unitIngredientId || view.draft.unitIngredientId
    const unitRow = view.draft.composition.find(
      (row) => row.ingredientId === unitId,
    )
    if (
      !unitRow ||
      !(unitRow.weight > 0) ||
      !Number.isFinite(view.ratio) ||
      !(view.ratio > 0)
    ) {
      issues.add(`${label}: 프리셋의 기준 원료·중량 연결을 확인해주세요.`)
    }
    if (!view.preset.code.trim() || codes.has(view.preset.code.toUpperCase()))
      issues.add(`${label}: 프리셋 코드가 비어 있거나 중복됩니다.`)
    codes.add(view.preset.code.toUpperCase())
    if (
      view.draft.composition.some(
        (row) => !ingredientById.has(row.ingredientId),
      )
    )
      issues.add(`${view.productLabel}: 연결되지 않은 원료가 있습니다.`)
    if (
      view.supplements.some(
        (row) => !Number.isFinite(row.scaledWeight) || row.scaledWeight < 0,
      )
    )
      issues.add(`${label}: 영양제 중량을 확인해주세요.`)
  }
  return [...issues]
}

export function orderErrorMessage(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : ''
  if (code.includes('permission-denied'))
    return '준비 내역에 접근할 권한이 없습니다. 저장 권한 설정을 확인해야 합니다.'
  if (code.includes('unavailable'))
    return '서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해주세요.'
  return error instanceof Error
    ? error.message
    : '준비 내역을 처리하지 못했습니다. 다시 시도해주세요.'
}
