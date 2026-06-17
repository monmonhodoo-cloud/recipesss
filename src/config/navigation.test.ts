import { describe, expect, it } from 'vitest'

import { navigationGroups } from './navigation'

// SPEC §5.1 / DL-024 / DL-026 / DL-035 메뉴 트리 회귀 방지.

describe('navigation', () => {
  it('SPEC §5.1 모든 경로 존재', () => {
    const paths = navigationGroups.flatMap((g) => g.items.map((i) => i.path))
    expect(paths).not.toContain('/') // 대시보드 제거 — 루트는 /recipes 리다이렉트
    expect(paths).toContain('/recipes/new')
    expect(paths).toContain('/recipes')
    expect(paths).toContain('/ingredients')
    expect(paths).toContain('/orders')
    expect(paths).toContain('/print')
    expect(paths).toContain('/prices')
    expect(paths).toContain('/settings')
  })

  it('발주 그룹은 2페이지 (발주·PDF — 프리셋 설정은 레시피 상세로 이동, DL-035)', () => {
    const orderGroup = navigationGroups.find((g) => g.id === 'orders')
    expect(orderGroup).toBeDefined()
    expect(orderGroup!.items).toHaveLength(2)
    expect(orderGroup!.items.map((i) => i.path)).not.toContain('/presets')
  })

  it('레시피 그룹은 3페이지 (신규·목록·확인)', () => {
    const recipeGroup = navigationGroups.find((g) => g.id === 'recipes')
    expect(recipeGroup).toBeDefined()
    expect(recipeGroup!.items).toHaveLength(3)
    expect(recipeGroup!.items.map((i) => i.path)).toContain('/recipe-check')
  })

  it('단가 메뉴는 별도 그룹으로 분리 (DL-024)', () => {
    const priceGroup = navigationGroups.find((g) => g.id === 'prices')
    expect(priceGroup).toBeDefined()
    // 원료 그룹에 합쳐지지 않음
    const ingredientPaths =
      navigationGroups.find((g) => g.id === 'ingredients')?.items.map((i) => i.path) ?? []
    expect(ingredientPaths).not.toContain('/prices')
  })

  it('각 라벨은 한국어 한 단어 이상', () => {
    for (const group of navigationGroups) {
      for (const item of group.items) {
        expect(item.label.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('경로에 중복 없음', () => {
    const paths = navigationGroups.flatMap((g) => g.items.map((i) => i.path))
    const unique = new Set(paths)
    expect(unique.size).toBe(paths.length)
  })
})
