import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { RECIPE_CATEGORIES } from '../features/recipes/filterDrafts'
import { useCreateRecipeDraft } from '../features/recipes/recipeMutations'
import { CARD_CLS, INPUT_CLS, PRIMARY_BTN_CLS } from '../lib/ui'
import { useAuthStore } from '../stores/authStore'
import type { RecipeCategory, Species } from '../types/recipe'

export function RecipeNewPage() {
  const uid = useAuthStore((state) => state.user?.uid)
  const navigate = useNavigate()
  const create = useCreateRecipeDraft(uid)
  const [name, setName] = useState('')
  const [species, setSpecies] = useState<Species>('cat')
  const [category, setCategory] = useState<RecipeCategory | ''>('생식')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleCreate() {
    if (!name.trim()) {
      setErrorMsg('레시피 이름을 입력하세요.')
      return
    }
    setErrorMsg('')
    try {
      const id = await create.mutateAsync({
        name: name.trim(),
        species,
        category: category === '' ? undefined : category,
        now: Date.now(),
      })
      navigate(`/recipes/${id}`)
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '레시피 생성에 실패했습니다.',
      )
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link className="text-sm text-gray-500 hover:text-gray-800" to="/recipes">
          ← 레시피 목록
        </Link>
      </div>

      <h1 className="mt-4 text-title font-bold text-gray-800">신규 레시피</h1>
      <p className="mt-1 text-helper text-gray-500">
        이름과 종만 정해 빈 레시피를 만든 뒤, 상세 화면에서 구성 원료를
        추가합니다.
      </p>

      <div className={`mt-4 max-w-md ${CARD_CLS} p-4`}>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            레시피 이름
          </span>
          <input
            className={INPUT_CLS}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: 치킨 본식"
            type="text"
            value={name}
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-gray-500">종</span>
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

        <label className="mt-3 block">
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

        {errorMsg && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        <button
          className={`${PRIMARY_BTN_CLS} mt-4`}
          disabled={create.isPending || !name.trim()}
          onClick={() => void handleCreate()}
          type="button"
        >
          {create.isPending ? '생성 중...' : '레시피 만들기'}
        </button>
      </div>
    </div>
  )
}

export default RecipeNewPage
