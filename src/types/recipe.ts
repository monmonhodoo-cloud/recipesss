// v3 도메인 모델 (SPEC §4). 스키마 버전 v3.
// v2 → v3 변환은 src/features/migration/* 참조 (SPEC §11.1).

export type Species = 'cat' | 'dog' | null

export type WeightUnit = 'g' | 'kg'

export type IngredientKind = 'ingredient' | 'supplement'

// 레시피 카테고리 (recipesss). 등록 시 생산앱 category로 매핑 (DL-037).
export type RecipeCategory = '생식' | '동결건조' | '동결텐더'

// 영양소 키 (SPEC §4.4: 일반성분·아미노산·지방산·미네랄·비타민).
// 단계 1-A에서 전체 키셋 확정 (FEDIAF 2025 기준, DL-032). erasableSyntaxOnly
// 제약으로 enum 대신 union 사용. 일반성분은 사료 표준 용어(crude*) 유지.
// 일반성분 fiber/ash/moisture/nfe는 표준 요구량엔 없고 ME·NFE 계산(§6.1/6.2)용.
export type NutrientKey =
  // 일반성분
  | 'crudeProtein'
  | 'crudeFat'
  | 'crudeFiber'
  | 'ash'
  | 'moisture'
  | 'nfe'
  // 아미노산
  | 'arginine'
  | 'histidine'
  | 'isoleucine'
  | 'leucine'
  | 'lysine'
  | 'methionine'
  | 'methionineCystine'
  | 'phenylalanine'
  | 'phenylalanineTyrosine'
  | 'threonine'
  | 'tryptophan'
  | 'valine'
  | 'taurine'
  // 지방산
  | 'linoleicAcid'
  | 'arachidonicAcid'
  | 'alphaLinolenicAcid'
  | 'epaDha'
  // 미네랄
  | 'calcium'
  | 'phosphorus'
  | 'potassium'
  | 'sodium'
  | 'chloride'
  | 'magnesium'
  | 'copper'
  | 'iodine'
  | 'iron'
  | 'manganese'
  | 'selenium'
  | 'zinc'
  // 비타민
  | 'vitaminA'
  | 'vitaminD'
  | 'vitaminE'
  | 'vitaminB1'
  | 'vitaminB2'
  | 'vitaminB3'
  | 'vitaminB5'
  | 'vitaminB6'
  | 'vitaminB7'
  | 'vitaminB9'
  | 'vitaminB12'
  | 'choline'
  | 'vitaminK'

export type NutrientValues = Partial<Record<NutrientKey, number>>

// SPEC §4.1 CompositionRow
export type CompositionRow = {
  ingredientId: string
  weight: number // g 기준 항상
  unit: WeightUnit // 표시용
  sortOrder: number // 드래그&드롭 정렬
}

// SPEC §4.1 RecipeDraft (recipesss 전용)
export type RecipeDraft = {
  id: string // 'draft_xxxxxxxx'
  ownerUid: string // 호두님 uid
  name: string
  species: Species
  category?: RecipeCategory // 생식/동결건조/동결텐더 (미설정 = 미분류)
  unitIngredientId: string // 생산단위 기준 원료
  unitLabel: string // 예: '마리'
  composition: CompositionRow[]
  standardId: string // NutrientProfile id (예: AAFCO_2014_CAT_ADULT)
  status?: 'draft' | 'inactive' // 이전 데이터 호환용. 표시·사용 여부를 제한하지 않는다.
  sortOrder: number // 드래그&드롭 정렬
  // 영양값 (DL-027): 계산값은 자동 계산하므로 저장 X, 확정값만 저장.
  declaredNutrients?: NutrientValues
  declaredNutrientsUpdatedAt?: number
  createdAt: number
  updatedAt: number
  // 등록 후 추적용
  registeredRecipeId?: string
  registeredAt?: number
  // 원료 병합으로 동일 원료 행이 합산된 경우 true (DL-034). 레시피 화면에서
  // 호두님이 합산 결과를 확인(붉은 버튼)하기 전까지 사용 게이트로 쓴다.
  mergeReviewPending?: boolean
}

// SPEC §4.2 Recipe (생산관리앱 공유 — 등록된 레시피). 영양제 없음 (DL-025).
export type Recipe = {
  id: string
  name: string
  species: Species
  composition: Array<{
    ingredientId: string
    weight: number
    unit: WeightUnit
  }>
  unitLabel: string
  sortOrder: number
  createdBy: string
  source: 'recipesss' | 'production-app'
  recipesssDraftId?: string
  createdAt: number
}

// SPEC §4.3 Ingredient (원료 마스터)
export type Ingredient = {
  id: string // 'ing_xxxxxxxx'
  name: string
  kind: IngredientKind
  displayName: string // 치환명 (선택, 빈 문자열 가능)
  aliases: string[]
  hidden: boolean
  includeInPreparation?: boolean // 미설정은 기존 표시 중인 영양제만 포함
  nutrientProfile?: NutrientValues // 100g 당 영양값 (USDA import or 수동)
  source?: {
    type: 'usda' | 'manual'
    fdcId?: number
    importedAt?: number
  }
  vendor?: { name: string; url?: string }
  moistureBasis?: 'as-fed' | 'dry-matter'
  sortOrder: number // 드래그&드롭 정렬
}

// SPEC §4.6 USDA Cache (usdaCache/{fdcId}). FDC food 상세를 매핑·캐시 (단계 2).
// 동일 fdcId 재호출 방지. nutrients = fdcNutrientMap으로 변환된 100g당 값.
export type UsdaCacheEntry = {
  fdcId: number
  description: string
  dataType?: string // 'Foundation' | 'SR Legacy' | 'Survey (FNDDS)' | 'Branded'
  nutrients: NutrientValues // 100 g 당
  fetchedAt: number
}

// SPEC §4.7 Preset (draftId 참조)
export type Preset = {
  id: string // 'preset_xxxxxxxx'
  draftId: string // recipeDrafts 참조 (등록 후엔 recipes id로 변경)
  code: string // 예: 'A0'
  targetWeight: number // g
  label: string
  unitIngredientId: string
  inputAmount: number
  inputUnitLabel: string
  sortOrder: number // 드래그&드롭 정렬
  createdAt: number
}

// DL-041: 준비 당시의 계산 결과와 두 출력 양식을 함께 보관한다.
export type SavedOrderSnapshot = {
  version: 1
  items: Array<{
    presetId: string
    draftId: string
    productLabel: string
    code: string
    inputAmount: number
    inputUnitLabel: string
    supplements: Array<{
      ingredientId: string
      name: string
      displayName: string
      scaledWeight: number
    }>
  }>
  outputOne: Array<{
    name: string
    columns: Array<{ header: string; eggshell: string }>
    rows?: Array<{ name: string; weights: string[] }> // 없는 과거 내역은 난각분 표 유지
  }>
  outputTwo: {
    eggshellWeights: string[]
    aliasGroups: Array<{
      name: string
      codes: string[]
      rows: Array<{ displayName: string; weights: string[] }>
    }>
  }
}

// 기존 ID-only 내역도 읽는다. 당시 수치를 복원할 수 없다는 안내가 필요하다.
export type SavedOrder = {
  id: string // 'order_xxxxxxxx'
  date: string // 'YYYY-MM-DD' (저장일)
  presetIds: string[]
  createdAt: number
  snapshot?: SavedOrderSnapshot
}

// SPEC §4.8 Price (별도 인터페이스 미정 — DL-024).
// 단계 5에서 생산관리앱과 협의 후 확정. 마이그레이션은 v2 값을 그대로 보존만.
export type Price = {
  price: number
  unit: number
}

// SPEC §4.5 NutrientProfile (영양 표준). 단계 1-A 정식화 (DL-032).
// 표준 데이터는 앱 정적 번들 (src/features/nutrition/profiles/*). Firestore 미사용.
export type NutrientStandard = 'FEDIAF' | 'AAFCO' | 'NRC'

// FEDIAF 생애단계.
//   adult            성체 유지
//   early_growth_repro  개: 초기 성장(<14주) & 번식 / 고양이: 성장·번식
//   late_growth      개: 후기 성장(≥14주)
export type LifeStage = 'adult' | 'early_growth_repro' | 'late_growth'

// 영양소 1개의 요구량. min/max는 프로파일 basis 단위 기준.
// maxType: FEDIAF 상한 종류 — 'legal'(EU 법적 (L)) / 'nutritional'(영양 (N)).
export type NutrientRequirement = {
  min: number
  max?: number
  maxType?: 'legal' | 'nutritional'
}

export type NutrientProfile = {
  id: string // 예: 'FEDIAF_2025_DOG_ADULT_MER95'
  standard: NutrientStandard
  year: number
  species: Exclude<Species, null> // 'cat' | 'dog'
  lifeStage: LifeStage
  label: string // 한글 표시명 (예: '성견 (MER 95)')
  mer?: string // 성체 MER 구분 표시 (예: '95 kcal/kg^0.75')
  // per 1000 kcal ME 기준 (기본 basis, DL-008)
  perMe: Partial<Record<NutrientKey, NutrientRequirement>>
  // per 100 g dry matter 기준 (토글)
  perDm: Partial<Record<NutrientKey, NutrientRequirement>>
  // Ca/P 비율 (단위가 비율이라 NutrientKey와 분리)
  ratios?: { caP?: { min: number; max: number } }
}
