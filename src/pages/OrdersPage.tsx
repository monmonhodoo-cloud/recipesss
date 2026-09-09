import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Printer, Save, Search } from 'lucide-react'
import { PreparationProduct } from '../components/PreparationProduct'
import { useIngredients } from '../features/ingredients/ingredientQueries'
import {
  filterOrderGroups,
  groupPresetsByRecipe,
  type OrderFilter,
} from '../features/orders/orderSelectors'
import {
  createOrderSnapshot,
  isSamePreparation,
  orderErrorMessage,
  preparationIssues,
} from '../features/orders/orderSnapshot'
import { useSavedOrders, useSaveOrder } from '../features/orders/orderStorage'
import { backfillPresetInputs } from '../features/presets/presetRatio'
import { usePresets } from '../features/presets/presetQueries'
import { buildPresetPrintViews } from '../features/print/printSelectors'
import { useRecipeDrafts } from '../features/recipes/recipeQueries'
import { useAuthStore } from '../stores/authStore'
import type {
  Ingredient,
  Preset,
  RecipeDraft,
  SavedOrder,
} from '../types/recipe'

const EMPTY_DRAFTS: RecipeDraft[] = []
const EMPTY_PRESETS: Preset[] = []
const EMPTY_INGREDIENTS: Ingredient[] = []
const FILTERS: Array<[OrderFilter, string]> = [
  ['cat', '고양이'],
  ['dog', '강아지'],
  ['freezeDried', '동결건조'],
]

export function OrdersPage() {
  const uid = useAuthStore((state) => state.user?.uid)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const draftsQuery = useRecipeDrafts(uid)
  const presetsQuery = usePresets(uid)
  const ingredientsQuery = useIngredients(uid)
  const ordersQuery = useSavedOrders(uid)
  const saveOrder = useSaveOrder(uid)
  const saving = useRef<Promise<SavedOrder> | null>(null)
  const [filter, setFilter] = useState<OrderFilter>('all')
  const [search, setSearch] = useState('')
  const [onlySelected, setOnlySelected] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  const drafts = draftsQuery.data ?? EMPTY_DRAFTS
  const rawPresets = presetsQuery.data ?? EMPTY_PRESETS
  const ingredients = ingredientsQuery.data ?? EMPTY_INGREDIENTS
  // 이전 프리셋의 빈 입력값은 표시할 때만 보완한다.
  const presets = useMemo(
    () => backfillPresetInputs(rawPresets, drafts),
    [rawPresets, drafts],
  )
  const ids = useMemo(
    () => [
      ...new Set((params.get('presets') ?? '').split(',').filter(Boolean)),
    ],
    [params],
  )
  const selected = useMemo(() => new Set(ids), [ids])
  const groups = useMemo(
    () =>
      groupPresetsByRecipe(
        drafts.filter((draft) => draft.status !== 'inactive'),
        presets,
        true,
      ),
    [drafts, presets],
  )
  const visibleGroups = filterOrderGroups(groups, filter).filter(
    (group) =>
      group.draftName
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()) &&
      (!onlySelected || group.presets.some((item) => selected.has(item.id))),
  )
  const views = useMemo(
    () => buildPresetPrintViews(ids, presets, drafts, ingredients),
    [ids, presets, drafts, ingredients],
  )
  const snapshot = useMemo(() => createOrderSnapshot(views), [views])
  const issues = preparationIssues(ids, views, ingredients)
  const missingAliases = [
    ...new Set(
      views.flatMap((view) =>
        view.supplements
          .filter(
            (row) =>
              !/난각/.test(row.name) &&
              row.displayName.trim() === row.name.trim(),
          )
          .map((row) => row.name),
      ),
    ),
  ]
  const saved = ordersQuery.data?.find(
    (item) => item.id === params.get('saved'),
  )
  const isSaved = isSamePreparation(saved, snapshot, now)
  const loading =
    draftsQuery.isLoading ||
    presetsQuery.isLoading ||
    ingredientsQuery.isLoading
  const queryError =
    draftsQuery.error ?? presetsQuery.error ?? ingredientsQuery.error
  const canSave =
    ids.length > 0 &&
    !loading &&
    !queryError &&
    !issues.length &&
    !saveOrder.isPending

  function select(idsToChange: string[], checked: boolean) {
    const next = new Set(ids)
    idsToChange.forEach((id) => (checked ? next.add(id) : next.delete(id)))
    const nextParams = new URLSearchParams(params)
    if (next.size) nextParams.set('presets', [...next].join(','))
    else nextParams.delete('presets')
    setParams(nextParams, { replace: true })
    setError('')
  }

  async function ensureSaved(): Promise<SavedOrder> {
    if (saved && isSamePreparation(saved, snapshot, Date.now())) return saved
    if (saving.current) return saving.current
    if (!canSave) throw new Error(issues[0] ?? '프리셋을 선택해주세요.')
    const promise = saveOrder.mutateAsync({
      presetIds: ids,
      snapshot,
      now: Date.now(),
    })
    saving.current = promise
    try {
      const order = await promise
      const next = new URLSearchParams(params)
      next.set('saved', order.id)
      setParams(next, { replace: true })
      return order
    } finally {
      saving.current = null
    }
  }

  async function saveAndPrint(format?: 'owner' | 'staff') {
    setError('')
    try {
      const order = await ensureSaved()
      if (format)
        navigate(
          `/print?${new URLSearchParams({ order: order.id, format, from: 'prepare' })}`,
        )
    } catch (err) {
      setError(orderErrorMessage(err))
    }
  }

  return (
    <div className="preparation-page">
      <header className="prep-heading">
        <h1>영양제 준비·출력</h1>
        <p>필요한 프리셋을 체크하고, 한 번에 출력하세요.</p>
      </header>
      <label className="prep-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          aria-label="제품 이름 검색"
          placeholder="어떤 제품을 준비할까요?"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="prep-tools">
        <div className="prep-filters" aria-label="제품 분류">
          {FILTERS.map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              onClick={() =>
                setFilter((current) => (current === value ? 'all' : value))
              }
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="prep-textbutton"
          aria-pressed={onlySelected}
          onClick={() => setOnlySelected(!onlySelected)}
        >
          {onlySelected ? '모든 프리셋 보기' : '선택한 프리셋만 보기'}
        </button>
      </div>
      <div className="prep-outputbar">
        <div>
          <p className="prep-count" aria-live="polite">
            프리셋 <strong>{ids.length}개</strong> 선택{' '}
            <span>
              · 제품 {new Set(views.map((view) => view.draft.id)).size}개
            </span>
          </p>
          <button
            type="button"
            className="prep-textbutton"
            disabled={!ids.length || saveOrder.isPending}
            onClick={() => select(ids, false)}
          >
            선택 모두 해제
          </button>
        </div>
        <div className="prep-outputactions">
          <button
            type="button"
            className="prep-button"
            disabled={!canSave}
            onClick={() => void saveAndPrint('owner')}
          >
            <Printer size={16} />
            대표용 A4 출력
          </button>
          <button
            type="button"
            className="prep-button prep-primary"
            disabled={!canSave || missingAliases.length > 0}
            onClick={() => void saveAndPrint('staff')}
          >
            <Printer size={16} />
            직원용 A4 출력
          </button>
        </div>
      </div>
      <div className="prep-savebar">
        <div className="prep-savegroup">
          <button
            type="button"
            className="prep-button"
            disabled={!canSave || isSaved}
            onClick={() => void saveAndPrint()}
          >
            <Save size={15} />
            {saveOrder.isPending
              ? '저장 중…'
              : isSaved
                ? '저장됨'
                : '준비 목록 저장'}
          </button>
          <span className="prep-meta" role="status">
            {isSaved && saved
              ? `${saved.date} ${new Date(saved.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} · 저장됨`
              : params.has('saved') && ids.length
                ? '선택이 변경됐습니다. 저장하면 새 내역이 만들어집니다.'
                : '출력하면 준비 내역에도 자동 저장됩니다.'}
          </span>
        </div>
        <Link className="prep-textbutton" to="/history">
          날짜별 준비 내역 →
        </Link>
      </div>
      {error && (
        <div className="prep-notice prep-error" role="alert">
          {error}
        </div>
      )}
      {!loading && !queryError && issues.length > 0 && (
        <div className="prep-notice prep-error" role="alert">
          {issues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
          <Link to="/recipes">레시피 관리 →</Link>
        </div>
      )}
      {missingAliases.length > 0 && (
        <div className="prep-notice">
          직원용 치환명이 없는 영양제: {missingAliases.join(', ')}.{' '}
          <Link to="/ingredients">치환명 설정 후 직원용 출력 →</Link>
        </div>
      )}
      {loading ? (
        <div className="prep-empty">불러오는 중...</div>
      ) : queryError ? (
        <div className="prep-notice prep-error" role="alert">
          {orderErrorMessage(queryError)}
          <button
            className="prep-textbutton"
            type="button"
            onClick={() => {
              void draftsQuery.refetch()
              void presetsQuery.refetch()
              void ingredientsQuery.refetch()
            }}
          >
            다시 불러오기
          </button>
        </div>
      ) : (
        <section className="prep-list" aria-label="제품별 프리셋 목록">
          <div className="prep-listheader">
            <span>
              제품 {visibleGroups.length}개 · 프리셋을 여러 개 선택할 수 있어요
            </span>
            <button
              className="prep-textbutton"
              type="button"
              disabled={saveOrder.isPending}
              onClick={() =>
                select(
                  visibleGroups
                    .filter(
                      (group) =>
                        !drafts.find((draft) => draft.id === group.draftId)
                          ?.mergeReviewPending,
                    )
                    .flatMap((group) => group.presets.map((item) => item.id)),
                  true,
                )
              }
            >
              현재 목록 전체 선택
            </button>
          </div>
          {visibleGroups.length ? (
            visibleGroups.map((group) => (
              <PreparationProduct
                key={group.draftId}
                group={group}
                draft={drafts.find((draft) => draft.id === group.draftId)!}
                drafts={drafts}
                presets={presets}
                ingredients={ingredients}
                selected={selected}
                onSelect={select}
                uid={uid}
                busy={saveOrder.isPending}
              />
            ))
          ) : (
            <div className="prep-empty">
              조건에 맞는 제품이 없습니다.
              {!groups.length && <Link to="/recipes/new"> 레시피 추가 →</Link>}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
