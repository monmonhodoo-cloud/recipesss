import { useEffect, useId, useRef, useState } from 'react'

import { useDeleteRecipeDraft } from '../features/recipes/recipeMutations'
import { SECONDARY_BTN_CLS } from '../lib/ui'
import type { RecipeDraft } from '../types/recipe'

export function DeleteRecipeDialog({
  draft,
  uid,
  onClose,
  onDeleted,
}: {
  draft: Pick<RecipeDraft, 'id' | 'name' | 'registeredRecipeId'>
  uid: string | undefined
  onClose: () => void
  onDeleted: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const deletion = useDeleteRecipeDraft(uid)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current!
    dialog.showModal()
    cancelRef.current?.focus()
    return () => dialog.close()
  }, [])

  async function handleDelete() {
    setError('')
    try {
      await deletion.mutateAsync(draft.id)
      onDeleted()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '삭제하지 못했습니다. 다시 시도해주세요.',
      )
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-modal="true"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-5 shadow-xl backdrop:bg-black/40"
      onCancel={(event) => {
        event.preventDefault()
        if (!deletion.isPending) onClose()
      }}
    >
      <h2 id={titleId} className="text-base font-semibold text-gray-800">
        레시피 전체를 삭제할까요?
      </h2>
      <p
        id={descriptionId}
        className="mt-3 break-keep text-sm leading-relaxed text-gray-600"
      >
        <strong className="font-semibold text-gray-900">{draft.name}</strong>의
        원료 구성·영양제·프리셋이 함께 삭제됩니다. 삭제하면 되돌릴 수 없습니다.
      </p>
      <p className="mt-2 break-keep text-xs leading-relaxed text-gray-500">
        원료·영양제 마스터와 저장된 준비 내역은 유지됩니다.
        {draft.registeredRecipeId &&
          ' 생산관리앱에 등록된 레시피도 유지됩니다.'}
      </p>
      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          ref={cancelRef}
          className={SECONDARY_BTN_CLS}
          disabled={deletion.isPending}
          onClick={onClose}
          type="button"
        >
          취소
        </button>
        <button
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          disabled={deletion.isPending}
          onClick={() => void handleDelete()}
          type="button"
        >
          {deletion.isPending ? '삭제 중…' : '레시피 전체 삭제'}
        </button>
      </div>
    </dialog>
  )
}
