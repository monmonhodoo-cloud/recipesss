import type {
  FdcFoodDetail,
  FdcFoodSearchItem,
  FdcSearchPage,
  FdcSearchResponse,
} from './usdaTypes'

const FDC_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'
const SEARCH_PAGE_SIZE = 50

function usdaApiKey(): string {
  const key = import.meta.env.VITE_USDA_API_KEY as string | undefined
  if (!key) throw new Error('USDA API 키가 설정되지 않았습니다.')
  return key
}

export async function searchFdcFoods(
  query: string,
  pageNumber = 1,
): Promise<FdcSearchPage> {
  const trimmed = query.trim()
  if (!trimmed) {
    return { foods: [], pageNumber, totalHits: 0, hasMore: false }
  }

  const params = new URLSearchParams({
    api_key: usdaApiKey(),
    dataType: 'Foundation,SR Legacy,Survey (FNDDS)', // Branded 제외
    pageSize: String(SEARCH_PAGE_SIZE),
    pageNumber: String(pageNumber),
    query: trimmed,
  })
  const response = await fetch(`${FDC_BASE_URL}/foods/search?${params}`)
  if (!response.ok) throw new Error(`USDA 검색 실패 (${response.status})`)
  const data = (await response.json()) as FdcSearchResponse

  const totalHits = data.totalHits ?? 0
  const totalPages =
    data.totalPages ?? (Math.ceil(totalHits / SEARCH_PAGE_SIZE) || 1)
  return {
    foods: sortFdcSearchFoods(data.foods ?? [], trimmed),
    pageNumber,
    totalHits,
    hasMore: pageNumber < totalPages,
  }
}

export async function fetchFdcFood(fdcId: number): Promise<FdcFoodDetail> {
  const params = new URLSearchParams({
    api_key: usdaApiKey(),
  })
  const response = await fetch(`${FDC_BASE_URL}/food/${fdcId}?${params}`)
  if (!response.ok) throw new Error(`USDA 상세 조회 실패 (${response.status})`)
  return (await response.json()) as FdcFoodDetail
}

export function sortFdcSearchFoods(
  foods: FdcFoodSearchItem[],
  query: string,
): FdcFoodSearchItem[] {
  return [...foods].sort((a, b) => {
    const score = scoreFdcFood(a, query) - scoreFdcFood(b, query)
    if (score !== 0) return score
    return a.description.localeCompare(b.description)
  })
}

function scoreFdcFood(food: FdcFoodSearchItem, query: string): number {
  const description = food.description.toLowerCase()
  const normalizedQuery = query.trim().toLowerCase()
  const dataTypeScore = dataTypePriority(food.dataType)

  let score = dataTypeScore * 100
  if (description === normalizedQuery) score -= 130
  if (description.startsWith(`${normalizedQuery},`)) score -= 110
  if (description.startsWith(normalizedQuery)) score -= 80
  if (
    /\b(raw|cooked|boiled|steamed|roasted|baked|canned|frozen)\b/.test(
      description,
    )
  ) {
    score -= 10
  }
  if (/\braw\b/.test(description)) score -= 25
  if (/\bcooked\b/.test(description)) score -= 25
  if (/\bcanned\b/.test(description)) score -= 5
  if (
    /\b(bread|cookie|muffin|pie|cake|soup|pancake|spice|mix)\b/.test(
      description,
    )
  ) {
    score += 25
  }

  return score
}

function dataTypePriority(dataType: string | undefined): number {
  if (dataType === 'SR Legacy') return 0
  if (dataType === 'Foundation') return 1
  if (dataType === 'Survey (FNDDS)') return 2
  if (dataType === 'Branded') return 30
  return 5
}
