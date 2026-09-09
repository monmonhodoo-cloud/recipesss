import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'

import { db } from '../../firebase'
import type { Ingredient, Preset, RecipeDraft } from '../../types/recipe'

function ingredientRef(uid: string, ingredientId: string) {
  return doc(db, `recipesssIngredients/${uid}/items`, ingredientId)
}

function draftRef(uid: string, draftId: string) {
  return doc(db, `recipeDrafts/${uid}/items`, draftId)
}

function presetRef(uid: string, presetId: string) {
  return doc(db, `recipesssPresets/${uid}/items`, presetId)
}

export function useUpdateIngredient(uid: string | undefined) {
  const queryClient = useQueryClient()
  const ingredientsQueryKey = ['recipesssIngredients', uid]

  return useMutation({
    mutationFn: async (ingredient: Ingredient) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      await setDoc(ingredientRef(uid, ingredient.id), ingredient)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ingredientsQueryKey }),
  })
}

export function useCreateIngredient(uid: string | undefined) {
  const queryClient = useQueryClient()
  const ingredientsQueryKey = ['recipesssIngredients', uid]

  return useMutation({
    mutationFn: async (ingredient: Ingredient) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      await setDoc(ingredientRef(uid, ingredient.id), ingredient)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ingredientsQueryKey }),
  })
}

export function useUpdatePreparationSettings(uid: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ingredientId,
      includeInPreparation,
      displayName,
    }: {
      ingredientId: string
      includeInPreparation: boolean
      displayName: string
    }) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      // 기존 문서의 출력 설정만 수정한다. 원료 구분·영양값·배합은 건드리지 않는다.
      await updateDoc(ingredientRef(uid, ingredientId), {
        includeInPreparation,
        displayName: displayName.trim(),
      })
    },
    onSuccess: (_, settings) =>
      queryClient.setQueryData<Ingredient[]>(
        ['recipesssIngredients', uid],
        (items) =>
          items?.map((item) =>
            item.id === settings.ingredientId
              ? {
                  ...item,
                  includeInPreparation: settings.includeInPreparation,
                  displayName: settings.displayName.trim(),
                }
              : item,
          ),
      ),
  })
}

export function useMergeIngredients(uid: string | undefined) {
  const queryClient = useQueryClient()
  const ingredientsQueryKey = ['recipesssIngredients', uid]
  const draftsQueryKey = ['recipeDrafts', uid]
  const presetsQueryKey = ['recipesssPresets', uid]

  return useMutation({
    mutationFn: async ({
      changedDrafts,
      changedPresets,
      deleteIds,
      target,
    }: {
      target: Ingredient
      deleteIds: string[]
      changedDrafts: RecipeDraft[]
      changedPresets: Preset[]
    }) => {
      if (!uid) throw new Error('로그인이 필요합니다.')

      const batch = writeBatch(db)
      batch.set(ingredientRef(uid, target.id), target)
      for (const ingredientId of deleteIds) {
        batch.delete(ingredientRef(uid, ingredientId))
      }
      for (const draft of changedDrafts) {
        batch.set(draftRef(uid, draft.id), draft)
      }
      for (const preset of changedPresets) {
        batch.set(presetRef(uid, preset.id), preset)
      }

      await batch.commit()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ingredientsQueryKey })
      void queryClient.invalidateQueries({ queryKey: draftsQueryKey })
      void queryClient.invalidateQueries({ queryKey: presetsQueryKey })
    },
  })
}

export function useDeleteIngredient(uid: string | undefined) {
  const queryClient = useQueryClient()
  const ingredientsQueryKey = ['recipesssIngredients', uid]

  return useMutation({
    mutationFn: async (ingredientId: string) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      await deleteDoc(ingredientRef(uid, ingredientId))
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ingredientsQueryKey }),
  })
}
