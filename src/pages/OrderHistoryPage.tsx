import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDeleteOrder, useSavedOrders } from '../features/orders/orderStorage'
import { orderErrorMessage } from '../features/orders/orderSnapshot'
import { formatWeight } from '../features/print/printSelectors'
import { useAuthStore } from '../stores/authStore'
import type { SavedOrder } from '../types/recipe'

export function OrderHistoryPage() {
  const uid = useAuthStore((state) => state.user?.uid)
  const query = useSavedOrders(uid)
  const deletion = useDeleteOrder(uid)
  const [date, setDate] = useState('')
  const [deleteId, setDeleteId] = useState('')
  const [error, setError] = useState('')
  const records = query.data ?? []
  const visible = records.filter((item) => !date || item.date === date)
  const dates = [...new Set(visible.map((item) => item.date))]
  async function remove(id: string) {
    setError('')
    try {
      await deletion.mutateAsync(id)
      setDeleteId('')
    } catch (err) {
      setError(orderErrorMessage(err))
    }
  }
  return (
    <div className="preparation-page">
      <header className="prep-heading">
        <h1>준비 내역</h1>
        <p>날짜별 목록을 찾고, 저장 당시 중량으로 다시 출력하세요.</p>
      </header>
      <div className="prep-historytools">
        <span>저장한 준비 목록 {records.length}건</span>
        <div className="prep-formrow">
          <label htmlFor="history-date">날짜 찾기</label>
          <input
            id="history-date"
            type="date"
            aria-label="준비 내역 날짜"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <button
            type="button"
            className="prep-textbutton"
            onClick={() => setDate('')}
          >
            전체 날짜 보기
          </button>
        </div>
      </div>
      {query.isLoading && <div className="prep-empty">불러오는 중...</div>}
      {query.isError && (
        <div className="prep-notice prep-error" role="alert">
          {orderErrorMessage(query.error)}{' '}
          <button
            type="button"
            className="prep-textbutton"
            onClick={() => void query.refetch()}
          >
            다시 불러오기
          </button>
        </div>
      )}
      {error && (
        <p className="prep-error" role="alert">
          {error}
        </p>
      )}
      {!query.isLoading && !query.isError && !visible.length && (
        <div className="prep-empty">
          {date
            ? '이 날짜에 저장한 준비 목록이 없습니다.'
            : '아직 저장한 준비 목록이 없습니다.'}
          <br />
          <Link to="/orders">영양제 준비·출력으로 →</Link>
        </div>
      )}
      {dates.map((day) => (
        <section key={day} aria-label={day}>
          <h2 className="prep-historyday">{day}</h2>
          {visible
            .filter((item) => item.date === day)
            .map((order) => (
              <HistoryRecord
                key={order.id}
                order={order}
                confirming={deleteId === order.id}
                deleting={deletion.isPending}
                onAskDelete={() => setDeleteId(order.id)}
                onCancelDelete={() => setDeleteId('')}
                onDelete={() => void remove(order.id)}
              />
            ))}
        </section>
      ))}
    </div>
  )
}

function HistoryRecord({
  order,
  confirming,
  deleting,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  order: SavedOrder
  confirming: boolean
  deleting: boolean
  onAskDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}) {
  const items = order.snapshot?.items ?? []
  const products = new Map<string, number>()
  items.forEach((item) =>
    products.set(item.productLabel, (products.get(item.productLabel) ?? 0) + 1),
  )
  const legacy = !order.snapshot
  return (
    <article className="prep-historyrecord">
      <div className="prep-recordtop">
        <div>
          <h3>
            {new Date(order.createdAt).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}{' '}
            준비 목록
          </h3>
          <p className="prep-meta">
            프리셋 {order.presetIds.length}개
            {!legacy && ` · 제품 ${products.size}개`}
          </p>
        </div>
        <div className="prep-recordactions">
          <Link
            className="prep-button"
            to={`/print?${new URLSearchParams({ order: order.id, format: 'owner' })}`}
          >
            대표용 재출력
          </Link>
          <Link
            className="prep-button prep-primary"
            to={`/print?${new URLSearchParams({ order: order.id, format: 'staff' })}`}
          >
            직원용 재출력
          </Link>
        </div>
      </div>
      {legacy ? (
        <p className="prep-recordsummary">
          이전 방식으로 저장한 내역입니다. 당시 중량이 없어 현재 데이터로만
          미리볼 수 있습니다.
        </p>
      ) : (
        <p className="prep-recordsummary">
          {[...products]
            .map(([name, count]) => `${name} ${count}개`)
            .join(' · ')}
        </p>
      )}
      {!legacy && (
        <details className="prep-recorddetail">
          <summary>저장된 프리셋·영양제 보기</summary>
          {items.map((item) => (
            <div className="prep-recordline" key={item.presetId}>
              <span>
                {item.productLabel} · {item.inputAmount} {item.inputUnitLabel} ·{' '}
                {item.code}
              </span>
              <span className="prep-meta">
                {item.supplements
                  .map(
                    (row) =>
                      `${row.name} (${row.displayName}) ${formatWeight(row.scaledWeight)}`,
                  )
                  .join(' / ')}
              </span>
            </div>
          ))}
        </details>
      )}
      <div className="prep-recordfooter">
        {confirming ? (
          <>
            <span>이 준비 내역을 삭제할까요?</span>
            <button
              type="button"
              className="prep-textbutton prep-error"
              disabled={deleting}
              onClick={onDelete}
            >
              {deleting ? '삭제 중…' : '내역 삭제'}
            </button>
            <button
              type="button"
              className="prep-textbutton"
              disabled={deleting}
              onClick={onCancelDelete}
            >
              취소
            </button>
          </>
        ) : (
          <button
            type="button"
            className="prep-textbutton"
            onClick={onAskDelete}
          >
            내역 삭제
          </button>
        )}
      </div>
    </article>
  )
}
