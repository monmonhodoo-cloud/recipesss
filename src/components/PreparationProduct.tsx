import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, Plus } from 'lucide-react'
import {
  speciesLabel,
  formatPresetInput,
  type OrderGroup,
} from '../features/orders/orderSelectors'
import { preparationIssues } from '../features/orders/orderSnapshot'
import { normalizePresetCodes } from '../features/presets/presetCodes'
import { useApplyDraftPresets } from '../features/presets/presetMutations'
import { getPresetRatioInfo } from '../features/presets/presetRatio'
import {
  buildPresetPrintViews,
  formatWeight,
} from '../features/print/printSelectors'
import type { Ingredient, Preset, RecipeDraft } from '../types/recipe'

export function PreparationProduct({
  group,
  draft,
  drafts,
  presets,
  ingredients,
  selected,
  onSelect,
  uid,
  busy,
}: {
  group: OrderGroup
  draft: RecipeDraft
  drafts: RecipeDraft[]
  presets: Preset[]
  ingredients: Ingredient[]
  selected: Set<string>
  onSelect: (ids: string[], checked: boolean) => void
  uid: string | undefined
  busy: boolean
}) {
  const sectionId = useId()
  const [expanded, setExpanded] = useState(false)
  const [viewId, setViewId] = useState('')
  const [adding, setAdding] = useState(false)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const applyPresets = useApplyDraftPresets(uid)
  const currentPreset =
    group.presets.find((item) => item.id === viewId) ?? group.presets[0]
  const view = currentPreset
    ? buildPresetPrintViews([currentPreset.id], presets, drafts, ingredients)[0]
    : undefined
  const allChecked =
    group.presets.length > 0 &&
    group.presets.every((item) => selected.has(item.id))
  const viewIssues =
    currentPreset && view
      ? preparationIssues([currentPreset.id], [view], ingredients)
      : []
  const unit = getPresetRatioInfo(draft, draft.unitIngredientId, 1)
  const unitName = ingredients.find(
    (item) => item.id === draft.unitIngredientId,
  )?.name
  const pending = busy || applyPresets.isPending

  async function addPreset() {
    setError('')
    const inputAmount = Number(amount)
    const info = getPresetRatioInfo(draft, draft.unitIngredientId, inputAmount)
    if (
      !Number.isFinite(inputAmount) ||
      !info.hasInput ||
      !Number.isFinite(info.targetWeight)
    ) {
      setError('프리셋 값을 0보다 크게 입력해주세요.')
      return
    }
    if (
      group.presets.some(
        (item) =>
          (item.unitIngredientId || draft.unitIngredientId) ===
            draft.unitIngredientId && item.inputAmount === inputAmount,
      )
    ) {
      setError('같은 값의 프리셋이 이미 있습니다.')
      return
    }
    const created: Preset = {
      id: `preset_${crypto.randomUUID()}`,
      draftId: draft.id,
      code: '',
      label: '',
      unitIngredientId: draft.unitIngredientId,
      inputAmount,
      inputUnitLabel: info.inputUnitLabel,
      targetWeight: info.targetWeight,
      sortOrder: 0,
      createdAt: Date.now(),
    }
    try {
      await applyPresets.mutateAsync({
        upserts: normalizePresetCodes([...presets, created], drafts, draft.id),
        deleteIds: [],
      })
      setViewId(created.id)
      setAmount('')
      setAdding(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '프리셋을 저장하지 못했습니다.',
      )
    }
  }

  return (
    <article className="prep-product">
      <div className="prep-producttop">
        <div className="prep-titleline">
          <h2>{group.draftName}</h2>
          <span className="prep-meta">
            {speciesLabel(group.species)}
            {group.category ? ` · ${group.category}` : ''}
          </span>
        </div>
        <div className="prep-rowtools">
          {group.presets.length > 0 && (
            <button
              className="prep-textbutton"
              type="button"
              disabled={pending}
              onClick={() =>
                onSelect(
                  group.presets.map((item) => item.id),
                  !allChecked,
                )
              }
            >
              {allChecked ? '전체 해제' : '전체 선택'}
            </button>
          )}
          <button
            type="button"
            className="prep-textbutton"
            aria-expanded={expanded}
            aria-controls={`${sectionId}-detail`}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '영양제 접기' : '영양제 보기'}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>
      {draft.mergeReviewPending && (
        <p className="prep-error">
          원료 병합 결과를{' '}
          <Link to={`/recipes/${draft.id}`}>레시피 관리에서 확인</Link>해주세요.
        </p>
      )}
      <div className="prep-presets">
        {group.presets.map((preset) => (
          <label className="prep-preset" key={preset.id}>
            <input
              type="checkbox"
              aria-label={`${group.draftName} ${formatPresetInput(preset)} 프리셋`}
              checked={selected.has(preset.id)}
              disabled={pending || draft.mergeReviewPending}
              onChange={(event) => onSelect([preset.id], event.target.checked)}
            />
            <span>{formatPresetInput(preset)}</span>
          </label>
        ))}
        {!group.presets.length && (
          <span className="prep-meta">등록된 프리셋이 없습니다.</span>
        )}
        <button
          className="prep-add"
          type="button"
          aria-expanded={adding}
          aria-controls={`${sectionId}-add`}
          disabled={pending}
          onClick={() => {
            setAdding(!adding)
            setError('')
          }}
        >
          <Plus size={13} />
          프리셋 추가
        </button>
      </div>
      {adding && (
        <form
          className="prep-inlineform"
          id={`${sectionId}-add`}
          onSubmit={(event) => {
            event.preventDefault()
            if (!pending) void addPreset()
          }}
        >
          <div className="prep-detailhead">
            <span>
              {unitName ? `${unitName} 기준` : '기준 원료 연결이 필요합니다.'}
            </span>
            <Link className="prep-textbutton" to={`/recipes/${draft.id}`}>
              기준·프리셋 관리 →
            </Link>
          </div>
          {unit.hasInput ? (
            <div className="prep-formrow">
              <label htmlFor={`${sectionId}-amount`}>프리셋 값</label>
              <input
                autoFocus
                id={`${sectionId}-amount`}
                className="prep-number"
                type="number"
                inputMode="decimal"
                min="0.001"
                step="any"
                value={amount}
                disabled={pending}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="예: 20"
              />
              <span>{unit.inputUnitLabel}</span>
              <button
                className="prep-button prep-primary"
                type="submit"
                disabled={pending}
              >
                {applyPresets.isPending ? '저장 중…' : '프리셋 저장'}
              </button>
              <button
                className="prep-textbutton"
                type="button"
                disabled={pending}
                onClick={() => setAdding(false)}
              >
                취소
              </button>
            </div>
          ) : (
            <p className="prep-meta">
              레시피 관리에서 기준 원료와 중량을 설정해주세요.
            </p>
          )}
          {error && (
            <p className="prep-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
      {expanded && (
        <div className="prep-detail" id={`${sectionId}-detail`}>
          <div className="prep-detailhead">
            <label>
              영양제 확인{' '}
              {currentPreset && (
                <select
                  aria-label={`${group.draftName} 확인할 프리셋`}
                  value={currentPreset.id}
                  onChange={(event) => setViewId(event.target.value)}
                >
                  {group.presets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatPresetInput(item)} 프리셋
                    </option>
                  ))}
                </select>
              )}
            </label>
            <Link className="prep-textbutton" to={`/recipes/${draft.id}`}>
              레시피 관리 →
            </Link>
          </div>
          {viewIssues.length > 0 ? (
            <div className="prep-error" role="alert">
              {viewIssues.map((issue) => (
                <p key={issue}>{issue}</p>
              ))}
            </div>
          ) : view && view.supplements.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>영양제</th>
                  <th>직원용 치환명</th>
                  <th>계량 중량</th>
                </tr>
              </thead>
              <tbody>
                {view.supplements.map((row, index) => (
                  <tr key={`${row.ingredientId}-${index}`}>
                    <td>{row.name}</td>
                    <td>
                      {row.displayName !== row.name || /난각/.test(row.name) ? (
                        row.displayName
                      ) : (
                        <Link className="prep-error" to="/ingredients">
                          치환명 미설정
                        </Link>
                      )}
                    </td>
                    <td>{formatWeight(row.scaledWeight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="prep-meta">
              {currentPreset
                ? '출력할 영양제가 없습니다. 원료·영양제 구분과 숨김 설정을 확인해주세요.'
                : '프리셋을 추가하면 해당 단위의 영양제를 확인할 수 있습니다.'}
            </p>
          )}
        </div>
      )}
    </article>
  )
}
