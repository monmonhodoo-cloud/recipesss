import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useIngredients } from '../features/ingredients/ingredientQueries'
import { useDeleteOrder, useSavedOrders } from '../features/orders/orderStorage'
import { usePresets } from '../features/presets/presetQueries'
import { OrderPdf1, OrderPdf2 } from '../features/print/OrderPdf'
import {
  buildOutputOne,
  buildOutputTwo,
  buildPresetPrintViews,
} from '../features/print/printSelectors'
import { useRecipeDrafts } from '../features/recipes/recipeQueries'
import { EMPTY_STATE_CLS, INPUT_CLS, PRIMARY_BTN_CLS, SECONDARY_BTN_CLS } from '../lib/ui'
import { useAuthStore } from '../stores/authStore'

type PrintTab = 'view1' | 'view2'

export function PrintPage() {
  const uid = useAuthStore((state) => state.user?.uid)
  const [searchParams, setSearchParams] = useSearchParams()
  const draftsQuery = useRecipeDrafts(uid)
  const presetsQuery = usePresets(uid)
  const ingredientsQuery = useIngredients(uid)
  const savedOrdersQuery = useSavedOrders(uid)
  const deleteOrder = useDeleteOrder(uid)
  const [tab, setTab] = useState<PrintTab>('view1')

  const selectedIds = useMemo(
    () => (searchParams.get('presets') ?? '').split(',').filter(Boolean),
    [searchParams],
  )
  const selectedOrderId = searchParams.get('order') ?? ''
  const savedOrders = savedOrdersQuery.data ?? [] // 최신순 (createdAt desc)

  function handlePickOrder(orderId: string) {
    if (!orderId) return
    const order = savedOrders.find((item) => item.id === orderId)
    if (!order) return
    setSearchParams({ presets: order.presetIds.join(','), order: order.id })
  }

  async function handleDeleteOrder() {
    if (!selectedOrderId) return
    await deleteOrder.mutateAsync(selectedOrderId)
    setSearchParams({})
  }

  const isLoading =
    draftsQuery.isLoading || presetsQuery.isLoading || ingredientsQuery.isLoading

  const views = useMemo(
    () =>
      buildPresetPrintViews(
        selectedIds,
        presetsQuery.data ?? [],
        draftsQuery.data ?? [],
        ingredientsQuery.data ?? [],
      ),
    [selectedIds, presetsQuery.data, draftsQuery.data, ingredientsQuery.data],
  )
  const outputOne = useMemo(() => buildOutputOne(views), [views])
  const outputTwo = useMemo(() => buildOutputTwo(views), [views])

  const doc =
    tab === 'view1' ? (
      <OrderPdf1 groups={outputOne} />
    ) : (
      <OrderPdf2 output={outputTwo} />
    )
  // 파일명: 저장된 발주 선택 시 그 날짜, 아니면 오늘 (로컬).
  const orderDate = savedOrders.find((o) => o.id === selectedOrderId)?.date
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const fileDate = orderDate ?? today
  const fileName =
    tab === 'view1'
      ? `${fileDate} 영양제_대표.pdf`
      : `${fileDate} 영양제_직원.pdf`

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title font-bold text-gray-800">PDF 출력</h1>
          <p className="mt-1 text-helper text-gray-500">
            발주에서 선택한 프리셋 {selectedIds.length}개 · 출력 1(난각분) ·
            출력 2(영양제 치환명)
          </p>
        </div>
        <Link className="text-sm text-gray-500 hover:text-gray-800" to="/orders">
          ← 발주로 돌아가기
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            저장된 발주 (최신순)
          </span>
          <select
            className={`${INPUT_CLS} min-w-64`}
            onChange={(event) => handlePickOrder(event.target.value)}
            value={selectedOrderId}
          >
            <option value="">
              {savedOrders.length === 0
                ? '저장된 발주 없음'
                : '저장된 발주 선택...'}
            </option>
            {savedOrders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.date} · 프리셋 {order.presetIds.length}개
              </option>
            ))}
          </select>
        </label>
        {selectedOrderId && (
          <button
            className={SECONDARY_BTN_CLS}
            disabled={deleteOrder.isPending}
            onClick={() => void handleDeleteOrder()}
            type="button"
          >
            이 발주 삭제
          </button>
        )}
        {savedOrdersQuery.isError && (
          <p className="text-xs text-red-600">
            저장된 발주 조회 실패:{' '}
            {savedOrdersQuery.error instanceof Error
              ? savedOrdersQuery.error.message
              : '알 수 없는 오류'}{' '}
            — 권한 오류면 recipesssOrders 규칙이 라이브에 없는 것(재고관리 정본에
            반영·배포 필요, DL-040).
          </p>
        )}
      </div>

      {selectedIds.length === 0 && (
        <div className={`mt-4 ${EMPTY_STATE_CLS}`}>
          발주 탭에서 프리셋을 선택하거나 위에서 저장된 발주를 선택하세요.
        </div>
      )}

      {selectedIds.length > 0 && isLoading && (
        <div className={`mt-4 ${EMPTY_STATE_CLS}`}>불러오는 중...</div>
      )}

      {selectedIds.length > 0 && !isLoading && views.length === 0 && (
        <div className={`mt-4 ${EMPTY_STATE_CLS}`}>
          선택한 프리셋을 찾을 수 없습니다.
        </div>
      )}

      {selectedIds.length > 0 && !isLoading && views.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-gray-300 text-sm">
              {(
                [
                  ['view1', '출력 1'],
                  ['view2', '출력 2'],
                ] as Array<[PrintTab, string]>
              ).map(([value, label]) => (
                <button
                  className={
                    tab === value
                      ? 'bg-gray-800 px-4 py-2 text-white'
                      : 'bg-white px-4 py-2 text-gray-600 hover:bg-gray-50'
                  }
                  key={value}
                  onClick={() => setTab(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            <PDFDownloadLink
              className={PRIMARY_BTN_CLS}
              document={doc}
              fileName={fileName}
            >
              {({ loading }) => (loading ? '생성 중...' : 'PDF 다운로드')}
            </PDFDownloadLink>
          </div>

          <div className="mt-4 h-[75vh] overflow-hidden rounded-lg shadow-sm">
            <PDFViewer
              key={tab}
              showToolbar
              style={{ border: 0, height: '100%', width: '100%' }}
            >
              {doc}
            </PDFViewer>
          </div>
        </>
      )}
    </div>
  )
}

export default PrintPage
