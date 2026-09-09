import { describe, expect, it } from 'vitest'

import { navigationGroups } from './navigation'

// SPEC §5.1 / DL-041 승인한 네 메뉴의 회귀 방지.

describe('navigation', () => {
  it('SPEC §5.1 모든 경로 존재', () => {
    const paths = navigationGroups.flatMap((g) => g.items.map((i) => i.path))
    expect(paths).not.toContain('/')
    expect(paths).toContain('/history')
    expect(paths).toContain('/recipes')
    expect(paths).toContain('/ingredients')
    expect(paths).toContain('/orders')
    expect(paths).toHaveLength(4)
  })

  it('자주 쓰는 준비·출력과 날짜별 내역을 먼저 표시한다', () => {
    const orderGroup = navigationGroups.find((g) => g.id === 'prepare')
    expect(orderGroup).toBeDefined()
    expect(orderGroup!.items).toHaveLength(2)
    expect(orderGroup!.items.map((i) => i.path)).not.toContain('/presets')
  })

  it('원본 편집은 레시피와 원료·영양제 관리로 모은다', () => {
    const recipeGroup = navigationGroups.find((g) => g.id === 'manage')
    expect(recipeGroup).toBeDefined()
    expect(recipeGroup!.items).toHaveLength(2)
    expect(recipeGroup!.items.map((i) => i.path)).toEqual([
      '/recipes',
      '/ingredients',
    ])
  })

  it('사용하지 않는 단가·백업 메뉴를 표시하지 않는다', () => {
    const paths = navigationGroups.flatMap((g) => g.items.map((i) => i.path))
    expect(paths).not.toContain('/prices')
    expect(paths).not.toContain('/settings')
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
