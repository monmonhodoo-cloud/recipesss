import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { DeleteRecipeDialog } from '../components/DeleteRecipeDialog'
import {
  filterDrafts,
  RECIPE_CATEGORIES,
  type DraftCategoryFilter,
  type DraftFilter,
  type DraftSpeciesFilter,
} from '../features/recipes/filterDrafts'
import { useClearMergeReview } from '../features/recipes/recipeMutations'
import { useRecipeDrafts } from '../features/recipes/recipeQueries'
import { CARD_CLS, EMPTY_STATE_CLS, INPUT_CLS } from '../lib/ui'
import { useAuthStore } from '../stores/authStore'
import type { RecipeCategory, RecipeDraft } from '../types/recipe'

const DEFAULT_FILTER: DraftFilter = {
  species: 'all',
  category: 'all',
  search: '',
}

function parseCategory(value: string): DraftCategoryFilter {
  return (RECIPE_CATEGORIES as string[]).includes(value)
    ? (value as RecipeCategory)
    : 'all'
}

const EMPTY_DRAFTS: NonNullable<ReturnType<typeof useRecipeDrafts>['data']> = []

function speciesLabel(species: DraftSpeciesFilter): string {
  if (species === 'cat') return '고양이'
  if (species === 'dog') return '강아지'
  if (species === null) return '공용'
  return '전체'
}

function speciesValue(species: DraftSpeciesFilter): string {
  return species === null ? 'none' : species
}

function parseSpecies(value: string): DraftSpeciesFilter {
  if (value === 'cat' || value === 'dog' || value === 'all') return value
  return null
}

export function RecipesPage() {
  const navigate = useNavigate()
  const uid = useAuthStore((state) => state.user?.uid)
  const { data, error, isError, isLoading } = useRecipeDrafts(uid)
  const clearMergeReview = useClearMergeReview(uid)
  const [filter, setFilter] = useState<DraftFilter>(DEFAULT_FILTER)
  const [deleteTarget, setDeleteTarget] = useState<RecipeDraft | null>(null)

  const drafts = data ?? EMPTY_DRAFTS
  const filtered = useMemo(() => filterDrafts(drafts, filter), [drafts, filter])

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-title font-bold text-gray-800">레시피 관리</h1>
          <p className="mt-1 text-helper text-gray-500">
            제품별 원료 구성과 프리셋 기준을 관리하세요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link className="prep-textbutton" to="/recipe-check">
            레시피 비교·확인
          </Link>
          <Link className="prep-button prep-primary" to="/recipes/new">
            ＋ 레시피 추가
          </Link>
        </div>
      </div>

      <div className={`mt-4 ${CARD_CLS} p-4`}>
        <div className="grid gap-3 md:grid-cols-[150px_150px_1fr]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">
              종
            </span>
            <select
              className={INPUT_CLS}
              onChange={(event) =>
                setFilter((prev) => ({
                  ...prev,
                  species: parseSpecies(event.target.value),
                }))
              }
              value={speciesValue(filter.species)}
            >
              <option value="all">전체</option>
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
                setFilter((prev) => ({
                  ...prev,
                  category: parseCategory(event.target.value),
                }))
              }
              value={filter.category}
            >
              <option value="all">전체</option>
              {RECIPE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">
              검색
            </span>
            <input
              className={INPUT_CLS}
              onChange={(event) =>
                setFilter((prev) => ({ ...prev, search: event.target.value }))
              }
              placeholder="레시피 이름"
              type="search"
              value={filter.search}
            />
          </label>
        </div>
      </div>

      {isLoading && (
        <div className={`mt-4 ${EMPTY_STATE_CLS}`}>불러오는 중...</div>
      )}

      {isError && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {error instanceof Error
            ? error.message
            : '레시피 목록을 불러오지 못했습니다.'}
        </div>
      )}

      {!isLoading && !isError && drafts.length === 0 && (
        <div className={`mt-4 ${EMPTY_STATE_CLS}`}>
          레시피가 없습니다. 레시피 추가로 첫 제품을 등록하세요.
        </div>
      )}

      {!isLoading && !isError && drafts.length > 0 && filtered.length === 0 && (
        <div className={`mt-4 ${EMPTY_STATE_CLS}`}>
          조건에 맞는 레시피가 없습니다.
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className={`mt-4 ${CARD_CLS}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <th className="px-3 py-1.5">이름</th>
                  <th className="px-3 py-1.5">종</th>
                  <th className="px-3 py-1.5">카테고리</th>
                  <th className="px-3 py-1.5 text-right">구성 원료</th>
                  <th className="px-3 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((draft) => (
                  <tr
                    className="cursor-pointer border-b border-gray-100 text-gray-700 hover:bg-gray-50"
                    key={draft.id}
                    onClick={() => navigate(`/recipes/${draft.id}`)}
                  >
                    <td className="px-3 py-1.5 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        <span>{draft.name}</span>
                        {draft.mergeReviewPending && (
                          <button
                            className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                            disabled={clearMergeReview.isPending}
                            onClick={(event) => {
                              event.stopPropagation()
                              void clearMergeReview.mutateAsync(draft.id)
                            }}
                            title="원료 병합으로 중량이 합산된 레시피입니다. 확인 후 사용하세요."
                            type="button"
                          >
                            합산 확인
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      {speciesLabel(draft.species)}
                    </td>
                    <td className="px-3 py-1.5 text-gray-600">
                      {draft.category ?? '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {draft.composition.length}
                    </td>
                    <td className="px-3 py-1.5">
                      <button
                        className="rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-50 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(draft)
                        }}
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
        </div>
      )}

      {deleteTarget && (
        <DeleteRecipeDialog
          draft={deleteTarget}
          uid={uid}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

export default RecipesPage
