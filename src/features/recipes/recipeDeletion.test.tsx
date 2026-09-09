import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const backend = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
  failRead: false,
  failCommit: false,
  committed: vi.fn(),
}))
vi.mock('../../firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => path,
  doc: (_db: unknown, path: string, id: string) => `${path}/${id}`,
  where: (field: string, _op: string, value: string) => ({ field, value }),
  query: (path: string, filter: { field: string; value: string }) => ({
    path,
    filter,
  }),
  getDocs: async ({
    path,
    filter,
  }: {
    path: string
    filter: { field: string; value: string }
  }) => {
    if (backend.failRead) throw new Error('프리셋 조회 실패')
    return {
      docs: [...backend.records]
        .filter(
          ([key, record]) =>
            key.startsWith(`${path}/`) && record[filter.field] === filter.value,
        )
        .map(([ref]) => ({ ref })),
    }
  },
  writeBatch: () => {
    const paths: string[] = []
    return {
      delete: (path: string) => paths.push(path),
      commit: async () => {
        if (backend.failCommit) throw new Error('삭제 권한 오류')
        backend.committed([...paths])
        paths.forEach((path) => backend.records.delete(path))
      },
    }
  },
}))
import { useDeleteRecipeDraft } from './recipeMutations'

function setup(uid: string | undefined = 'owner') {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => useDeleteRecipeDraft(uid), { wrapper })
  return { ...hook, invalidate }
}

beforeEach(() => {
  backend.records = new Map([
    ['recipeDrafts/owner/items/d', { name: '치킨' }],
    ['recipesssPresets/owner/items/p1', { draftId: 'd' }],
    ['recipesssPresets/owner/items/p2', { draftId: 'd' }],
    ['recipesssPresets/owner/items/other', { draftId: 'other' }],
    ['recipesssPresets/other-user/items/p1', { draftId: 'd' }],
    ['recipesssIngredients/owner/items/ing', { name: '닭고기' }],
    [
      'recipesssOrders/owner/items/saved',
      { snapshot: { items: [{ draftId: 'd' }] } },
    ],
    ['recipes/shared', { recipesssDraftId: 'd' }],
  ])
  backend.failRead = false
  backend.failCommit = false
  backend.committed.mockClear()
})

describe('레시피 전체 삭제 경계', () => {
  it('해당 레시피와 본인 계정의 연결 프리셋만 함께 삭제하고 두 목록을 갱신한다', async () => {
    const { result, invalidate } = setup()
    await act(async () => {
      await result.current.mutateAsync('d')
    })
    expect(backend.committed).toHaveBeenCalledTimes(1)
    expect(backend.records.has('recipeDrafts/owner/items/d')).toBe(false)
    expect(backend.records.has('recipesssPresets/owner/items/p1')).toBe(false)
    expect(backend.records.has('recipesssPresets/owner/items/p2')).toBe(false)
    expect([...backend.records.keys()]).toEqual([
      'recipesssPresets/owner/items/other',
      'recipesssPresets/other-user/items/p1',
      'recipesssIngredients/owner/items/ing',
      'recipesssOrders/owner/items/saved',
      'recipes/shared',
    ])
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['recipeDrafts', 'owner'],
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['recipesssPresets', 'owner'],
    })
  })

  it.each(['failRead', 'failCommit'] as const)(
    '%s 실패 시 일부만 삭제하거나 성공 처리하지 않는다',
    async (failure) => {
      const before = structuredClone([...backend.records])
      backend[failure] = true
      const { result, invalidate } = setup()
      await act(async () => {
        await expect(result.current.mutateAsync('d')).rejects.toThrow()
      })
      expect([...backend.records]).toEqual(before)
      expect(backend.committed).not.toHaveBeenCalled()
      expect(invalidate).not.toHaveBeenCalled()
    },
  )

  it('프리셋이 없는 레시피도 삭제할 수 있다', async () => {
    backend.records.set('recipeDrafts/owner/items/empty', { name: '빈 레시피' })
    const { result } = setup()
    await act(async () => {
      await result.current.mutateAsync('empty')
    })
    expect(backend.committed).toHaveBeenCalledWith([
      'recipeDrafts/owner/items/empty',
    ])
  })
})
