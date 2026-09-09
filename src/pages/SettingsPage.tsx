import { useState, type ChangeEvent } from 'react'

import {
  buildMigrationPlan,
  summarizePlan,
  type FirestoreWrite,
  type MigrationPlanSummary,
} from '../features/migration/buildMigrationPlan'
import { migrateV2toV3 } from '../features/migration/migrateV2toV3'
import {
  countExistingDocs,
  runMigrationWrites,
  type ExistingCounts,
} from '../features/migration/runMigration'
import type { V2State } from '../features/migration/v2State'
import { CARD_CLS, PRIMARY_BTN_CLS, SECONDARY_BTN_CLS } from '../lib/ui'
import { useAuthStore } from '../stores/authStore'
import backupData from '../../backups/2026-06-03-pre-rewrite.json'

// SPEC §5.9 + §11.2 (DL-031): 앱 내 1회성 마이그레이션.
// backups/*.json 업로드 → migrateV2toV3 → buildMigrationPlan → dry-run 미리보기
// → 호두님 확인 → fant-e5ae5 batch write. prices 는 제외 (DL-024 미정).

type Step = 'idle' | 'preview' | 'writing' | 'done' | 'error'

export function SettingsPage() {
  const uid = useAuthStore((state) => state.user?.uid)
  const [step, setStep] = useState<Step>('idle')
  const [fileName, setFileName] = useState('')
  const [summary, setSummary] = useState<MigrationPlanSummary | null>(null)
  const [existing, setExisting] = useState<ExistingCounts | null>(null)
  const [plan, setPlan] = useState<FirestoreWrite[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [written, setWritten] = useState(0)

  function reset() {
    setStep('idle')
    setFileName('')
    setSummary(null)
    setExisting(null)
    setPlan([])
    setErrorMsg('')
    setWritten(0)
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // 같은 파일 다시 선택 가능하게
    if (!file || !uid) return
    setErrorMsg('')
    try {
      const text = await file.text()
      const state = JSON.parse(text) as V2State
      const result = migrateV2toV3(state, { ownerUid: uid, now: Date.now() })
      const writes = buildMigrationPlan(result, uid)
      const counts = await countExistingDocs(uid)
      setFileName(file.name)
      setPlan(writes)
      setSummary(summarizePlan(writes))
      setExisting(counts)
      setStep('preview')
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '백업 파일을 읽지 못했습니다.',
      )
      setStep('error')
    }
  }

  async function handleWrite() {
    if (!plan.length) return
    setStep('writing')
    setErrorMsg('')
    try {
      const count = await runMigrationWrites(plan)
      setWritten(count)
      setStep('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Firestore 쓰기 실패.')
      setStep('error')
    }
  }

  const hasExisting =
    existing != null &&
    existing.recipeDrafts + existing.ingredients + existing.presets > 0

  return (
    <div>
      <h1 className="text-title font-bold text-gray-800">백업·복원</h1>

      <div className={`mt-4 ${CARD_CLS} p-6`}>
        <h2 className="text-base font-semibold text-gray-800">
          v2 백업 → fant-e5ae5 마이그레이션
        </h2>
        <p className="mt-1 text-helper text-gray-500">
          구 앱 &quot;백업 다운로드&quot; JSON을 올리면 v3로 변환해 미리
          보여주고, 확인 후 Firestore에 씁니다. 단가(prices)는 제외됩니다
          (DL-024).
        </p>

        {!uid && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-helper text-red-700">
            로그인 정보가 없습니다. 다시 로그인해 주세요.
          </div>
        )}

        {(step === 'idle' || step === 'error') && (
          <label className="mt-4 inline-block">
            <span className={PRIMARY_BTN_CLS}>백업 JSON 선택</span>
            <input
              accept="application/json,.json"
              className="hidden"
              disabled={!uid}
              onChange={(e) => void handleFile(e)}
              type="file"
            />
          </label>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-helper text-red-700">
            {errorMsg}
          </div>
        )}

        {step === 'preview' && summary && existing && (
          <div className="mt-4 space-y-4">
            <div className="text-helper text-gray-600">
              파일: <span className="font-medium">{fileName}</span>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-1.5 font-medium">컬렉션</th>
                  <th className="py-1.5 text-right font-medium">
                    변환(쓸 개수)
                  </th>
                  <th className="py-1.5 text-right font-medium">기존 문서</th>
                </tr>
              </thead>
              <tbody>
                <PreviewRow
                  label="레시피 드래프트"
                  toWrite={summary.recipeDrafts}
                  existing={existing.recipeDrafts}
                />
                <PreviewRow
                  label="원료 (영양제 포함)"
                  toWrite={summary.ingredients}
                  existing={existing.ingredients}
                />
                <PreviewRow
                  label="프리셋"
                  toWrite={summary.presets}
                  existing={existing.presets}
                />
              </tbody>
            </table>

            {hasExisting && (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-helper text-amber-800">
                ⚠️ 대상 컬렉션에 기존 문서가 있습니다. 같은 ID는 <b>덮어쓰기</b>
                됩니다 (신규 앱에서 수정한 내용이 있으면 사라질 수 있음). 첫
                마이그레이션이면 무시해도 됩니다.
              </div>
            )}

            <div className="flex gap-2">
              <button
                className={PRIMARY_BTN_CLS}
                onClick={() => void handleWrite()}
              >
                Firestore에 쓰기 ({summary.total}건)
              </button>
              <button className={SECONDARY_BTN_CLS} onClick={reset}>
                취소
              </button>
            </div>
          </div>
        )}

        {step === 'writing' && (
          <div className="mt-4 text-helper text-gray-600">쓰는 중...</div>
        )}

        {step === 'done' && (
          <div className="mt-4 space-y-3">
            <div className="rounded-md bg-green-50 px-3 py-2 text-helper text-green-700">
              완료 — {written}건 기록했습니다.
            </div>
            <button className={SECONDARY_BTN_CLS} onClick={reset}>
              다른 파일 올리기
            </button>
          </div>
        )}
      </div>

      <ImportSharedRecipes uid={uid} />
    </div>
  )
}

function ImportSharedRecipes({ uid }: { uid: string | undefined }) {
  const [status, setStatus] = useState<'idle' | 'writing' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function handleImport() {
    if (!uid) return
    setStatus('writing')
    setMsg('')
    try {
      const v2 = backupData as unknown as V2State
      const result = migrateV2toV3(v2, { ownerUid: uid, now: Date.now() })
      const allWrites = buildMigrationPlan(result, uid)
      // null-species draft id 목록
      const nullDraftIds = new Set(
        Object.values(v2.products)
          .filter((p) => p.species === null)
          .map((p) => p.id.replace('prod_', 'draft_')),
      )
      const writes = allWrites.filter(
        (w) => w.kind === 'recipeDraft' && nullDraftIds.has(w.docId),
      )
      await runMigrationWrites(writes)
      setStatus('done')
      setMsg(`공용 레시피 ${writes.length}개를 추가했습니다.`)
    } catch (err) {
      setStatus('error')
      setMsg(err instanceof Error ? err.message : '실패했습니다.')
    }
  }

  return (
    <div className={`mt-4 ${CARD_CLS} p-6`}>
      <h2 className="text-base font-semibold text-gray-800">공용 레시피 복원</h2>
      <p className="mt-1 text-helper text-gray-500">
        2026-06-03 백업에 있는 공용(종 미지정) 레시피 6개를 새 앱에 추가합니다.
        이미 있는 항목은 덮어쓰지 않습니다 (같은 ID면 덮어씀 — 공용 레시피를
        수정한 적 없으면 안전).
      </p>
      {status === 'idle' && (
        <button
          className={`mt-4 ${PRIMARY_BTN_CLS}`}
          disabled={!uid}
          onClick={() => void handleImport()}
          type="button"
        >
          공용 레시피 6개 추가
        </button>
      )}
      {status === 'writing' && (
        <div className="mt-4 text-helper text-gray-600">추가 중...</div>
      )}
      {(status === 'done' || status === 'error') && (
        <div
          className={`mt-4 rounded-md px-3 py-2 text-helper ${
            status === 'done'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {msg}
        </div>
      )}
    </div>
  )
}

function PreviewRow({
  label,
  toWrite,
  existing,
}: {
  label: string
  toWrite: number
  existing: number
}) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-1.5 text-gray-700">{label}</td>
      <td className="py-1.5 text-right font-medium text-gray-800">{toWrite}</td>
      <td className="py-1.5 text-right text-gray-500">
        {existing > 0 ? existing : '—'}
      </td>
    </tr>
  )
}

export default SettingsPage
