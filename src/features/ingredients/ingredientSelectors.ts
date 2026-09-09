import type { Ingredient, NutrientValues } from '../../types/recipe'

// 명시적 출력 설정은 원료 구분·기존 숨김과 독립적이다. 미설정 데이터만 이전 규칙 사용.
export function isPreparationIncluded(item: Ingredient): boolean {
  return (
    item.includeInPreparation ?? (item.kind === 'supplement' && !item.hidden)
  )
}

export type IngredientGroups = {
  ingredient: Ingredient[]
  supplement: Ingredient[]
}

export function filterIngredients(
  items: Ingredient[],
  search: string,
): Ingredient[] {
  const query = search.trim().toLowerCase()
  if (!query) return [...items]

  // 원료 마스터는 원료명(name)으로만 검색. 치환명(displayName)은 발주·출력 전용.
  return items.filter((item) => item.name.toLowerCase().includes(query))
}

export function groupByKind(items: Ingredient[]): IngredientGroups {
  const groups: IngredientGroups = { ingredient: [], supplement: [] }

  // 이름(가나다)순 정렬 — 찾기 쉽게. 동명은 sortOrder로 안정 정렬.
  const sorted = [...items].sort(
    (a, b) => a.name.localeCompare(b.name, 'ko') || a.sortOrder - b.sortOrder,
  )
  for (const item of sorted) {
    groups[item.kind].push(item)
  }

  return groups
}

export function filledNutrientCount(
  profile: NutrientValues | undefined,
): number {
  if (!profile) return 0
  return Object.values(profile).filter((value) => value !== undefined).length
}
