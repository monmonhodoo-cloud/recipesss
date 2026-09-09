import type { RecipeCategory, RecipeDraft, Species } from '../../types/recipe'

export const RECIPE_CATEGORIES: RecipeCategory[] = [
  '생식',
  '동결건조',
  '동결텐더',
]

export type DraftSpeciesFilter = 'all' | Species

export type DraftCategoryFilter = 'all' | RecipeCategory

export type DraftFilter = {
  species: DraftSpeciesFilter
  category: DraftCategoryFilter
  search: string
}

export type SpeciesCounts = {
  cat: number
  dog: number
  none: number
}

export function filterDrafts(
  drafts: RecipeDraft[],
  filter: DraftFilter,
): RecipeDraft[] {
  const query = filter.search.trim().toLowerCase()

  return drafts.filter((draft) => {
    if (filter.species !== 'all' && draft.species !== filter.species) {
      return false
    }
    if (filter.category !== 'all' && draft.category !== filter.category) {
      return false
    }
    if (query && !draft.name.toLowerCase().includes(query)) return false
    return true
  })
}

export function countBySpecies(drafts: RecipeDraft[]): SpeciesCounts {
  const counts: SpeciesCounts = { cat: 0, dog: 0, none: 0 }

  for (const draft of drafts) {
    if (draft.species === 'cat') counts.cat += 1
    else if (draft.species === 'dog') counts.dog += 1
    else counts.none += 1
  }

  return counts
}
