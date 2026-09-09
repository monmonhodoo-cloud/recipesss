import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SavedOrder, SavedOrderSnapshot } from '../../types/recipe'

const backend = vi.hoisted(() => ({
  records: new Map<string, SavedOrder>(),
  fail: false,
  write: vi.fn(),
}))
vi.mock('../../firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => path,
  doc: (_db: unknown, path: string, id: string) => `${path}/${id}`,
  setDoc: async (path: string, record: SavedOrder) => {
    backend.write(path, record)
    if (backend.fail)
      throw Object.assign(new Error('permission denied'), {
        code: 'permission-denied',
      })
    backend.records.set(path, structuredClone(record))
  },
  getDocs: async (path: string) => ({
    docs: [...backend.records]
      .filter(([key]) => key.startsWith(`${path}/`))
      .map(([, record]) => ({
        id: record.id,
        data: () => structuredClone(record),
      })),
  }),
  deleteDoc: async (path: string) => {
    backend.records.delete(path)
  },
}))
import { useSavedOrders, useSaveOrder } from './orderStorage'

const snapshot: SavedOrderSnapshot = {
  version: 1,
  items: [
    {
      presetId: 'p',
      draftId: 'd',
      productLabel: '치킨',
      code: 'A0',
      inputAmount: 20,
      inputUnitLabel: 'kg',
      supplements: [],
    },
  ],
  outputOne: [
    { name: '치킨', columns: [{ header: 'A0 (20)', eggshell: '10.0g' }] },
  ],
  outputTwo: { eggshellWeights: ['10.0g'], aliasGroups: [] },
}
function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}
beforeEach(() => {
  backend.records.clear()
  backend.fail = false
  backend.write.mockClear()
})

describe('준비 내역 저장 경계', () => {
  it('서버 저장 후 캐시를 비우고 새로 조회해도 날짜와 두 양식이 돌아온다', async () => {
    const save = renderHook(() => useSaveOrder('owner'), { wrapper: wrapper() })
    await act(async () => {
      await save.result.current.mutateAsync({
        presetIds: ['p'],
        now: new Date(2026, 8, 9, 23, 55).getTime(),
        snapshot,
      })
    })
    save.unmount()
    const history = renderHook(() => useSavedOrders('owner'), {
      wrapper: wrapper(),
    })
    await waitFor(() => expect(history.result.current.isSuccess).toBe(true))
    expect(history.result.current.data?.[0]?.date).toBe('2026-09-09')
    expect(history.result.current.data?.[0]?.snapshot).toEqual(snapshot)
    const other = renderHook(() => useSavedOrders('other'), {
      wrapper: wrapper(),
    })
    await waitFor(() => expect(other.result.current.data).toEqual([]))
  })

  it('쓰기 실패를 성공으로 표시하지 않고 저장 내역도 만들지 않는다', async () => {
    backend.fail = true
    const save = renderHook(() => useSaveOrder('owner'), { wrapper: wrapper() })
    await act(async () => {
      await expect(
        save.result.current.mutateAsync({
          presetIds: ['p'],
          now: Date.now(),
          snapshot,
        }),
      ).rejects.toThrow('permission denied')
    })
    await waitFor(() => expect(save.result.current.isError).toBe(true))
    expect(backend.records.size).toBe(0)
  })
})
