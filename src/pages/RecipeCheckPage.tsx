import { useMemo, useState } from 'react'

import { useIngredients } from '../features/ingredients/ingredientQueries'
import { useRecipeDrafts } from '../features/recipes/recipeQueries'
import { CARD_CLS, INPUT_CLS } from '../lib/ui'
import { useAuthStore } from '../stores/authStore'
import type { RecipeDraft } from '../types/recipe'

const EMPTY_DRAFTS: RecipeDraft[] = []

export function RecipeCheckPage() {
  const uid = useAuthStore((s) => s.user?.uid)
  const { data: drafts = EMPTY_DRAFTS } = useRecipeDrafts(uid)
  const { data: ingredients = [] } = useIngredients(uid)

  const activeDrafts = useMemo(
    () => drafts.filter((d) => d.status !== 'inactive'),
    [drafts],
  )

  const [selectedId, setSelectedId] = useState<string>('')
  // 생산단위 원료의 목표 중량 (kg)
  const [targetKg, setTargetKg] = useState<number>(1)

  const draft = useMemo(
    () => activeDrafts.find((d) => d.id === selectedId) ?? null,
    [activeDrafts, selectedId],
  )

  const ingMap = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients],
  )

  // 생산단위 원료 1단위 중량(g) — 스케일 기준
  const unitIngRow = useMemo(
    () =>
      draft?.composition.find(
        (r) => r.ingredientId === draft.unitIngredientId,
      ) ?? null,
    [draft],
  )

  const unitIngName = useMemo(
    () =>
      draft
        ? (ingMap.get(draft.unitIngredientId)?.name ?? draft.unitIngredientId)
        : '',
    [draft, ingMap],
  )

  // 스케일 = 목표(g) / 단위원료 1단위(g)
  const scale = useMemo(() => {
    if (!unitIngRow || unitIngRow.weight <= 0) return 1
    const targetG = targetKg * 1000
    return targetG / unitIngRow.weight
  }, [unitIngRow, targetKg])

  const rows = useMemo(() => {
    if (!draft) return []
    return draft.composition.map((row) => {
      const ing = ingMap.get(row.ingredientId)
      const baseG = row.weight
      const totalG = baseG * scale
      return {
        id: row.ingredientId,
        name: ing?.name ?? row.ingredientId,
        isUnit: row.ingredientId === draft.unitIngredientId,
        baseG,
        totalG,
      }
    })
  }, [draft, scale, ingMap])

  const totalBaseG = useMemo(() => rows.reduce((s, r) => s + r.baseG, 0), [rows])
  const totalG = useMemo(() => rows.reduce((s, r) => s + r.totalG, 0), [rows])

  function fmtG(g: number) {
    if (g >= 1000) return `${(g / 1000).toFixed(3)} kg`
    return `${g % 1 === 0 ? g : g.toFixed(1)} g`
  }

  // 단위수 표시 (소수점 1자리)
  const unitCount = unitIngRow && unitIngRow.weight > 0
    ? (targetKg * 1000) / unitIngRow.weight
    : 0

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-base font-semibold text-gray-800">레시피 확인</h1>

      {/* 레시피 선택 + 생산단위 입력 */}
      <div className={`${CARD_CLS} p-3`}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-40">
            <label className="mb-1 block text-xs text-gray-500">레시피</label>
            <select
              className={INPUT_CLS}
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value)
                setTargetKg(1)
              }}
            >
              <option value="">— 선택 —</option>
              {activeDrafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.category ? ` (${d.category})` : ''}
                </option>
              ))}
            </select>
          </div>

          {draft && (
            <div className="w-44">
              <label className="mb-1 block text-xs text-gray-500">
                {unitIngName} 목표 중량 (kg)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  className={INPUT_CLS}
                  type="number"
                  min={0.001}
                  step={0.5}
                  value={targetKg}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    setTargetKg(Number.isFinite(v) && v > 0 ? v : 1)
                  }}
                />
                <span className="shrink-0 text-sm text-gray-500">kg</span>
              </div>
            </div>
          )}
        </div>

        {/* 생산단위 정보 */}
        {draft && unitIngRow && (
          <p className="mt-2 text-xs text-gray-400">
            생산단위 기준 원료: <span className="font-medium text-gray-600">{unitIngName}</span>
            {' '}(1단위 {fmtG(unitIngRow.weight)})
            {draft.unitLabel ? ` — ${unitIngName} ${targetKg}kg = 약 ${unitCount % 1 === 0 ? unitCount : unitCount.toFixed(1)}${draft.unitLabel}` : ''}
          </p>
        )}
      </div>

      {/* 원료 중량 테이블 */}
      {draft && (
        <div className={`${CARD_CLS} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">원료</th>
                <th className="px-3 py-2 text-right font-medium">1단위 중량</th>
                <th className="px-3 py-2 text-right font-medium">
                  {unitIngName} {targetKg}kg 기준 합계
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={r.isUnit ? 'bg-blue-50/50' : 'hover:bg-gray-50'}
                >
                  <td className="px-3 py-1.5 text-gray-800">
                    {r.name}
                    {r.isUnit && (
                      <span className="ml-1.5 text-xs text-blue-500">기준</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">
                    {fmtG(r.baseG)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium text-gray-800">
                    {fmtG(r.totalG)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 text-xs font-semibold">
              <tr>
                <td className="px-3 py-2 text-gray-700">합계</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {fmtG(totalBaseG)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-800">
                  {fmtG(totalG)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!draft && selectedId === '' && (
        <p className="text-sm text-gray-400">레시피를 선택하면 중량이 표시됩니다.</p>
      )}
    </div>
  )
}
