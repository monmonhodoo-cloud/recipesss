import { useMemo, useState } from 'react'

import { useSaveComposition } from '../features/recipes/recipeMutations'
import {
  CARD_CLS,
  CELL_INPUT_CLS,
  INLINE_DANGER_CLS,
  INPUT_CLS,
  PRIMARY_BTN_CLS,
  SECONDARY_BTN_CLS,
} from '../lib/ui'
import type {
  CompositionRow,
  Ingredient,
  RecipeDraft,
  WeightUnit,
} from '../types/recipe'

type EditRow = {
  ingredientId: string
  weight: string
  unit: WeightUnit
}

export function CompositionEditor({
  draft,
  ingredients,
  onRefreshIngredients,
  isRefreshingIngredients = false,
  uid,
}: {
  draft: RecipeDraft
  ingredients: Ingredient[]
  onRefreshIngredients?: () => void
  isRefreshingIngredients?: boolean
  uid: string | undefined
}) {
  const save = useSaveComposition(uid)
  const [errorMsg, setErrorMsg] = useState('')
  const [formKey, setFormKey] = useState(draft.id)

  const sortedIngredients = useMemo(
    () =>
      [...ingredients].sort(
        (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
      ),
    [ingredients],
  )
  const nameById = useMemo(
    () => new Map(ingredients.map((item) => [item.id, item.name])),
    [ingredients],
  )
  const hasProfileById = useMemo(
    () =>
      new Map(
        ingredients.map((item) => [
          item.id,
          Boolean(
            item.nutrientProfile &&
            Object.keys(item.nutrientProfile).length > 0,
          ),
        ]),
      ),
    [ingredients],
  )

  function initialRows(): EditRow[] {
    return draft.composition.map((row) => ({
      ingredientId: row.ingredientId,
      weight: String(row.weight),
      unit: row.unit,
    }))
  }

  const [rows, setRows] = useState<EditRow[]>(initialRows)
  const [unitIngredientId, setUnitIngredientId] = useState(
    draft.unitIngredientId,
  )
  const [unitLabel, setUnitLabel] = useState(draft.unitLabel)

  // draft 전환 시 폼 리셋.
  if (formKey !== draft.id) {
    setFormKey(draft.id)
    setRows(initialRows())
    setUnitIngredientId(draft.unitIngredientId)
    setUnitLabel(draft.unitLabel)
    setErrorMsg('')
  }

  function updateRow(index: number, patch: Partial<EditRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    )
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function moveRow(index: number, delta: number) {
    setRows((prev) => {
      const next = [...prev]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved!)
      return next
    })
  }

  function addRow() {
    const first = sortedIngredients[0]
    if (!first) {
      setErrorMsg('추가할 원료가 없습니다. 원료 마스터에서 먼저 등록하세요.')
      return
    }
    setRows((prev) => [
      ...prev,
      { ingredientId: first.id, weight: '0', unit: 'g' },
    ])
  }

  async function handleSave() {
    setErrorMsg('')
    if (rows.length === 0) {
      setErrorMsg('구성 원료를 1개 이상 추가하세요.')
      return
    }

    const composition: CompositionRow[] = []
    for (const [index, row] of rows.entries()) {
      if (!nameById.has(row.ingredientId)) {
        setErrorMsg(
          `${index + 1}번째 행의 원료가 연결되지 않았습니다. 원료 목록을 새로고침하거나 다시 선택해주세요.`,
        )
        return
      }
      const weight = Number(row.weight)
      if (!Number.isFinite(weight) || weight <= 0) {
        setErrorMsg(
          `${nameById.get(row.ingredientId) ?? '원료'} 중량이 올바르지 않습니다.`,
        )
        return
      }
      composition.push({
        ingredientId: row.ingredientId,
        weight,
        unit: row.unit,
        sortOrder: index,
      })
    }

    // 생산단위 원료가 행에서 사라졌으면 첫 행으로.
    const ids = new Set(composition.map((row) => row.ingredientId))
    const nextUnitId = ids.has(unitIngredientId)
      ? unitIngredientId
      : (composition[0]?.ingredientId ?? '')

    try {
      await save.mutateAsync({
        draftId: draft.id,
        composition,
        unitIngredientId: nextUnitId,
        unitLabel: unitLabel.trim(),
        now: Date.now(),
      })
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '구성 저장에 실패했습니다.',
      )
    }
  }

  return (
    <div className={`mt-4 ${CARD_CLS} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">
            구성 원료 편집
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            저장하면 확정값은 새 계산값을 따르도록 초기화됩니다 (DL-029).
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">
              생산 단위 라벨
            </span>
            <input
              className={`${INPUT_CLS} w-28`}
              onChange={(event) => setUnitLabel(event.target.value)}
              placeholder="예: 마리"
              type="text"
              value={unitLabel}
            />
          </label>
          <button
            className={PRIMARY_BTN_CLS}
            disabled={save.isPending}
            onClick={() => void handleSave()}
            type="button"
          >
            {save.isPending ? '저장 중...' : '구성 저장'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
              <th className="px-2 py-2">순서</th>
              <th className="px-2 py-2">원료</th>
              <th className="px-2 py-2 text-right">중량</th>
              <th className="px-2 py-2">단위</th>
              <th className="px-2 py-2 text-center">생산단위</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr className="border-b border-gray-100" key={index}>
                <td className="px-2 py-2 text-xs text-gray-400">
                  <div className="flex gap-1">
                    <button
                      className="rounded border border-gray-200 px-1 hover:bg-gray-50"
                      disabled={index === 0}
                      onClick={() => moveRow(index, -1)}
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      className="rounded border border-gray-200 px-1 hover:bg-gray-50"
                      disabled={index === rows.length - 1}
                      onClick={() => moveRow(index, 1)}
                      type="button"
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td className="px-2 py-2">
                  <select
                    aria-label={`${index + 1}번째 원료`}
                    className={CELL_INPUT_CLS}
                    onChange={(event) =>
                      updateRow(index, { ingredientId: event.target.value })
                    }
                    value={row.ingredientId}
                  >
                    {!nameById.has(row.ingredientId) && (
                      <option disabled value={row.ingredientId}>
                        연결된 원료 없음 — 다시 선택하세요
                      </option>
                    )}
                    {sortedIngredients.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>
                        {ingredient.name}
                        {ingredient.kind === 'supplement' ? ' (영양제)' : ''}
                      </option>
                    ))}
                  </select>
                  {!nameById.has(row.ingredientId) ? (
                    <div className="mt-1 text-xs text-red-700">
                      <p>원료 목록에서 찾을 수 없습니다.</p>
                      {onRefreshIngredients && (
                        <button
                          className="mt-1 underline disabled:opacity-50"
                          disabled={isRefreshingIngredients}
                          onClick={onRefreshIngredients}
                          type="button"
                        >
                          {isRefreshingIngredients
                            ? '원료 확인 중…'
                            : '원료 목록 새로고침'}
                        </button>
                      )}
                    </div>
                  ) : (
                    !hasProfileById.get(row.ingredientId) && (
                      <span className="mt-0.5 block text-[11px] text-amber-600">
                        영양값 없음 (매트릭스 미반영)
                      </span>
                    )
                  )}
                </td>
                <td className="px-2 py-2">
                  <input
                    className={`${CELL_INPUT_CLS} text-right`}
                    inputMode="decimal"
                    onChange={(event) =>
                      updateRow(index, { weight: event.target.value })
                    }
                    type="number"
                    value={row.weight}
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    className={CELL_INPUT_CLS}
                    onChange={(event) =>
                      updateRow(index, {
                        unit: event.target.value as WeightUnit,
                      })
                    }
                    value={row.unit}
                  >
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                  </select>
                </td>
                <td className="px-2 py-2 text-center">
                  <input
                    checked={unitIngredientId === row.ingredientId}
                    name="unitIngredient"
                    onChange={() => setUnitIngredientId(row.ingredientId)}
                    type="radio"
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    className={INLINE_DANGER_CLS}
                    onClick={() => removeRow(index)}
                    type="button"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        className={`${SECONDARY_BTN_CLS} mt-3`}
        onClick={addRow}
        type="button"
      >
        + 원료 추가
      </button>
    </div>
  )
}
