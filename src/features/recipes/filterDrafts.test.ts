import { describe, expect, it } from 'vitest'

import { countBySpecies, filterDrafts, type DraftFilter } from './filterDrafts'
import type { RecipeDraft, Species } from '../../types/recipe'

function draft(
  id: string,
  name: string,
  species: Species,
  status: RecipeDraft['status'] = 'draft',
): RecipeDraft {
  return {
    id,
    ownerUid: 'uid',
    name,
    species,
    unitIngredientId: 'ing_unit',
    unitLabel: 'ea',
    composition: [],
    standardId: '',
    status,
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
  }
}

const drafts = [
  draft('draft_cat_chicken', 'Chicken Cat', 'cat'),
  draft('draft_dog_beef', 'Beef Dog', 'dog'),
  draft('draft_none_fish', 'Fish Trial', null),
  draft('draft_cat_old', 'Old Cat', 'cat', 'inactive'),
]

const allFilter: DraftFilter = {
  species: 'all',
  category: 'all',
  search: '',
}

describe('filterDrafts', () => {
  it('returns every draft for the all filter', () => {
    expect(filterDrafts(drafts, allFilter)).toHaveLength(4)
  })

  it('includes old inactive recipes and recipes with no status', () => {
    const withoutStatus = draft('new', 'New recipe', 'cat')
    delete withoutStatus.status
    expect(
      filterDrafts([...drafts, withoutStatus], allFilter).map((d) => d.id),
    ).toEqual(drafts.map((d) => d.id).concat('new'))
  })

  it('filters by species including null', () => {
    expect(
      filterDrafts(drafts, { ...allFilter, species: 'cat' }).map((d) => d.id),
    ).toEqual(['draft_cat_chicken', 'draft_cat_old'])

    expect(
      filterDrafts(drafts, { ...allFilter, species: 'dog' }).map((d) => d.id),
    ).toEqual(['draft_dog_beef'])

    expect(
      filterDrafts(drafts, { ...allFilter, species: null }).map((d) => d.id),
    ).toEqual(['draft_none_fish'])
  })

  it('searches by name with trim and case-insensitive partial matching', () => {
    expect(
      filterDrafts(drafts, { ...allFilter, search: '  cat  ' }).map(
        (d) => d.id,
      ),
    ).toEqual(['draft_cat_chicken', 'draft_cat_old'])
  })

  it('combines species and search filters', () => {
    expect(
      filterDrafts(drafts, {
        species: 'cat',
        category: 'all',
        search: 'chick',
      }).map((d) => d.id),
    ).toEqual(['draft_cat_chicken'])
  })

  it('handles empty input', () => {
    expect(filterDrafts([], allFilter)).toEqual([])
  })
})

describe('countBySpecies', () => {
  it('counts cat, dog, and unknown species from the unfiltered list', () => {
    expect(countBySpecies(drafts)).toEqual({ cat: 2, dog: 1, none: 1 })
  })

  it('handles empty input', () => {
    expect(countBySpecies([])).toEqual({ cat: 0, dog: 0, none: 0 })
  })
})
