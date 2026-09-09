import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useIngredients } from '../features/ingredients/ingredientQueries'
import { useSavedOrders } from '../features/orders/orderStorage'
import {
  localDateKey,
  orderErrorMessage,
  preparationIssues,
} from '../features/orders/orderSnapshot'
import { usePresets } from '../features/presets/presetQueries'
import { OrderPdf1, OrderPdf2 } from '../features/print/OrderPdf'
import {
  buildOutputOne,
  buildOutputTwo,
  buildPresetPrintViews,
} from '../features/print/printSelectors'
import { useRecipeDrafts } from '../features/recipes/recipeQueries'
import { useAuthStore } from '../stores/authStore'

export function PrintPage() {
  const uid = useAuthStore((state) => state.user?.uid)
  const [params, setParams] = useSearchParams()
  const ordersQuery = useSavedOrders(uid)
  const orderId = params.get('order') ?? ''
  const order = ordersQuery.data?.find((item) => item.id === orderId)
  const snapshot = order?.snapshot
  // 과거 내역은 현재 원본의 조회·재계산에 의존하지 않는다.
  const needsCurrentData =
    !orderId || (ordersQuery.isSuccess && !!order && !snapshot)
  const draftsQuery = useRecipeDrafts(needsCurrentData ? uid : undefined)
  const presetsQuery = usePresets(needsCurrentData ? uid : undefined)
  const ingredientsQuery = useIngredients(needsCurrentData ? uid : undefined)
  const [acceptedLegacyId, setAcceptedLegacyId] = useState('')
  const [openedAt] = useState(Date.now)
  const format = params.get('format') === 'staff' ? 'staff' : 'owner'
  const selectedIds = useMemo(
    () =>
      order?.presetIds ??
      (params.get('presets') ?? '').split(',').filter(Boolean),
    [order, params],
  )
  const views = useMemo(
    () =>
      needsCurrentData
        ? buildPresetPrintViews(
            selectedIds,
            presetsQuery.data ?? [],
            draftsQuery.data ?? [],
            ingredientsQuery.data ?? [],
          )
        : [],
    [
      needsCurrentData,
      selectedIds,
      presetsQuery.data,
      draftsQuery.data,
      ingredientsQuery.data,
    ],
  )
  const outputOne = useMemo(
    () => snapshot?.outputOne ?? buildOutputOne(views),
    [snapshot, views],
  )
  const outputTwo = useMemo(
    () => snapshot?.outputTwo ?? buildOutputTwo(views),
    [snapshot, views],
  )
  const isLoading =
    (Boolean(orderId) && ordersQuery.isLoading) ||
    (needsCurrentData &&
      (draftsQuery.isLoading ||
        presetsQuery.isLoading ||
        ingredientsQuery.isLoading))
  const error =
    orderId && ordersQuery.error
      ? ordersQuery.error
      : needsCurrentData
        ? (draftsQuery.error ?? presetsQuery.error ?? ingredientsQuery.error)
        : null
  const legacy = Boolean(order && !snapshot)
  const issues =
    !snapshot && needsCurrentData
      ? preparationIssues(selectedIds, views, ingredientsQuery.data ?? [])
      : []
  const supplements = snapshot
    ? snapshot.items.flatMap((item) => item.supplements)
    : views.flatMap((item) => item.supplements)
  const missingAlias = supplements.some(
    (row) =>
      !/난각/.test(row.name) && row.name.trim() === row.displayName.trim(),
  )
  const ready =
    !isLoading &&
    !error &&
    selectedIds.length > 0 &&
    (!orderId || !!order) &&
    !issues.length &&
    (!legacy || acceptedLegacyId === orderId) &&
    (format !== 'staff' || !missingAlias)
  const doc =
    format === 'owner' ? (
      <OrderPdf1 groups={outputOne} />
    ) : (
      <OrderPdf2 output={outputTwo} />
    )
  const fileDate = order?.date ?? localDateKey(openedAt)
  const fileName = `${fileDate} 영양제_${format === 'owner' ? '대표' : '직원'}.pdf`
  const fromPrepare = params.get('from') === 'prepare'
  const returnTo = fromPrepare
    ? `/orders?${new URLSearchParams({ presets: selectedIds.join(','), ...(orderId ? { saved: orderId } : {}) })}`
    : '/history'

  return (
    <div className="preparation-page">
      <header className="prep-heading">
        <h1>{format === 'owner' ? '대표용' : '직원용'} A4 미리보기</h1>
        <p>
          {fileDate} · 프리셋 {selectedIds.length}개 ·{' '}
          {snapshot ? '저장 당시 이름·코드·중량' : '현재 레시피 기준'}
        </p>
      </header>
      <div className="prep-tools">
        <Link className="prep-textbutton" to={orderId ? returnTo : '/orders'}>
          ← {fromPrepare || !orderId ? '프리셋 선택으로' : '준비 내역으로'}
        </Link>
        <div className="prep-recordactions">
          <button
            type="button"
            className="prep-button"
            onClick={() => {
              const next = new URLSearchParams(params)
              next.set('format', format === 'owner' ? 'staff' : 'owner')
              setParams(next, { replace: true })
            }}
          >
            {format === 'owner' ? '직원용으로 보기' : '대표용으로 보기'}
          </button>
          {ready && (
            <PDFDownloadLink
              className="prep-button prep-primary"
              document={doc}
              fileName={fileName}
            >
              {({ loading }) => (loading ? 'PDF 생성 중…' : 'PDF 다운로드')}
            </PDFDownloadLink>
          )}
        </div>
      </div>
      {isLoading && <div className="prep-empty">불러오는 중...</div>}
      {error && (
        <div className="prep-notice prep-error" role="alert">
          {orderErrorMessage(error)}
        </div>
      )}
      {!isLoading && orderId && !error && !order && (
        <div className="prep-empty">저장된 준비 내역을 찾을 수 없습니다.</div>
      )}
      {!orderId && !selectedIds.length && (
        <div className="prep-empty">
          <Link to="/orders">프리셋을 선택하거나</Link>{' '}
          <Link to="/history">준비 내역에서 재출력해주세요.</Link>
        </div>
      )}
      {legacy && (
        <div className="prep-notice">
          이 내역에는 당시 중량이 저장되어 있지 않습니다. 프리셋이 바뀌었다면
          과거 출력물과 다를 수 있습니다.
          {acceptedLegacyId !== orderId && (
            <button
              className="prep-button"
              type="button"
              onClick={() => setAcceptedLegacyId(orderId)}
            >
              현재 데이터로 미리보기
            </button>
          )}
        </div>
      )}
      {!isLoading && !error && issues.length > 0 && (
        <div className="prep-notice prep-error" role="alert">
          {issues.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      )}
      {format === 'staff' && missingAlias && (
        <div className="prep-notice prep-error">
          치환명이 없는 영양제가 포함되어 직원용 출력이 중단되었습니다.{' '}
          <Link to="/ingredients">원료·영양제 관리</Link>에서 수정한 후 새 준비
          목록으로 저장해주세요.
        </div>
      )}
      {ready && (
        <div className="prep-pdfviewer">
          <PDFViewer
            key={`${orderId}-${format}`}
            showToolbar
            style={{ border: 0, height: '100%', width: '100%' }}
          >
            {doc}
          </PDFViewer>
        </div>
      )}
    </div>
  )
}

export default PrintPage
