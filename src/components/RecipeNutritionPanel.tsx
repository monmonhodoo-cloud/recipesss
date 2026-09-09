import { useMemo, useState } from 'react'

import { sumRecipeNutrients, totalWeightG } from '../features/nutrition/calc'
import {
  evaluateDraft,
  evaluateRatios,
  type AdequacyResult,
  type AdequacyStatus,
  type Basis,
} from '../features/nutrition/evaluate'
import {
  CATEGORY_LABELS,
  NUTRIENT_META,
  nutrientMeta,
  type NutrientCategory,
} from '../features/nutrition/nutrientKeys'
import { profilesForSpecies } from '../features/nutrition/profiles'
import { useSaveDeclaredNutrients } from '../features/recipes/recipeMutations'
import { CARD_CLS, PRIMARY_BTN_CLS, SECONDARY_BTN_CLS } from '../lib/ui'
import type {
  Ingredient,
  NutrientKey,
  NutrientProfile,
  NutrientValues,
  RecipeDraft,
} from '../types/recipe'

const CATEGORY_ORDER: NutrientCategory[] = [
  'general',
  'amino',
  'fatty',
  'mineral',
  'vitamin',
]

const BASIS_LABEL: Record<Basis, string> = {
  per_1000_kcal_ME: '1000kcal ME당',
  dry_matter: '건물(DM) 100g당',
}

const STATUS_STYLE: Record<AdequacyStatus, string> = {
  ok: 'bg-green-50 text-green-700',
  deficient: 'bg-red-50 text-red-700',
  excess: 'bg-amber-50 text-amber-700',
}

const STATUS_LABEL: Record<AdequacyStatus, string> = {
  ok: '적정',
  deficient: '부족',
  excess: '초과',
}

const STATUS_PRIORITY: Record<AdequacyStatus, number> = {
  ok: 0,
  excess: 1,
  deficient: 2,
}

type ProfileEvaluation = {
  profile: NutrientProfile
  results: AdequacyResult[]
  ratios: ReturnType<typeof evaluateRatios>
}

type StandardTag = {
  profile: NutrientProfile
  result: AdequacyResult
}

type NutrientRow = {
  nutrient: NutrientKey
  actual: number
  status: AdequacyStatus
  tags: StandardTag[]
  isDeclared: boolean
}

function formatValue(value: number): string {
  if (value === 0) return '0'
  if (Math.abs(value) >= 100) return value.toFixed(0)
  if (Math.abs(value) >= 1) return value.toFixed(2)
  return value.toPrecision(3)
}

function formatRange(min: number | undefined, max: number | undefined): string {
  const lo = min === undefined ? '-' : formatValue(min)
  const hi = max === undefined ? '∞' : formatValue(max)
  return `${lo} ~ ${hi}`
}

function profileTag(profile: NutrientProfile): string {
  const stage =
    profile.lifeStage === 'adult'
      ? '성체'
      : profile.lifeStage === 'early_growth_repro'
        ? '성장'
        : profile.lifeStage === 'late_growth'
          ? '후기성장'
          : profile.lifeStage
  const merNum = profile.mer?.match(/\d+/)?.[0]
  const mer = merNum ? `(${merNum})` : ''
  return `${profile.standard} ${stage}${mer}`
}

function formatThreshold(
  min: number | undefined,
  max: number | undefined,
): string {
  const lo = min === undefined ? '-' : formatValue(min)
  if (max === undefined) return lo
  return `${lo}~${formatValue(max)}`
}

function worseStatus(
  current: AdequacyStatus,
  next: AdequacyStatus,
): AdequacyStatus {
  return STATUS_PRIORITY[next] > STATUS_PRIORITY[current] ? next : current
}

export function RecipeNutritionPanel({
  draft,
  ingredients,
  uid,
}: {
  draft: RecipeDraft
  ingredients: Ingredient[]
  uid: string | undefined
}) {
  const [basis, setBasis] = useState<Basis>('per_1000_kcal_ME')
  const save = useSaveDeclaredNutrients(uid)
  const [saveError, setSaveError] = useState('')

  const totalWeight = totalWeightG(draft)

  const ingredientMap = useMemo(
    () => Object.fromEntries(ingredients.map((item) => [item.id, item])),
    [ingredients],
  )

  const calcTotals = useMemo(
    () => sumRecipeNutrients(draft, ingredientMap),
    [draft, ingredientMap],
  )

  const per100g = (total: number) =>
    totalWeight > 0 ? (total * 100) / totalWeight : 0

  // 확정값 입력 폼 — 100g당 표시.
  const initialForm = useMemo(() => {
    const form: Partial<Record<NutrientKey, string>> = {}
    for (const meta of NUTRIENT_META) {
      const declaredTotal = draft.declaredNutrients?.[meta.key]
      form[meta.key] =
        declaredTotal === undefined ? '' : formatValue(per100g(declaredTotal))
    }
    return form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id, draft.declaredNutrients, totalWeight])

  const [form, setForm] = useState<Partial<Record<NutrientKey, string>>>(
    initialForm,
  )
  const [formKey, setFormKey] = useState(draft.id)
  if (formKey !== draft.id) {
    setFormKey(draft.id)
    setForm(initialForm)
  }

  function setField(key: NutrientKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // 로컬 폼 → 로컬 declaredNutrients (totals) 변환. 저장 전 실시간 평가용.
  const localDeclared = useMemo<NutrientValues>(() => {
    if (totalWeight <= 0) return {}
    const declared: NutrientValues = {}
    for (const meta of NUTRIENT_META) {
      const raw = (form[meta.key] ?? '').trim()
      if (raw === '') continue
      const value = Number(raw)
      if (Number.isFinite(value) && value >= 0) {
        declared[meta.key] = (value * totalWeight) / 100
      }
    }
    return declared
  }, [form, totalWeight])

  // 실시간 평가용 가상 draft — 로컬 폼을 반영.
  const virtualDraft = useMemo(
    () => ({
      ...draft,
      declaredNutrients: { ...draft.declaredNutrients, ...localDeclared },
    }),
    [draft, localDeclared],
  )

  const profiles = useMemo(
    () => (draft.species === null ? [] : profilesForSpecies(draft.species)),
    [draft.species],
  )

  const evaluations = useMemo<ProfileEvaluation[]>(
    () =>
      profiles.map((profile) => ({
        profile,
        results: evaluateDraft(virtualDraft, ingredientMap, profile, basis),
        ratios: evaluateRatios(virtualDraft, ingredientMap, profile),
      })),
    [basis, virtualDraft, ingredientMap, profiles],
  )

  const rowsByNutrient = useMemo(() => {
    const map = new Map<NutrientKey, NutrientRow>()
    for (const evaluation of evaluations) {
      for (const result of evaluation.results) {
        const existing = map.get(result.nutrient)
        const isDeclared =
          virtualDraft.declaredNutrients?.[result.nutrient] !== undefined
        if (existing) {
          existing.status = worseStatus(existing.status, result.status)
          existing.tags.push({ profile: evaluation.profile, result })
        } else {
          map.set(result.nutrient, {
            nutrient: result.nutrient,
            actual: result.actual,
            status: result.status,
            tags: [{ profile: evaluation.profile, result }],
            isDeclared,
          })
        }
      }
    }
    return map
  }, [evaluations, virtualDraft.declaredNutrients])

  const ratioRows = useMemo(
    () =>
      evaluations.flatMap((evaluation) =>
        evaluation.ratios.map((ratio) => ({
          profile: evaluation.profile,
          ratio,
        })),
      ),
    [evaluations],
  )

  const summary = useMemo(() => {
    let deficient = 0
    let excess = 0
    for (const row of rowsByNutrient.values()) {
      if (row.status === 'deficient') deficient += 1
      if (row.status === 'excess') excess += 1
    }
    return { deficient, excess, total: rowsByNutrient.size }
  }, [rowsByNutrient])

  function buildDeclared(): NutrientValues | null {
    if (totalWeight <= 0) return {}
    const declared: NutrientValues = {}
    for (const meta of NUTRIENT_META) {
      const raw = (form[meta.key] ?? '').trim()
      if (raw === '') continue
      const value = Number(raw)
      if (!Number.isFinite(value) || value < 0) {
        setSaveError(`${meta.label} 값이 올바르지 않습니다.`)
        return null
      }
      declared[meta.key] = (value * totalWeight) / 100
    }
    return declared
  }

  async function handleSave() {
    setSaveError('')
    const declared = buildDeclared()
    if (!declared) return
    try {
      await save.mutateAsync({
        draftId: draft.id,
        declaredNutrients: declared,
        now: Date.now(),
      })
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : '확정값 저장에 실패했습니다.',
      )
    }
  }

  async function handleReset() {
    setSaveError('')
    try {
      await save.mutateAsync({
        draftId: draft.id,
        declaredNutrients: {},
        now: Date.now(),
      })
      setForm({})
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : '초기화에 실패했습니다.',
      )
    }
  }

  return (
    <div className={`mt-4 ${CARD_CLS} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">영양 매트릭스</h2>
          <p className="mt-1 text-xs text-gray-500">
            확정값 입력 시 해당 영양소를 확정값 기준으로 평가합니다 (DL-027/028).
            구성 원료 저장 시 확정값은 초기화됩니다 (DL-029).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-gray-300 text-xs">
            {(['per_1000_kcal_ME', 'dry_matter'] as Basis[]).map((option) => (
              <button
                className={
                  basis === option
                    ? 'bg-gray-800 px-3 py-2 text-white'
                    : 'bg-white px-3 py-2 text-gray-600 hover:bg-gray-50'
                }
                key={option}
                onClick={() => setBasis(option)}
                type="button"
              >
                {BASIS_LABEL[option]}
              </button>
            ))}
          </div>
          {totalWeight > 0 && (
            <>
              <button
                className={SECONDARY_BTN_CLS}
                disabled={save.isPending}
                onClick={() => void handleReset()}
                type="button"
              >
                초기화
              </button>
              <button
                className={PRIMARY_BTN_CLS}
                disabled={save.isPending}
                onClick={() => void handleSave()}
                type="button"
              >
                {save.isPending ? '저장 중...' : '확정값 저장'}
              </button>
            </>
          )}
        </div>
      </div>

      {saveError && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {saveError}
        </div>
      )}

      {profiles.length === 0 && (
        <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          종이 정해져 있지 않아 적용할 표준 프로파일이 없습니다.
        </div>
      )}

      {profiles.length > 0 && (
        <>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span
              className={`rounded-full px-3 py-1 ${
                summary.deficient + summary.excess === 0
                  ? STATUS_STYLE.ok
                  : STATUS_STYLE.deficient
              }`}
            >
              종합: 부족 {summary.deficient} · 초과 {summary.excess} / 평가{' '}
              {summary.total}
            </span>
            {ratioRows.map(({ profile, ratio }) => (
              <span
                className={`rounded-full px-3 py-1 ${STATUS_STYLE[ratio.status]}`}
                key={`${profile.id}-${ratio.ratio}`}
              >
                Ca:P {formatValue(ratio.actual)} · {profileTag(profile)} 기준{' '}
                {formatRange(ratio.min, ratio.max)}
              </span>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <th className="px-2 py-1">영양소</th>
                  <th className="px-2 py-1 text-right">확정값 (100g당)</th>
                  <th className="px-2 py-1 text-right">값</th>
                  <th className="px-2 py-1">종합</th>
                  <th className="px-2 py-1">표준별 기준</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORY_ORDER.map((category) => {
                  const rows = NUTRIENT_META.filter(
                    (meta) =>
                      meta.category === category &&
                      rowsByNutrient.has(meta.key),
                  )
                  if (rows.length === 0) return null
                  return (
                    <CategoryRows
                      calcPer100g={(key) => per100g(calcTotals[key] ?? 0)}
                      category={category}
                      form={form}
                      key={category}
                      metas={rows}
                      onChange={setField}
                      rowsByNutrient={rowsByNutrient}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function CategoryRows({
  calcPer100g,
  category,
  form,
  metas,
  onChange,
  rowsByNutrient,
}: {
  calcPer100g: (key: NutrientKey) => number
  category: NutrientCategory
  form: Partial<Record<NutrientKey, string>>
  metas: typeof NUTRIENT_META
  onChange: (key: NutrientKey, value: string) => void
  rowsByNutrient: Map<NutrientKey, NutrientRow>
}) {
  return (
    <>
      <tr className="bg-gray-50/60">
        <td
          className="px-2 py-0.5 text-xs font-semibold text-gray-500"
          colSpan={5}
        >
          {CATEGORY_LABELS[category]}
        </td>
      </tr>
      {metas.map((meta) => {
        const row = rowsByNutrient.get(meta.key)
        if (!row) return null
        const hasDeclared = (form[meta.key] ?? '').trim() !== ''
        return (
          <tr className="border-b border-gray-100 text-gray-700" key={meta.key}>
            <td className="px-2 py-1">{nutrientMeta(meta.key).label}</td>
            <td className="px-2 py-1">
              <div className="flex items-center justify-end gap-1">
                <input
                  className={`w-20 rounded border px-1.5 py-0.5 text-right text-xs focus:outline-none ${
                    hasDeclared
                      ? 'border-blue-400 bg-blue-50 text-blue-800 focus:border-blue-500'
                      : 'border-gray-200 bg-white text-gray-700 focus:border-gray-400'
                  }`}
                  inputMode="decimal"
                  onChange={(e) => onChange(meta.key, e.target.value)}
                  placeholder={formatValue(calcPer100g(meta.key))}
                  type="number"
                  value={form[meta.key] ?? ''}
                />
                <span className="w-4 shrink-0 text-gray-400">{meta.unit}</span>
              </div>
            </td>
            <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums">
              <span className={hasDeclared ? 'font-medium text-blue-700' : ''}>
                {formatValue(row.actual)}
              </span>
              <span className="ml-0.5 text-gray-400">{meta.unit}</span>
            </td>
            <td className="px-2 py-1">
              <span
                className={`rounded px-1.5 py-0.5 ${STATUS_STYLE[row.status]}`}
              >
                {STATUS_LABEL[row.status]}
              </span>
            </td>
            <td className="px-2 py-1">
              <div className="flex flex-wrap gap-1">
                {row.tags.map(({ profile, result }) => (
                  <span
                    className={`whitespace-nowrap rounded px-1.5 py-0.5 ${
                      STATUS_STYLE[result.status]
                    }`}
                    key={profile.id}
                    title={`${profile.label} (${profile.standard})`}
                  >
                    {profileTag(profile)} {formatThreshold(result.min, result.max)}
                  </span>
                ))}
              </div>
            </td>
          </tr>
        )
      })}
    </>
  )
}
