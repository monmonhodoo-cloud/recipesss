import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const deletion = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }))
vi.mock('../features/recipes/recipeMutations', () => ({
  useDeleteRecipeDraft: () => deletion,
}))
import { DeleteRecipeDialog } from './DeleteRecipeDialog'

const originalDialogMethods = ['showModal', 'close'].map((name) => ({
  name,
  descriptor: Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    name,
  ),
}))

beforeEach(() => {
  deletion.mutateAsync.mockReset().mockResolvedValue(undefined)
  deletion.isPending = false
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '')
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open')
      },
    },
  })
})
afterEach(() => {
  cleanup()
  originalDialogMethods.forEach(({ name, descriptor }) => {
    if (descriptor)
      Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  })
})

function openDialog() {
  const onClose = vi.fn()
  const onDeleted = vi.fn()
  render(
    <DeleteRecipeDialog
      draft={{ id: 'd', name: '치킨', registeredRecipeId: 'shared' }}
      uid="owner"
      onClose={onClose}
      onDeleted={onDeleted}
    />,
  )
  return { onClose, onDeleted }
}

describe('레시피 삭제 확인', () => {
  it('삭제 범위를 경고하고 취소로는 삭제 요청을 보내지 않는다', () => {
    const { onClose } = openDialog()
    const dialog = screen.getByRole('dialog', {
      name: '레시피 전체를 삭제할까요?',
    })
    expect(dialog).toHaveTextContent(
      '원료 구성·영양제·프리셋이 함께 삭제됩니다.',
    )
    expect(dialog).toHaveTextContent('생산관리앱에 등록된 레시피도 유지됩니다.')
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(deletion.mutateAsync).not.toHaveBeenCalled()
  })

  it('삭제 실패를 표시하고 확인 후 재시도 성공해야 화면을 닫는다', async () => {
    deletion.mutateAsync.mockRejectedValueOnce(
      new Error('권한을 확인해주세요.'),
    )
    const { onDeleted } = openDialog()
    fireEvent.click(screen.getByRole('button', { name: '레시피 전체 삭제' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '권한을 확인해주세요.',
    )
    expect(onDeleted).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '레시피 전체 삭제' }))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
    expect(deletion.mutateAsync).toHaveBeenLastCalledWith('d')
  })

  it('삭제 중에는 중복 실행과 모달 닫기를 막는다', () => {
    deletion.isPending = true
    const { onClose } = openDialog()
    expect(screen.getByRole('button', { name: '삭제 중…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled()
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: true, cancelable: true }),
    )
    expect(onClose).not.toHaveBeenCalled()
  })
})
