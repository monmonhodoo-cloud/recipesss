import { describe, expect, it } from 'vitest'

import { sortFdcSearchFoods } from './usdaClient'
import type { FdcFoodSearchItem } from './usdaTypes'

describe('sortFdcSearchFoods', () => {
  it('prioritizes generic raw/cooked foods over branded or processed matches', () => {
    const foods: FdcFoodSearchItem[] = [
      { fdcId: 1, description: 'PUMPKIN', dataType: 'Branded' },
      { fdcId: 2, description: 'Bread, pumpkin', dataType: 'Survey (FNDDS)' },
      { fdcId: 3, description: 'Pumpkin, cooked', dataType: 'Survey (FNDDS)' },
      { fdcId: 4, description: 'Pumpkin, raw', dataType: 'SR Legacy' },
      {
        fdcId: 5,
        description: 'Pumpkin, canned, without salt',
        dataType: 'SR Legacy',
      },
    ]

    expect(sortFdcSearchFoods(foods, 'pumpkin').map((food) => food.description))
      .toEqual([
        'Pumpkin, raw',
        'Pumpkin, canned, without salt',
        'Pumpkin, cooked',
        'Bread, pumpkin',
        'PUMPKIN',
      ])
  })
})
