import { useState } from 'react'
import { isPreparationIncluded } from '../features/ingredients/ingredientSelectors'
import { INPUT_CLS, PRIMARY_BTN_CLS } from '../lib/ui'
import type { Ingredient } from '../types/recipe'

export type PreparationSettings = {
  includeInPreparation: boolean
  displayName: string
}

export function IngredientPreparationSettings({
  ingredient,
  isPending,
  onSave,
}: {
  ingredient: Ingredient
  isPending: boolean
  onSave: (settings: PreparationSettings) => Promise<unknown>
}) {
  const [included, setIncluded] = useState(isPreparationIncluded(ingredient))
  const [displayName, setDisplayName] = useState(ingredient.displayName)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const dirty =
    included !== isPreparationIncluded(ingredient) ||
    displayName.trim() !== ingredient.displayName

  async function save() {
    setMessage('')
    setError('')
    try {
      await onSave({
        includeInPreparation: included,
        displayName: displayName.trim(),
      })
      setMessage('출력 설정을 저장했습니다.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '출력 설정을 저장하지 못했습니다.',
      )
    }
  }

  return (
    <section
      className="border-b border-gray-100 px-4 py-4"
      aria-label="계량·출력 설정"
    >
      <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
        <input
          type="checkbox"
          checked={included}
          disabled={isPending}
          onChange={(event) => {
            setIncluded(event.target.checked)
            setMessage('')
          }}
        />
        계량·출력에 포함
      </label>
      <p className="mt-2 text-xs text-gray-500">
        이 재료를 쓰는 모든 레시피의 계량 목록과 출력에 적용됩니다.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-xs text-gray-500">
          직원용 치환명
          <input
            className={`${INPUT_CLS} mt-1`}
            value={displayName}
            disabled={isPending}
            placeholder={ingredient.aliases[0] || '직원에게 표시할 이름'}
            onChange={(event) => {
              setDisplayName(event.target.value)
              setMessage('')
            }}
          />
        </label>
        <button
          className={PRIMARY_BTN_CLS}
          type="button"
          disabled={isPending || !dirty}
          onClick={() => void save()}
        >
          {isPending ? '저장 중…' : '출력 설정 저장'}
        </button>
      </div>
      {included &&
        !/난각/.test(ingredient.name) &&
        !(displayName.trim() || ingredient.aliases[0]) && (
          <p className="mt-2 text-xs text-gray-500">
            대표용에는 실제 이름이 표시됩니다. 직원용 출력에는 치환명이
            필요합니다.
          </p>
        )}
      {message && (
        <p className="mt-2 text-xs text-gray-600" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
