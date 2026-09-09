import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { CompositionEditor } from '../components/CompositionEditor'
import { RecipeNutritionPanel } from '../components/RecipeNutritionPanel'
import { useIngredients } from '../features/ingredients/ingredientQueries'
import {
  countSupplements,
  draftToRecipe,
  speciesToTarget,
} from '../features/recipes/draftToRecipe'
import {
  useRegisterRecipe,
  useSaveRecipeMeta,
} from '../features/recipes/recipeMutations'
import { normalizePresetCodes } from '../features/presets/presetCodes'
import { useApplyDraftPresets } from '../features/presets/presetMutations'
import { usePresets } from '../features/presets/presetQueries'
import { getPresetRatioInfo } from '../features/presets/presetRatio'
import { selectPresetsByDraft } from '../features/presets/presetSelectors'
import { RECIPE_CATEGORIES } from '../features/recipes/filterDrafts'
import { useRecipeDrafts } from '../features/recipes/recipeQueries'
import {
  CARD_CLS,
  EMPTY_STATE_CLS,
  INPUT_CLS,
  PRIMARY_BTN_CLS,
  SECONDARY_BTN_CLS,
} from '../lib/ui'
import { useAuthStore } from '../stores/authStore'
import type {
  Ingredient,
  Preset,
  RecipeCategory,
  RecipeDraft,
  Species,
} from '../types/recipe'

const EMPTY_DRAFTS: RecipeDraft[] = []
const EMPTY_PRESETS: Preset[] = []
const EMPTY_INGREDIENTS: Ingredient[] = []

function newPresetId(): string {
  return `preset_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
}

export function RecipeDetailPage() {
  const { draftId } = useParams<{ draftId: string }>()
  const uid = useAuthStore((state) => state.user?.uid)
  const draftsQuery = useRecipeDrafts(uid)
  const presetsQuery = usePresets(uid)
  const ingredientsQuery = useIngredients(uid)

  const drafts = draftsQuery.data ?? EMPTY_DRAFTS
  const presets = presetsQuery.data ?? EMPTY_PRESETS
  const ingredients = ingredientsQuery.data ?? EMPTY_INGREDIENTS

  const draft = useMemo(
    () => drafts.find((item) => item.id === draftId),
    [drafts, draftId],
  )

  const isLoading =
    draftsQuery.isLoading ||
    presetsQuery.isLoading ||
    ingredientsQuery.isLoading

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link
          className="text-sm text-gray-500 hover:text-gray-800"
          to="/recipes"
        >
          ← 레시피 목록
        </Link>
      </div>

      {isLoading && (
        <div className={`mt-4 ${EMPTY_STATE_CLS}`}>불러오는 중...</div>
      )}

      {!isLoading && !draft && (
        <div className={`mt-4 ${EMPTY_STATE_CLS}`}>
          레시피를 찾을 수 없습니다.
        </div>
      )}

      {!isLoading && draft && (
        <>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <RecipeHeaderEditor draft={draft} uid={uid} />
            <RegisterSection
              draft={draft}
              ingredients={ingredients}
              uid={uid}
            />
          </div>

          <RecipeNutritionPanel
            draft={draft}
            ingredients={ingredients}
            uid={uid}
          />

          <CompositionEditor
            draft={draft}
            ingredients={ingredients}
            uid={uid}
          />

          <PresetPanel
            draft={draft}
            ingredients={ingredients}
            presets={presets}
            drafts={drafts}
            uid={uid}
          />
        </>
      )}
    </div>
  )
}

function PresetPanel({
  draft,
  ingredients,
  presets,
  drafts,
  uid,
}: {
  draft: RecipeDraft
  ingredients: Ingredient[]
  presets: Preset[]
  drafts: RecipeDraft[]
  uid: string | undefined
}) {
  const applyPresets = useApplyDraftPresets(uid)
  const [unitIngredientId, setUnitIngredientId] = useState(
    draft.unitIngredientId,
  )
  const [amount, setAmount] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const ingredientName = useMemo(() => {
    const byId = new Map(ingredients.map((item) => [item.id, item.name]))
    return (id: string) => byId.get(id) || id
  }, [ingredients])

  const draftPresets = useMemo(
    () => selectPresetsByDraft(presets, draft.id),
    [presets, draft.id],
  )

  const inputAmount = Number.parseFloat(amount)
  const ratioInfo = getPresetRatioInfo(
    draft,
    unitIngredientId,
    Number.isFinite(inputAmount) ? inputAmount : 0,
  )
  const isPending = applyPresets.isPending

  function resetForm() {
    setUnitIngredientId(draft.unitIngredientId)
    setAmount('')
    setEditingId(null)
  }

  async function commit(upsertList: Preset[], deleteIds: string[]) {
    setErrorMsg('')
    try {
      const normalized = normalizePresetCodes(upsertList, drafts, draft.id)
      await applyPresets.mutateAsync({ upserts: normalized, deleteIds })
      resetForm()
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '프리셋 저장에 실패했습니다.',
      )
    }
  }

  async function handleSubmit() {
    if (!ratioInfo.hasInput) {
      setErrorMsg('프리셋 값을 0보다 크게 입력하세요.')
      return
    }

    if (editingId) {
      const next = presets.map((preset) =>
        preset.id === editingId
          ? {
              ...preset,
              unitIngredientId,
              inputAmount,
              inputUnitLabel: ratioInfo.inputUnitLabel,
              targetWeight: ratioInfo.targetWeight,
            }
          : preset,
      )
      await commit(next, [])
      return
    }

    const created: Preset = {
      id: newPresetId(),
      draftId: draft.id,
      code: '',
      targetWeight: ratioInfo.targetWeight,
      label: '',
      unitIngredientId,
      inputAmount,
      inputUnitLabel: ratioInfo.inputUnitLabel,
      sortOrder: 0,
      createdAt: Date.now(),
    }
    await commit([...presets, created], [])
  }

  function handleEdit(preset: Preset) {
    setEditingId(preset.id)
    setUnitIngredientId(preset.unitIngredientId)
    setAmount(String(preset.inputAmount))
    setErrorMsg('')
  }

  async function handleDelete(presetId: string) {
    await commit(
      presets.filter((preset) => preset.id !== presetId),
      [presetId],
    )
  }

  return (
    <div className={`mt-4 ${CARD_CLS} p-4`}>
      <h2 className="text-sm font-semibold text-gray-800">프리셋 관리</h2>
      <p className="mt-1 text-xs text-gray-500">
        기준 원료와 프리셋 값을 입력하면 중량·코드가 자동 계산됩니다.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            프리셋 기준 원료
          </span>
          <select
            className={INPUT_CLS}
            onChange={(event) => setUnitIngredientId(event.target.value)}
            value={unitIngredientId}
          >
            {draft.composition.map((row) => (
              <option key={row.ingredientId} value={row.ingredientId}>
                {ingredientName(row.ingredientId)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            프리셋 값
          </span>
          <input
            className={INPUT_CLS}
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="예: 20"
            type="number"
            value={amount}
          />
        </label>

        <div className="flex gap-2">
          <button
            className={PRIMARY_BTN_CLS}
            disabled={isPending || !ratioInfo.hasInput}
            onClick={() => void handleSubmit()}
            type="button"
          >
            {editingId ? '저장' : '추가'}
          </button>
          {editingId && (
            <button
              className={SECONDARY_BTN_CLS}
              disabled={isPending}
              onClick={resetForm}
              type="button"
            >
              취소
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        {ratioInfo.hasInput
          ? `→ 목표 중량 약 ${Math.round(ratioInfo.targetWeight)}g (${amount} ${ratioInfo.inputUnitLabel})`
          : '프리셋 값을 입력하세요.'}
      </p>

      {errorMsg && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {draftPresets.length === 0 && (
          <span className="text-xs text-gray-400">
            등록된 프리셋이 없습니다.
          </span>
        )}
        {draftPresets.map((preset) => (
          <div
            className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700"
            key={preset.id}
          >
            <span className="font-semibold text-gray-800">{preset.code}</span>
            <span className="text-gray-500">
              {preset.inputAmount} {preset.inputUnitLabel} →{' '}
              {Math.round(preset.targetWeight)}g
            </span>
            <button
              className="text-gray-400 hover:text-gray-700"
              disabled={isPending}
              onClick={() => handleEdit(preset)}
              type="button"
            >
              수정
            </button>
            <button
              className="text-red-400 hover:text-red-600"
              disabled={isPending}
              onClick={() => void handleDelete(preset.id)}
              type="button"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecipeHeaderEditor({
  draft,
  uid,
}: {
  draft: RecipeDraft
  uid: string | undefined
}) {
  const save = useSaveRecipeMeta(uid)
  const [name, setName] = useState(draft.name)
  const [species, setSpecies] = useState<Species>(draft.species)
  const [category, setCategory] = useState<RecipeCategory | ''>(
    draft.category ?? '',
  )
  const [status, setStatus] = useState<RecipeDraft['status']>(draft.status)
  const [formKey, setFormKey] = useState(draft.id)
  const [errorMsg, setErrorMsg] = useState('')

  if (formKey !== draft.id) {
    setFormKey(draft.id)
    setName(draft.name)
    setSpecies(draft.species)
    setCategory(draft.category ?? '')
    setStatus(draft.status)
    setErrorMsg('')
  }

  async function handleSave() {
    if (!name.trim()) {
      setErrorMsg('레시피 이름을 입력하세요.')
      return
    }
    setErrorMsg('')
    try {
      await save.mutateAsync({
        draftId: draft.id,
        name: name.trim(),
        species,
        category: category === '' ? undefined : category,
        status,
        now: Date.now(),
      })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '저장에 실패했습니다.')
    }
  }

  return (
    <div className="flex-1">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            레시피 이름
          </span>
          <input
            className={`${INPUT_CLS} min-w-48`}
            onChange={(event) => setName(event.target.value)}
            type="text"
            value={name}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            종
          </span>
          <select
            className={INPUT_CLS}
            onChange={(event) =>
              setSpecies(
                event.target.value === 'none'
                  ? null
                  : (event.target.value as Species),
              )
            }
            value={species ?? 'none'}
          >
            <option value="cat">고양이</option>
            <option value="dog">강아지</option>
            <option value="none">공용</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            카테고리
          </span>
          <select
            className={INPUT_CLS}
            onChange={(event) =>
              setCategory(event.target.value as RecipeCategory | '')
            }
            value={category}
          >
            {RECIPE_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value="">미분류</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            상태
          </span>
          <select
            className={INPUT_CLS}
            onChange={(event) =>
              setStatus(event.target.value as RecipeDraft['status'])
            }
            value={status}
          >
            <option value="draft">임시</option>
            <option value="inactive">비활성</option>
          </select>
        </label>
        <button
          className={`${SECONDARY_BTN_CLS} disabled:opacity-50`}
          disabled={!name.trim() || save.isPending}
          onClick={() => void handleSave()}
          type="button"
        >
          {save.isPending ? '저장 중...' : '레시피 정보 저장'}
        </button>
      </div>
      <p className="mt-1 text-helper text-gray-500">
        생산 단위: {draft.unitLabel || '—'} · 구성 원료{' '}
        {draft.composition.length}개
      </p>
      {errorMsg && (
        <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMsg}
        </div>
      )}
    </div>
  )
}

function RegisterSection({
  draft,
  ingredients,
  uid,
}: {
  draft: RecipeDraft
  ingredients: Ingredient[]
  uid: string | undefined
}) {
  const register = useRegisterRecipe(uid)
  const [open, setOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const ingredientMap = useMemo(
    () => Object.fromEntries(ingredients.map((item) => [item.id, item])),
    [ingredients],
  )
  const supplementCount = countSupplements(draft, ingredientMap)
  const ingredientCount = draft.composition.length - supplementCount
  const alreadyRegistered = Boolean(draft.registeredRecipeId)

  async function handleRegister() {
    if (!uid) {
      setErrorMsg('로그인이 필요합니다.')
      return
    }
    setErrorMsg('')
    try {
      const payload = draftToRecipe(draft, ingredientMap, uid)
      await register.mutateAsync({ draft, payload, now: Date.now() })
      setOpen(false)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '등록에 실패했습니다.')
    }
  }

  return (
    <div className="text-right">
      <button
        className={PRIMARY_BTN_CLS}
        disabled={alreadyRegistered || register.isPending}
        onClick={() => {
          setErrorMsg('')
          setOpen(true)
        }}
        type="button"
      >
        {alreadyRegistered ? '등록됨' : '이 레시피 등록'}
      </button>
      {alreadyRegistered && (
        <p className="mt-1 max-w-xs text-xs text-amber-600">
          이미 생산앱에 등록됨. 재푸시(수정 반영)는 지원되지 않습니다 (DL-025).
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-lg bg-white text-left shadow-lg">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-800">
                생산앱에 레시피 등록
              </h2>
            </div>
            <div className="space-y-3 p-4 text-sm text-gray-600">
              <p>
                <b>{draft.name}</b> 를 생산앱 <code>recipes</code> 에
                등록합니다.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-gray-500">
                <li>
                  구성 원료 {ingredientCount}개 등록, 영양제 {supplementCount}개
                  제외
                </li>
                <li>
                  target=<b>{speciesToTarget(draft.species)}</b>, category=
                  <b>raw</b>, <b>active=false</b>로 생성됩니다.
                </li>
                <li>
                  카테고리·봉투·생산방식 등은 생산앱에서 보완 후 활성화하세요.
                </li>
                <li>재푸시(수정 반영)는 지원되지 않습니다 (DL-025).</li>
              </ul>
              {errorMsg && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  {errorMsg}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
              <button
                className={SECONDARY_BTN_CLS}
                disabled={register.isPending}
                onClick={() => setOpen(false)}
                type="button"
              >
                취소
              </button>
              <button
                className={PRIMARY_BTN_CLS}
                disabled={register.isPending}
                onClick={() => void handleRegister()}
                type="button"
              >
                {register.isPending ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecipeDetailPage
