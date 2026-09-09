import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore'

import { db } from '../../firebase'
import type { SavedOrder, SavedOrderSnapshot } from '../../types/recipe'
import { localDateKey } from './orderSnapshot'

// 저장된 발주 (DL-039): recipesssOrders/{uid}/items/{orderId}

function orderRef(uid: string, orderId: string) {
  return doc(db, `recipesssOrders/${uid}/items`, orderId)
}

export function useSavedOrders(uid: string | undefined) {
  return useQuery({
    queryKey: ['recipesssOrders', uid],
    queryFn: async () => {
      const snap = await getDocs(
        collection(db, `recipesssOrders/${uid as string}/items`),
      )
      return snap.docs
        .map((docSnap) => ({
          ...(docSnap.data() as SavedOrder),
          id: docSnap.id,
        }))
        .sort((a, b) => b.createdAt - a.createdAt)
    },
    enabled: !!uid,
  })
}

export function useSaveOrder(uid: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ['recipesssOrders', uid]

  return useMutation({
    mutationFn: async ({
      presetIds,
      now,
      snapshot,
    }: {
      presetIds: string[]
      now: number
      snapshot: SavedOrderSnapshot
    }) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      if (presetIds.length === 0) throw new Error('선택된 프리셋이 없습니다.')

      if (
        snapshot.items.length !== presetIds.length ||
        snapshot.items.some((item) => !presetIds.includes(item.presetId))
      ) {
        throw new Error(
          '선택한 프리셋과 저장할 내용이 다릅니다. 다시 시도해주세요.',
        )
      }
      const id = `order_${crypto.randomUUID()}`
      const date = localDateKey(now)
      const order: SavedOrder = {
        id,
        date,
        presetIds,
        createdAt: now,
        snapshot,
      }
      await setDoc(orderRef(uid, id), order)
      return order
    },
    onSuccess: (order) => {
      queryClient.setQueryData<SavedOrder[]>(queryKey, (previous) => [
        order,
        ...(previous ?? []).filter((item) => item.id !== order.id),
      ])
      return queryClient.invalidateQueries({ queryKey })
    },
  })
}

export function useDeleteOrder(uid: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ['recipesssOrders', uid]

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      await deleteDoc(orderRef(uid, orderId))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
}
