import { getPresetRatioInfo } from '../presets/presetRatio'
import type { Ingredient, Preset, RecipeDraft } from '../../types/recipe'

// 단계 4 출력 1·2 데이터 (v2 ui-tab-preview.js 충실 포팅, SPEC §5.7).
// 순수 — React/@react-pdf/Firebase 의존 없음.

const EGGSHELL_RE = /난각/

export type PrintSupplementRow = {
  ingredientId: string
  name: string
  displayName: string
  scaledWeight: number
}

export type PresetPrintView = {
  preset: Preset
  draft: RecipeDraft
  productLabel: string // (고양이)이름
  ratio: number
  supplements: PrintSupplementRow[]
}

// v2 fmt: 소수 2자리 반올림 + 천단위 구분 (헤더·코드용, 정수는 정수로).
export function fmtPrint(num: number): string {
  const value = Math.round((Number(num) || 0) * 100) / 100
  return value % 1 === 0
    ? value.toLocaleString()
    : value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
}

// 중량 포맷: 최소 소수점 1자리 보장 (0.0g ~ xx.xxg).
function fmtWeight(num: number): string {
  const value = Math.round((Number(num) || 0) * 100) / 100
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })
}

export function formatWeight(value: number): string {
  return Number(value) > 0 ? `${fmtWeight(value)}g` : ''
}

// 출력1 헤더: 코드 옆 생산단위 투입량 괄호 (예: A2 (25)).
export function formatCodeWithInput(preset: Preset): string {
  const amount = Number(preset.inputAmount)
  return amount > 0 ? `${preset.code} (${fmtPrint(amount)})` : preset.code
}

function productLabel(draft: RecipeDraft): string {
  const prefix =
    draft.species === 'cat' ? '(고양이)' : draft.species === 'dog' ? '(강아지)' : ''
  return `${prefix}${draft.name || ''}`
}

// inputAmount 우선 (J0처럼 targetWeight 미설정/오설정 대비).
// inputAmount 없으면 targetWeight/unitRow.weight fallback (구버전 호환).
function presetRatio(preset: Preset, draft: RecipeDraft): number {
  const unitIngId = preset.unitIngredientId || draft.unitIngredientId
  if (Number(preset.inputAmount) > 0) {
    const info = getPresetRatioInfo(draft, unitIngId, Number(preset.inputAmount))
    if (info.hasInput) return info.ratio
  }
  const unitRow = draft.composition.find((row) => row.ingredientId === unitIngId)
  if (!unitRow || !unitRow.weight) return 1
  return (Number(preset.targetWeight) || 0) / unitRow.weight
}

export function buildPresetPrintViews(
  selectedPresetIds: string[],
  presets: Preset[],
  drafts: RecipeDraft[],
  ingredients: Ingredient[],
): PresetPrintView[] {
  const presetById = new Map(presets.map((preset) => [preset.id, preset]))
  const draftById = new Map(drafts.map((draft) => [draft.id, draft]))
  const ingredientById = new Map(ingredients.map((item) => [item.id, item]))

  return selectedPresetIds.flatMap((presetId) => {
    const preset = presetById.get(presetId)
    if (!preset) return []
    const draft = draftById.get(preset.draftId)
    if (!draft) return []

    const ratio = presetRatio(preset, draft)
    const supplements = draft.composition.flatMap((row) => {
      const ingredient = ingredientById.get(row.ingredientId)
      if (
        !ingredient ||
        ingredient.kind !== 'supplement' ||
        ingredient.hidden ||
        !ingredient.name ||
        !row.weight
      ) {
        return []
      }
      return [
        {
          ingredientId: row.ingredientId,
          name: ingredient.name,
          displayName:
            ingredient.displayName || ingredient.aliases[0] || ingredient.name,
          scaledWeight: row.weight * ratio,
        },
      ]
    })

    return [
      { preset, draft, productLabel: productLabel(draft), ratio, supplements },
    ]
  })
}

function eggshellWeight(view: PresetPrintView): number {
  const row = view.supplements.find((s) => EGGSHELL_RE.test(s.name))
  return row ? row.scaledWeight : 0
}

function compareCodes(a: string, b: string): number {
  return a.localeCompare(b, 'ko', { numeric: true, sensitivity: 'base' })
}

function sortViewsByCode(views: PresetPrintView[]): PresetPrintView[] {
  return [...views].sort((a, b) => compareCodes(a.preset.code, b.preset.code))
}

// ---------- 출력 1: 제품별 난각분 표 ----------

export type OutputOneGroup = {
  name: string // (고양이)치킨
  // 컬럼 = 프리셋 (코드 + 투입량), 셀 = 난각분 환산 중량 표시 문자열
  columns: Array<{ header: string; eggshell: string }>
}

export function buildOutputOne(views: PresetPrintView[]): OutputOneGroup[] {
  const map = new Map<string, PresetPrintView[]>()
  for (const view of views) {
    const list = map.get(view.productLabel) ?? []
    list.push(view)
    map.set(view.productLabel, list)
  }

  return [...map.entries()]
    .map(([name, groupViews]) => ({
      name,
      columns: sortViewsByCode(groupViews).map((view) => ({
        header: formatCodeWithInput(view.preset),
        eggshell: formatWeight(eggshellWeight(view)),
      })),
    }))
    // 열 수 적은 표부터 → 작은 표들이 한 줄에 나란히 패킹됨 (동수는 이름순).
    .sort(
      (a, b) =>
        a.columns.length - b.columns.length ||
        a.name.localeCompare(b.name, 'ko'),
    )
}

// ---------- 출력 2: 난각분 단독 표 + 코드 prefix별 치환명 표 ----------

export type OutputTwoAliasGroup = {
  name: string // 코드 prefix (A, B, ...)
  codes: string[] // 컬럼 헤더 (프리셋 코드)
  rows: Array<{ displayName: string; weights: string[] }> // codes와 같은 순서
}

export type OutputTwo = {
  eggshellWeights: string[] // >0만, 내림차순, "Ng"
  aliasGroups: OutputTwoAliasGroup[]
}

function codePrefix(code: string): string {
  const match = code.trim().match(/^[A-Za-z]+/)
  return match ? match[0]!.toUpperCase() : '기타'
}

function hasAlias(row: PrintSupplementRow): boolean {
  const display = row.displayName.trim()
  return Boolean(display) && display !== row.name.trim()
}

export function buildOutputTwo(views: PresetPrintView[]): OutputTwo {
  const eggshellWeights = views
    .map(eggshellWeight)
    .filter((weight) => weight > 0)
    .sort((a, b) => b - a)
    .map((weight) => `${fmtWeight(weight)}g`)

  const groupMap = new Map<string, PresetPrintView[]>()
  for (const view of views) {
    const prefix = codePrefix(view.preset.code)
    const list = groupMap.get(prefix) ?? []
    list.push(view)
    groupMap.set(prefix, list)
  }

  const aliasGroups = [...groupMap.entries()]
    .map(([name, groupViews]) => {
      const sorted = sortViewsByCode(groupViews)
      const rowMap = new Map<string, Map<string, number>>()
      for (const view of sorted) {
        for (const supplement of view.supplements) {
          if (EGGSHELL_RE.test(supplement.name)) continue
          if (!hasAlias(supplement)) continue
          const weights = rowMap.get(supplement.displayName) ?? new Map()
          weights.set(view.preset.id, supplement.scaledWeight)
          rowMap.set(supplement.displayName, weights)
        }
      }
      return {
        name,
        codes: sorted.map((view) => view.preset.code),
        rows: [...rowMap.entries()]
          .sort((a, b) => a[0].localeCompare(b[0], 'ko'))
          .map(([displayName, weights]) => ({
            displayName,
            weights: sorted.map((view) =>
              formatWeight(weights.get(view.preset.id) ?? 0),
            ),
          })),
      }
    })
    .filter((group) => group.rows.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  return { eggshellWeights, aliasGroups }
}
