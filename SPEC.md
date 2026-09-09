# 레시피 계산기 (recipesss) — 통합 SPEC

> 본 문서는 신규 recipesss의 **유일한 진실 공급원(single source of truth)**.
> 구현 결정·UI 디테일·운영 절차 모두 여기에 박는다. 충돌 시 본 문서가 우선.
> 변경은 PR 한 줄짜리라도 §13 결정 로그에 기록.

---

## 0. 메타

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.3 |
| 최종 갱신 | 2026-06-03 |
| 대상 앱 코드명 | recipesss |
| 대상 리포 | github.com/green-cloud-workroom/recipesss |
| **소속 Firebase** | **fant-e5ae5** (운영관리앱·생산관리앱과 공유) |
| 운영관리앱 (디자인 mirror 소스) | `C:\dev\fantapet-inventory` (React/TS) |
| 생산관리앱 (레시피 정식 소유) | `C:\Users\oddsk\Downloads\OneDrive\문서\fant management\fant` (바닐라 JS) |

### 용어
- **레시피(Recipe)**: 1건의 사료 배합. `species`(cat/dog/null) + `composition`(원료 행).
- **드래프트(Draft)**: recipesss에서 작성·임시저장 중인 레시피. `recipeDrafts` 컬렉션에 보관.
- **등록(Registered)**: 드래프트 → 영양제 제외·필드 정규화 → 생산관리앱 공유 `recipes` 컬렉션 승격.
- **원료(Ingredient)**: 마스터에 등록된 1건의 식재료/첨가물. `kind`(ingredient/supplement).
- **영양 프로파일(NutrientProfile)**: 영양소별 min/max 표준 (AAFCO/NRC/FEDIAF).
- **부족분 매트릭스**: 영양소 × 생애주기(자견·성견·자묘·성묘) 표.
- **ME**: 대사에너지(Metabolizable Energy), kcal/100g.
- **NFE**: Nitrogen-Free Extract(탄수화물 추정), DM 기준 g.
- **DM**: 건물(Dry Matter), 수분 제외 무게.
- **lifestage**: `cat-growth`, `cat-adult`, `dog-growth`, `dog-adult` 4종.

### 3개 앱 관계도

```
fant-e5ae5 (Firebase 프로젝트 하나)
├── 운영관리앱 (fantapet-inventory)        디자인 mirror 소스 (단계 0까지만)
│   • React/TS/Vite/Tailwind/shadcn
│   • Firebase Hosting: 별도 타겟
│
├── 생산관리앱 (fant management/fant)       레시피 정식 소유
│   • 바닐라 JS, recipes 컬렉션 write
│   • Firebase Hosting: 별도 타겟
│
└── recipesss (신규)                        본 SPEC 대상
    • React/TS/Vite/Tailwind/shadcn (단계 0까지 운영관리앱 mirror)
    • recipeDrafts 컬렉션 write
    • "등록" 시 recipes 컬렉션으로 승격 (영양제 제외)
    • Firebase Hosting: 별도 타겟
```

---

## 1. 목표·범위·비범위

### 목표
1. 호두님(1인) 펫 사료 레시피 작성·계산·검증·생산앱 등록 통합 도구.
2. **fant-e5ae5에 세 번째 앱**으로 합류. 운영·생산앱과 같은 인증·같은 Firestore.
3. 운영관리앱과 시각적·UX·기술 스택을 **동일하게 시작** (DL-021로 단계 0 끝까지 mirror).
4. 안정성: **스펙 → 구현 → 회귀 테스트** 순서 강제. 즉흥 수정 금지.
5. 단계별 배포 가능: 단계 N 끝나면 항상 동작하는 앱.

### 범위 (MVP에 포함)
- 레시피 작성 = 영양 매트릭스 = 원가 계산 **하나의 화면**으로 통합 (DL-024)
- 원료 추가·중량 조절 시 영양 매트릭스·원가 즉시 갱신
- **영양값 = 계산값 + 확정값 이중 컬럼** (DL-027). 확정값 수동 편집 가능. 부족분 판정은 확정값 우선 (DL-028).
- 임시저장 (`recipeDrafts/`) + 등록 (`recipes/`로 승격, 영양제 자동 제외)
- 원료 마스터에 USDA FoodData Central 영양 데이터 import + **수동 원료 추가·영양값 직접 입력** (영양제 포함, DL-030)
- 자견·성견·자묘·성묘 × 영양소 부족분 매트릭스 (AAFCO 기준)
- 발주 그룹 3페이지: 프리셋 설정·발주·PDF 출력 (DL-026)
- 발주 간결한 표시 (예: `(고양이)치킨 a0 20 / a1 40`)
- 레시피 1건 → PDF 출력 2가지 버전
- 레시피 목록 (활성/임시/비활성 상태 필터)
- 표 드래그&드롭으로 행 순서 이동 (DL-022)

### 비범위 (MVP 제외)
- 작성자/승인자 분리, 락(lock), 승인 워크플로우 → 1인 사용이므로 불필요
- QR 코드 생성 → 보류 (필요 시 후속 PR)
- 다국어 → 한국어만
- NRC·FEDIAF 표준 → 스키마는 열어두되 MVP는 AAFCO만 활성화
- 다크 모드 → 라이트만 (운영관리앱과 동일)
- 다중 사용자 권한·role
- 단가 관리(`/prices`) → 메뉴 슬롯은 유지하나 데이터 인터페이스 TBD (생산관리앱에서 불러올 예정, 단계별 일정 외 별도 처리)

---

## 2. 스택·의존성

운영관리앱(`fantapet-inventory`)과 단계 0까지 **버전 단위까지** 일치. 신규 의존성 추가 시 운영관리앱 버전 확인 후 결정.

```jsonc
// 운영관리앱 의존성 mirror + recipesss 신규
{
  "dependencies": {
    "@tanstack/react-query": "^5.100.10",
    "clsx": "^2.1.1",
    "firebase": "^12.13.0",
    "lucide-react": "^1.16.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.76.0",
    "react-router-dom": "^6.30.2",
    "recharts": "^3.8.1",
    "tailwind-merge": "^3.6.0",
    "zod": "^4.4.3",
    "zustand": "^5.0.13",

    // recipesss 신규
    "@react-pdf/renderer": "^4.x",      // PDF (DL-004)
    "@dnd-kit/core": "^6.x",            // 표 드래그&드롭 (DL-022)
    "@dnd-kit/sortable": "^8.x",        // 같음
    "@dnd-kit/modifiers": "^7.x"        // 같음
  },
  "devDependencies": {
    "vite": "^8.0.12",
    "vitest": "^4.1.6",
    "typescript": "~6.0.2",
    "tailwindcss": "^3.4.17",
    "@vitejs/plugin-react": "^6.0.1",
    "eslint": "^10.3.0",
    "prettier": "^3.8.3",
    "@testing-library/react": "^16.3.2",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/user-event": "^14.6.1",
    "jsdom": "^29.1.1"
  }
}
```

### Node·npm
- Node 22 LTS (운영관리앱 Functions와 동일)
- npm 10+

---

## 3. 디자인 시스템

**원칙 (DL-021)**: 운영관리앱(`fantapet-inventory`)과 **단계 0 완료 시점까지만** mirror. 단계 0.5부터는 독립 진행 — 운영관리앱이 변경되어도 recipesss는 따라가지 않음.

### 3.1 Tailwind 토큰 (단계 0 mirror)

운영관리앱 `tailwind.config.ts`를 단계 0에서 그대로 복사.

```ts
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: { md: '6px', pill: '12px', sm: '4px' },
      colors: {
        border: 'var(--fp-border)',
        danger: 'var(--fp-danger)',
        muted: 'var(--fp-muted)',
        primary: { DEFAULT: 'var(--fp-primary)', dark: 'var(--fp-primary-dark)' },
        surface: 'var(--fp-surface)',
      },
      fontFamily: { sans: ['Noto Sans KR', 'sans-serif'] },
      fontSize: {
        body: ['13px', '1.45'],
        caption: ['11px', '1.4'],
        helper: ['12px', '1.45'],
        title: ['15px', '1.35'],
      },
      spacing: { compact: '6px' },
    },
  },
}
```

### 3.2 색 토큰 상태 (DL-003 그대로)

운영관리앱의 `--fp-*` CSS 변수는 `tailwind.config.ts`에 선언만 되어 있고 어디에도 정의되어 있지 않음. 실제 스타일은 §3.3의 클래스 상수 사용. recipesss도 동일.

### 3.3 실제 사용 중인 클래스 상수 (운영관리앱 `lib/ui.ts`)

`src/lib/ui.ts`로 완전 복제. 단계 0 이후 자유롭게 확장 가능.

| 상수 | 값 | 용도 |
|---|---|---|
| `PRIMARY_BTN_CLS` | `rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50` | 주 액션 |
| `PRIMARY_BTN_SM_CLS` | `rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50` | 작은 주 |
| `SECONDARY_BTN_CLS` | `rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50` | 보조 |
| `INPUT_CLS` | `w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none` | 입력 |
| `CELL_INPUT_CLS` | `w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none` | 표 셀 |
| `INLINE_LINK_CLS` | `text-xs text-blue-600 hover:underline` | 인라인 링크 |
| `INLINE_DANGER_CLS` | `text-xs text-red-400 hover:underline` | 인라인 위험 |
| `CARD_CLS` | `overflow-hidden rounded-lg bg-white shadow-sm` | 카드 |
| `EMPTY_STATE_CLS` | `rounded-lg bg-white p-10 text-center text-sm text-gray-400 shadow-sm` | 빈 상태 |

### 3.4 shadcn 컴포넌트 채택 목록

운영관리앱의 `src/components/ui/` 10개 전부 mirror (변형/props 시그니처 동일):
- `Button` (primary/outline/ghost/danger)
- `Card`, `CardHeader`, `CardContent`
- `Input`, `Textarea`
- `Select`
- `Checkbox`
- `DialogPanel`
- `Badge` (muted/success/danger)
- `Table`
- `Tabs`

### 3.5 레이아웃 패턴

**AppLayout** (운영관리앱 mirror):
- 메인 배경: `bg-gray-50`
- 사이드바: 256px(`w-56`), 흰 배경, 우측 `border-gray-200`, active = `bg-gray-800 text-white`, hover = `bg-gray-100`
- 데스크탑(`md:` 이상): 사이드바 고정 좌측, 메인 우측
- 모바일: 햄버거 헤더 + 슬라이드인 사이드바 (블랙 30% overlay)
- 메인 영역: `flex-1 overflow-auto p-4 md:p-6`
- **사이드바 푸터 (DL-015)**: 이메일 + 로그아웃 버튼만. 역할(role) 표시 없음.

**모달** (`components/common/Modal.tsx`):
- 백드롭: `fixed inset-0 z-50 bg-black/40 p-4`
- 패널: `max-w-md rounded-xl bg-white shadow-xl`
- 헤더(`border-b`) / 본문(`p-5`) / 푸터(`border-t`, 우측 정렬)

**토스트** (`components/common/Toast.tsx`):
- 위치: `fixed right-4 top-4 z-50`
- 톤: success/error/info, 자동 dismiss 3500ms

### 3.6 mirror 종료 시점 (DL-021)

단계 0 완료 시점 이후로는 운영관리앱과 **독립** 진행.
- 단계 0.5부터는 운영관리앱이 어떻게 변경되든 recipesss에 영향 없음.
- 새 shadcn 컴포넌트·새 디자인 토큰·새 레이아웃 패턴은 recipesss 자체 판단으로 추가.
- 운영관리앱 디자인 토큰을 참고만 하고 따라가지 않음.

### 3.7 표 드래그&드롭 패턴 (DL-022)

**디폴트**: 사용자가 직접 수정 가능한 모든 표는 드래그&드롭으로 행 순서 이동 가능.

대상 표:
- 신규 레시피의 원료 행 / 영양제 행
- 원료 마스터 행
- 발주 프리셋 행 (제품 그룹 내 정렬)

**라이브러리**: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/modifiers`.
- 운영관리앱은 미사용 (운영관리앱 mirror 종료 시점 이후 추가)
- 생산관리앱은 SortableJS 사용. recipesss는 React 표준인 `@dnd-kit`를 채택.

**저장**: 각 행에 `sortOrder` 필드 부여. 드롭 직후 Firestore에 batch update.

---

## 4. 도메인 모델

스키마 버전 v3. v2 → v3 마이그레이션은 §11.

### 4.1 RecipeDraft (recipesss 전용)

```ts
type RecipeDraft = {
  id: string                    // 'draft_xxxxxxxx'
  ownerUid: string              // 호두님 uid
  name: string                  // '치킨'
  species: 'cat' | 'dog' | null
  unitIngredientId: string      // 생산단위 기준 원료
  unitLabel: string             // 예: '마리'
  composition: CompositionRow[]
  standardId: string            // NutrientProfile id (기본: AAFCO_2014_CAT_ADULT 등)
  status: 'draft' | 'inactive'  // inactive = 사용 중단 (목록에서 필터)
  sortOrder: number             // 드래그&드롭 정렬
  // 영양값 (DL-027): 계산값은 자동 계산하므로 저장 X, 확정값만 저장.
  // 원료 변경 시 자동 갱신 (DL-029) — 이전 수동값은 덮어쓰임.
  declaredNutrients?: NutrientValues   // 호두님 확정값 (모든 영양소 수동 가능)
  declaredNutrientsUpdatedAt?: number  // 마지막 자동 갱신 시점 (UI에서 "최신 동기화" 표시용)
  createdAt: number
  updatedAt: number
  // 등록 후 추적용
  registeredRecipeId?: string   // recipes/{id} 로 승격된 경우 그 id
  registeredAt?: number
}

type CompositionRow = {
  ingredientId: string
  weight: number                // g 기준 항상
  unit: 'g' | 'kg'              // 표시용
  sortOrder: number             // 드래그&드롭 정렬
}
```

### 4.2 Recipe (생산관리앱 소유 `recipes/` — 등록 대상) — DL-037 개정

> ⚠️ **이전 최소 모델(species·composition·unitLabel)은 stale.** 생산앱(`fant-production`)
> 실제 스키마와 다름이 확인됨(2026-06-09, `fant-production` recipes 백업·spec v26 대조).
> `recipes/`는 **생산앱 소유**다. recipesss는 등록 시 **부분 subset만 create**하고
> 나머지 생산 전용 필드는 호두님이 생산앱에서 보완한다(DL-037).

**생산앱 실제 `recipes/{recipeId}` 스키마 (외부 계약, 참고용):**

```js
{
  name, displayName, note, color,
  target: 'cat' | 'common' | ...,        // ⚠️ species 아님. dog/null 매핑 호두님 확정 필요
  category: 'raw' | 'freezeDry' | ...,   // recipesss엔 개념 없음 → 기본값/보완 필요
  active: boolean,                        // 등록 직후 false (생산앱에서 활성화)
  version: number,
  sortOrder: number,
  ingredients: [{
    id, name,
    baseWeightG: number,                 // ⚠️ weight 아님
    unitName: 'g' | 'kg',                // ⚠️ unit 아님
    isProductionUnit: boolean,           // 생산단위 원료 표시 (recipesss unitIngredientId)
    sortOrder: number,
    autoDeductInventory: boolean,        // 기본 false
    linkedToInventory: boolean,          // 기본 false
    meatTypeId?: string,                 // 생산 재고 연결 — recipesss 모름 (생략)
  }],
  unitPresets: number[],                 // 보통 []
  bagTypeId?, packWeightG?,              // 생산 전용 — recipesss 생략, 보완
  productionMethods?: [...],             // 생식 환산 — 생산 전용 (DL: spec v26)
  freezeDryBagCountPerUnit?, breadPanCountPerUnit?,
  freezePanCountPerUnit?, requiresSeparation?,  // freezeDry 전용
  createdAt: Timestamp, updatedAt: Timestamp,   // ⚠️ Firestore Timestamp (number 아님)
  createdBy: string, updatedBy?: string,
  // recipesss 추적 필드 (생산앱은 무시, recipesss 식별용):
  source?: 'recipesss' | 'production-app',
  recipesssDraftId?: string,
}
// 서브컬렉션: recipes/{id}/conversionHistory/{historyId} (생산앱 전용)
```

**recipesss → recipes 매핑 + 등록 쓰기 계약은 §6.6** 참조 (영양제 제외, `active:false`,
create-only, 추적 필드 포함, 재푸시 deferred).

### 4.3 Ingredient

```ts
type Ingredient = {
  id: string                    // 'ing_xxxxxxxx'
  name: string                  // '닭가슴살'
  kind: 'ingredient' | 'supplement'
  displayName: string           // 치환명 (선택)
  aliases: string[]
  hidden: boolean
  includeInPreparation?: boolean // 명시적 계량·출력 포함 여부. 미설정이면 기존 표시 중인 영양제만 포함
  // 신규
  nutrientProfile?: NutrientValues   // 100g 당 영양값 (USDA import or 수동)
  source?: {
    type: 'usda' | 'manual'
    fdcId?: number              // USDA FoodData Central ID
    importedAt?: number
  }
  vendor?: { name: string; url?: string }
  moistureBasis?: 'as-fed' | 'dry-matter'
  sortOrder: number             // 드래그&드롭 정렬
}
```

### 4.4 NutrientValues

`Partial<Record<NutrientKey, number>>`. 단계 1-A에서 `NutrientKey` 키셋 확정 (DL-032,
FEDIAF 2025 기준). 5범주 ~45키: 일반성분(`crudeProtein` `crudeFat` `crudeFiber`
`ash` `moisture` `nfe` — fiber/ash/moisture/nfe는 ME·NFE 계산용, 표준 요구량엔 없음),
아미노산(`taurine` 포함 고양이), 지방산, 미네랄, 비타민. 정의: `src/types/recipe.ts`.
표시 메타(라벨·단위·범주·순서): `src/features/nutrition/nutrientKeys.ts`.

### 4.5 NutrientProfile (표준)

영양소별 min/max 표준. **다표준 동등 지원**(DL-032 — DL-005 개정). 구조:
`{ id, standard, year, species, lifeStage, label, mer?, perMe, perDm, ratios? }`
(정의 `src/types/recipe.ts`). `perMe`=per 1000 kcal ME(기본 basis), `perDm`=per 100 g DM(토글),
`ratios.caP`=Ca/P 비율. min/max는 `NutrientRequirement`(`maxType: 'legal' | 'nutritional'`).

**적재(앱 정적 번들, DL-032)**: `src/features/nutrition/profiles/*`. Firestore 미사용.
다표준 동등 적재:
- **FEDIAF 2025 7종** (`fediaf2025.ts`): 개 4종(`FEDIAF_2025_DOG_ADULT_MER95`·`_MER110`·`_EARLY_GROWTH_REPRO`·`_LATE_GROWTH`), 고양이 3종(`FEDIAF_2025_CAT_ADULT_MER75`·`_MER100`·`_GROWTH_REPRO`). per-1000kcal+per-100g-DM 둘 다 수록.
- **AAFCO 2014 4종** (`aafco.ts`, Model Bills 2015 proposed): 개·고양이 × 성장·번식/성체유지(`AAFCO_2014_DOG_GROWTH`·`_DOG_ADULT`·`_CAT_GROWTH`·`_CAT_ADULT`). 원본=BASED ON CALORIE CONTENT(per 1000kcal)→`perMe`, `perDm`=perMe×0.4(4000kcal/kg DM 가정). selenium/B9/B12/B7/K는 mg→µg 변환.
- **NRC 2006 2종** (`nrc2006.ts`): 개·고양이 성체 유지(`NRC_2006_DOG_ADULT`·`_CAT_ADULT`). RA(권장섭취량)=min, perMe만(perDm 빈 객체). 단위 명확분만 — sodium(원표 단위 오류 의심)·vitaminA/D/E/K(RE/IU/menadione 환산 애매)는 생략. 개체요구량이라 완전사료 최소(FEDIAF/AAFCO)와 의미 차이 있음(label 명시).

자료원: FEDIAF Nutritional Guidelines 2025 Table III-3a/b·III-4a/b; AAFCO Dog/Cat
Food Nutrient Profiles 2014 (DL-012 개정).

### 4.6 USDA Cache

§4.5의 이전 정의 그대로. `usdaCache/{fdcId}`.

### 4.7 Preset (현행 유지, draftId 참조)

```ts
type Preset = {
  id: string                    // 'preset_xxxxxxxx'
  draftId: string               // recipeDrafts 참조 (등록 후엔 recipes id로 변경)
  code: string                  // 예: 'A0'
  targetWeight: number          // g
  label: string
  unitIngredientId: string
  inputAmount: number
  inputUnitLabel: string
  sortOrder: number             // 드래그&드롭 정렬
  createdAt: number
}
```

### 4.8 Price (별도 인터페이스 미정 — DL-024)

데이터 위치 결정 보류. 단계 0.5 진행하면서 생산관리앱과 함께 결정.
- 메뉴 슬롯 `/prices`는 유지 (사이드바에 표시)
- 페이지 자체는 "단가 인터페이스 작업 중" placeholder로 시작
- 원료 마스터에는 단가 컬럼 **합치지 않음**

### 4.9 Firestore 컬렉션 (fant-e5ae5 — DL-017, DL-018)

```
fant-e5ae5/
├── recipeDrafts/                          ← recipesss 전용 (신규)
│   └── {uid}/
│       └── items/
│           └── {draftId}                    ← RecipeDraft
│
├── recipes/                                ← 생산관리앱 공유 (기존)
│   └── {recipeId}                           ← Recipe (등록된 것)
│       └── conversionHistory/
│           └── {historyId}
│
├── recipesssIngredients/                   ← recipesss 전용 원료 마스터
│   └── {uid}/
│       └── items/
│           └── {ingredientId}               ← Ingredient
│
│   (nutrientProfiles 컬렉션 미사용 — 표준은 앱 정적 번들, DL-032)
│
├── usdaCache/                              ← USDA 응답 캐시
│   └── {fdcId}                              ← UsdaCacheEntry
│
├── recipesssPresets/                       ← 발주 프리셋
│   └── {uid}/
│       └── items/
│           └── {presetId}                   ← Preset
│
├── recipesssSnapshots/                     ← 자동 스냅샷
│   └── {uid}/
│       └── items/
│           └── {snapshotId}
│
├── recipesssOrders/                        ← 저장된 발주 (DL-039)
│   └── {uid}/
│       └── items/
│           └── {orderId}                    ← SavedOrder { date, presetIds[], snapshot? }
│
└── (기존 운영·생산앱 컬렉션 그대로)
```

**명명 규칙**:
- recipesss 전용 컬렉션은 `recipesss*` 접두 또는 `recipeDrafts` 같은 명확한 의미.
- 공유 컬렉션 (`recipes`, `nutrientProfiles`, `usdaCache`)은 접두 없이.
- Firestore Rules는 컬렉션별 권한 명시.

**Firestore Rules 정책 (단계 0에서 PR로 제출)**:
- `recipeDrafts/{uid}/**`: 본인 read/write
- `recipes/**`: 인증 사용자 read, write는 작성자 본인만 또는 admin
- `recipesss*/{uid}/**`: 본인 read/write
- `nutrientProfiles/**`: 인증 사용자 read만
- `usdaCache/**`: 인증 사용자 read/write

---

## 5. 화면 명세

### 5.1 사이드바 메뉴 트리 (DL-041 — 2026-09-09 사용자 승인)

현재 기본 화면은 `/orders` **영양제 준비·출력**이다. 메인 메뉴는 이 화면과
`/history` **준비 내역**, `/recipes` **레시피 관리**, `/ingredients` **원료·영양제 관리**의
네 항목이다. 신규 레시피·레시피 비교는 레시피 관리에서 접근한다. 단가·백업복원 메뉴는
제거하고 구 `/prices`, `/settings` 주소는 준비 화면으로 이동한다. 아래 트리는 DL-041 이전 기록이다.

```
(/ = /recipes 리다이렉트 — 대시보드 메뉴 제거, 2026-06-12)

레시피
├─ 신규 레시피 (/recipes/new)            ← 단일 화면 메인
└─ 레시피 목록 (/recipes)                ← 상태 필터 (활성/임시/비활성)
                                            행 클릭 → 레시피 상세 (/recipes/:draftId)
                                            영양제 제외 후 생산관리앱 푸시(등록)

원료
└─ 원료 마스터 (/ingredients)           ← USDA 검색은 모달로 내장

발주
├─ 발주 (/orders)                        ← 정의된 프리셋 선택·수량 입력
└─ PDF 출력 (/print?presets=...)         ← 출력 1·2 두 버전 (DL-038)

  ※ 프리셋 설정은 별도 페이지가 아니라 레시피 상세(/recipes/:draftId)에 통합 (DL-035).
    구 /presets 페이지·메뉴 제거.

원가
└─ 단가 관리 (/prices)                   ← 인터페이스 미정 placeholder

설정
└─ 백업·복원 (/settings)
```

### 5.2 신규 레시피 (`/recipes/new`, `/recipes/draft/:draftId` 편집)

**메인 화면. 영양 매트릭스 + 레시피 작성 + 원가 계산을 한 화면에 통합.**

레이아웃:
```
[상단] 레시피명·종 선택·생산 단위 입력
[중단 좌] 원료 행 표 (드래그&드롭, +원료 추가 버튼)
         영양제 행 표 (드래그&드롭, +영양제 추가 버튼)
[중단 우] 영양 매트릭스 (자견·성견·자묘·성묘 × 영양소)
         각 영양소 행에 [계산값] [확정값(편집)] [표준 min~max] [상태] 컬럼 (DL-027)
         부족·초과 색상 표시 (확정값 기준 — DL-028)
[하단]   Ca:P 비율 카드 · 종합 판정 배지 · 원가 합계
[액션]   임시저장 (recipeDrafts 갱신) · 등록 (recipes로 승격, 영양제 제외)
```

**원료 추가 흐름**:
- 표 행 `+ 원료 추가` 클릭 → 검색 모달 → 원료 마스터 후보 리스트 + "USDA에서 가져오기" + "수동으로 추가" 버튼
- 선택 시 행 추가. 중량 입력. 즉시 매트릭스 갱신.

**영양값 계산값 + 확정값 (DL-027, DL-028, DL-029)**:
- 각 영양소 행에 두 칸: 계산값(자동), 확정값(편집 가능).
- 초기·자동 갱신: 확정값 = 계산값 그대로.
- 호두님이 확정값 칸 직접 입력 가능 (전 영양소).
- 부족분·종합 판정은 **확정값 기준** (없으면 계산값).
- **⚠️ 원료 변경 시**: 계산값 갱신 → 확정값도 새 계산값으로 자동 덮어쓰기. 이전 수동 수정값은 사라짐.
- UI에 명시: "원료 수정 시 확정값이 새 계산값으로 갱신됩니다. 보장 분석 등 라벨링 직전 단계에 사용하세요."

**임시저장**:
- 자동 저장 (3초 디바운스) + 명시적 "임시저장" 버튼
- `recipeDrafts/{uid}/items/{draftId}` 갱신

**등록 (DL-025)**:
- "이 레시피 등록" 버튼 → 확인 모달 → 변환 함수 실행 → `recipes/{recipeId}` 생성
- 변환 시 영양제 행 자동 제외, 필드 정규화(`name`/`species`/`composition`/`unitLabel`만 push)
- **확정값은 푸시에 포함 X** (recipesss 내부 metadata + PDF 출력용)
- 등록 후 드래프트에 `registeredRecipeId`·`registeredAt` 기록 (드래프트는 남김; 수정용)

### 5.3 레시피 목록 (`/recipes`)

- **DL-042 (2026-09-09)**: 레시피 상태 개념을 제거한다. 목록·상세에서 임시/비활성 선택·표시를 없애고, 기존 비활성 데이터도 준비·출력·비교에 포함한다. 이전 `status` 필드는 호환 목적으로 읽을 수 있지만 동작에는 사용하지 않으며 신규 레시피에는 기록하지 않는다.
- 상단 필터: 종, 카테고리, 검색
- 좌측 사이드: 종별 그룹 카운트
- 메인: 카드 또는 표 (드래그&드롭 정렬)
- 액션:
  - 행 클릭 → 신규 레시피 편집 화면
  - "생산관리로 푸시" 일괄 액션 (체크박스 다중 선택 → 푸시) — DL-025 변환 함수 적용
  - 복제 (현 `복사` 기능 그대로)
  - 목록 및 상세의 레시피 삭제 → 대상 이름과 전체 원료 구성·영양제·프리셋 삭제를 알리는 모달 → 취소 또는 전체 삭제.
  - 레시피 문서와 연결 프리셋은 한 배치로 삭제한다. 실패 시 모달에서 오류를 알리고 유지한다. 원료·영양제 마스터, 준비 내역 스냅샷, 생산관리앱 공유 `recipes`는 삭제하지 않는다. 과거 ID-only 준비 내역의 재출력 제한은 DL-041을 따른다.

### 5.4 원료 마스터 + USDA 검색 (`/ingredients`) — DL-030

- **DL-043 (2026-09-09)**: 원료·영양제 구분과 별도로 `계량·출력에 포함`을 저장한다. 상세의 체크박스·직원용 치환명·출력 설정 저장으로 설정하며, 해당 원료를 쓰는 모든 레시피에 적용한다. 이 저장은 본인 원료 문서의 `includeInPreparation`과 `displayName`만 수정한다. 기존 구분, 숨김, 영양값, 배합, 프리셋, 공유 `recipes`는 변경하지 않는다. 미설정 데이터는 기존 `kind === supplement && !hidden` 규칙을 유지하고, 명시적으로 선택하면 구분·숨김과 독립적으로 포함/제외한다.

- 원료 리스트 (kind 그룹: 원료/영양제) — 드래그&드롭 정렬
- 구성 편집에서 현재 목록에 없는 원료는 다른 원료명으로 대체 표시하지 않고 연결 누락으로 표시한다. 누락 상태의 구성 저장은 막는다. 해당 행에서 원료 목록을 다시 불러와 오래된 목록을 갱신할 수 있으며, 작성 중인 배합량과 원료 ID는 유지한다. 새로고침 자체는 데이터를 저장하거나 변경하지 않는다.
- 원료 클릭 → 상세 패널: 이름·치환명·alias·**nutrientProfile 표시·편집**·공급사
- 단가 컬럼은 없음 (DL-024)
- **추가 흐름 3가지**:
  1. **USDA에서 가져오기** (버튼 → 모달):
     - 검색어 입력 → FDC API → 후보 5~10개
     - 후보 클릭 → 영양값 미리보기 → "이 원료에 적용" 또는 "신규 원료로 추가"
     - 결측 영양소는 표시 (수동 입력 가능)
  2. **수동 원료 추가** (버튼):
     - kind 선택 (원료/영양제), 이름·치환명 입력
     - **영양값 직접 입력 폼** (모든 영양소). 빈칸은 `null`로 저장.
     - 공급사 정보 (선택)
     - 영양제도 동일 UI — 영양제가 추가하는 영양소(예: 비타민E 영양제 → vit_e 값) 직접 입력
  3. **기존 원료 편집** — 영양값 행 클릭하면 수정 가능 (USDA에서 가져온 값도 사용자 수정 가능)
- 별도 `/ingredients/usda` 페이지 없음. 모두 원료 마스터 안에서 처리.

### 5.5 프리셋 설정 — 레시피 상세 (`/recipes/:draftId`) — DL-035 (DL-026 개정)

**DL-041 개정**: 주 입력 위치는 `/orders`의 각 제품 옆 **프리셋 추가**이다.
레시피에 설정한 기준 원료로 값을 입력하고 서버 저장한다. 기준 원료 변경·기존 프리셋 편집은
레시피 관리에서 유지한다. 사용자 용어는 **프리셋 값**으로 통일한다. 자동 환산과 크기순 코드 규칙은 유지한다.

별도 페이지가 아니라 **레시피 상세 화면에 통합**. `/recipes` 목록에서 레시피 클릭 →
상세 화면. v2 "결과 탭" 방식. (구 `/presets` 페이지·메뉴 제거.)

이번 범위(②, 최소): 레시피 헤더 read + 프리셋 설정 패널. **영양 매트릭스·구성원료
계산표·원가는 1-D**에서 같은 화면에 얹는다.

**프리셋 정의 방식 (v2 회귀)**: 코드·목표량 직접 입력 ❌. 대신:
- **생산단위 원료 select** (기본값 = `draft.unitIngredientId`, 변경 가능 — 프리셋별
  `Preset.unitIngredientId`에 저장)
- **생산량 입력** (`Preset.inputAmount`)
- → `targetWeight`·`ratio`·`inputUnitLabel`은 **자동 도출** (§6.7 생산량 환산).
- → 저장된 프리셋은 칩(20·40·60…)으로 표시.

**자동 코드 (DL-035)**: 한 레시피 안에서 `targetWeight` **오름차순으로 X0·X1·X2…**
(`prefix` = 레시피별 1글자, suffix = 크기 순위). 코드 suffix·표시 순서 둘 다
targetWeight 순으로 **고정** — 프리셋 드래그 수동 정렬은 **없음**(0.5-G는 프리셋엔
미적용). 저장/삭제마다 해당 draft의 프리셋을 일괄 재코딩(`normalizePresetCodes`).

- 기존 마이그레이션 프리셋(약 100개)도 첫 저장 시 자동 재코딩됨.
- 프리셋이 정의돼 있어야 §5.6 발주에서 선택 가능.

### 5.6 발주 (`/orders`) — DL-026, 간결 표시

**DL-041 대체**: 화면 이름은 **영양제 준비·출력**. 검색·종/동결 필터, 제품별 프리셋 체크,
제품 전체/표시 목록 전체 선택, 실제명·치환명·중량 펼쳐보기를 제공한다. 프리셋이 없는 제품도
표시해 즉시 추가할 수 있다. 동결건조 필터는 등록 카테고리(동결텐더 포함)를 우선하고 미분류만 이름으로 보완한다.
고양이·강아지 필터에서는 이 기준으로 판별한 동결건조 제품을 제외해 분류 탭 간 중복 표시를 막는다. 제품의 종 정보와 선택된 프리셋은 유지하며, 필터를 해제한 전체 목록에서는 모든 제품을 보여준다.
분류가 설정되지 않은 제품은 종만 표시하며 ‘미분류’ 문구는 노출하지 않는다.
분류 토글은 고양이·강아지·동결건조 세 개만 표시한다. 처음에는 전체 목록을 보여주며, 선택한 분류를 다시 누르면 필터를 해제한다.
선택 개수 아래에 선택된 제품명·프리셋 값과 단위·종을 텍스트로 표시한다. 검색·분류와 관계없이 선택 전체를 보여주며, 여러 줄로 줄바꿈하고 선택 해제 시 갱신한다.
**준비 목록 저장** 또는 두 A4 출력 버튼은 `recipesssOrders/{uid}/items/{id}`에 저장 성공한 뒤 진행한다.
새 내역은 `snapshot.version=1`, 프리셋별 당시 제품명·코드·입력값·실제 영양제명·치환명·환산중량과
두 출력 양식 결과를 저장한다. 같은 날짜·같은 내용의 저장된 선택은 양식 전환 시 중복 저장하지 않는다.
`/history`는 날짜별 내역·날짜 찾기·내용 펼치기·두 양식 재출력·확인 후 삭제를 제공한다.
ID만 있는 예전 내역은 당시 수치를 복원할 수 없음을 안내한 뒤 현재 데이터 미리보기를 선택하게 한다.
끊긴 원료·프리셋 연결, 미확인 병합·중복 코드는 저장 전에 표시한다. 치환명 없는 영양제는 직원용에서
조용히 빠지지 않도록 설정 안내 후 직원용 출력을 막는다. 이 검사와 계량 미리보기는 DL-043의 포함 재료 전체에 적용한다. 계산식은 유지한다.

정의된 프리셋을 선택해 이번 회차 주문량 입력.

- 표시 양식: 제품 그룹별로 한 줄 한 줄 짧게
  ```
  (고양이)치킨    [☑] a0 20개   [☐] a1 40개   [☐] a2 60개
  (고양이)본치킨  [☐] b0 100g   [☑] b1 200g
  (강아지)덕      [☐] c0 1마리  [☑] c1 2마리
  ```
- 체크박스로 선택. 발주 수량 입력란은 우측 또는 행 우측.
- 출력 미리보기 → `/print?presets=<선택 프리셋 id들>` (DL-038)

### 5.7 PDF 출력 (`/print?presets=...`) — 출력 1·2 두 버전 (DL-038)

DL-041 이후 기본 주소는 `/print?order=<id>&format=owner|staff`이다. 새 내역 재출력은
원본 레시피·프리셋의 현재 값이나 존재 여부에 의존하지 않는다. 구 `presets` 링크도 현재 데이터 미리보기로 호환한다.

`@react-pdf/renderer` 사용. A4 portrait.

**출력 1**: 현 recipesss "출력 1" 양식 (난각분만 표). 프리셋 코드 헤더 옆에
생산단위 투입량(`preset.inputAmount`)을 괄호로 표시 — 예: `P2 (3)`. 투입량이
없는 프리셋은 괄호 생략. (2026-06-04 호두님 요청; v2 `ui-tab-preview.js`
`formatUnitInput`와 동일 규칙)
**출력 2**: 현 recipesss "출력 2" 양식 (영양제 그룹별 표)

**DL-043 개정**: 신규 대표용 출력은 제품·프리셋별 포함 재료 전체를 실제 이름과 환산 중량으로 표시한다. 직원용은 기존 난각분·치환명 표 구조를 유지하고 포함된 일반 원료도 동일하게 담는다. 신규 `snapshot.outputOne[].rows`에 실제명과 열별 중량을 함께 저장한다. `rows`가 없는 과거 스냅샷은 저장 당시 난각분 표로 그대로 출력한다. 대표용은 최대 8개 프리셋 열·16개 재료 행으로 나눠 A4 대량 출력을 유지한다.

두 버전 모두 폰트 Noto Sans KR Regular/Bold 임베드.

### 5.8 단가 관리 (`/prices`)

DL-041: 사용자 요청으로 메뉴 제거. 구 주소는 `/orders`로 이동한다.

플레이스홀더 페이지. "생산관리앱과 통합 작업 중" 안내. 인터페이스 결정 후 구현.

### 5.9 백업·복원 (`/settings`)

DL-041: 사용자 요청으로 메뉴 제거. 구 주소는 `/orders`로 이동한다. 보관된 백업 데이터는 유지한다.

- 현재 상태 JSON export (recipeDrafts + 원료 + 프리셋)
- JSON 업로드 → 마이그레이션 + 적용
- 자동 스냅샷 목록 (recipesssSnapshots/) → 시점 복원

---

## 6. 계산 엔진

**원칙**: 모든 계산은 순수 함수. 외부 의존 0. UI는 절대 계산 안 함. Vitest 30+ 케이스 강제.

### 6.1 ME (수정 Atwater) — DL-007

```ts
function meKcalPer100g(values: NutrientValues): number {
  const p = values.crudeProtein ?? 0
  const f = values.crudeFat ?? 0
  const nfe = nfeGPer100g(values)
  return 3.5 * p + 8.5 * f + 3.5 * nfe
}
```

### 6.2 NFE

```ts
function nfeGPer100g(values: NutrientValues): number {
  const dm = 100 - (values.moisture ?? 0)
  const known = (values.crudeProtein ?? 0) + (values.crudeFat ?? 0) +
                (values.crudeFiber ?? 0) + (values.ash ?? 0)
  return Math.max(0, dm - known)
}
```

### 6.3 환산

```ts
function sumRecipeNutrients(draft: RecipeDraft, ingredients: IngredientMap): NutrientValues
function totalWeightG(draft: RecipeDraft): number
function per1000kcalME(values: NutrientValues, totalMe: number): NutrientValues
function perKgDryMatter(values: NutrientValues, totalDm: number): NutrientValues
```

### 6.4 부족분 판정

```ts
type AdequacyResult = {
  nutrient: NutrientKey
  actual: number
  min?: number
  max?: number
  status: 'ok' | 'deficient' | 'excess'
  deficit?: number
  excess?: number
}

function evaluateDraft(
  draft: RecipeDraft,
  ingredients: IngredientMap,
  profile: NutrientProfile,
  basis: 'per_1000_kcal_ME' | 'dry_matter'
): AdequacyResult[]

function evaluateRatios(
  draft: RecipeDraft,
  ingredients: IngredientMap,
  profile: NutrientProfile
): RatioResult[]
```

### 6.5 영양값 계산값 ↔ 확정값 동기화 (DL-027, DL-028, DL-029)

```ts
// 계산값을 확정값에 자동 복사. composition 변경 시마다 호출.
function syncDeclaredFromCalculated(
  draft: RecipeDraft,
  ingredients: IngredientMap
): RecipeDraft {
  const calculated = sumRecipeNutrients(draft, ingredients)
  return {
    ...draft,
    declaredNutrients: calculated,
    declaredNutrientsUpdatedAt: Date.now()
  }
}

// 부족분 판정 시 사용할 값 선택 (확정값 우선)
function effectiveNutrient(
  draft: RecipeDraft,
  ingredients: IngredientMap,
  key: NutrientKey
): number | undefined {
  const declared = draft.declaredNutrients?.[key]
  if (declared !== undefined && declared !== null) return declared
  return sumRecipeNutrients(draft, ingredients)[key]
}

// evaluateDraft 안에서 effectiveNutrient 호출
```

### 6.6 등록 = draft → 생산앱 recipes 매핑 (DL-025·DL-037)

> ⚠️ 이전 `draftToRecipe`(species/composition/unitLabel)는 **stale** — 생산앱 실스키마
> (§4.2)와 불일치. 아래가 정합 매핑. **영양제 제외, `active:false`로 부분 create**,
> 나머지 생산 전용 필드는 호두님이 생산앱에서 보완.

**매핑표 (recipesss draft → recipes 문서):**

| recipes 필드 | recipesss 소스 | 비고 |
|---|---|---|
| `name`, `displayName` | `draft.name` | |
| `target` | `draft.species` 매핑 | **호두님 확정 필요**: cat→'cat', dog→?, null→'common'(?) |
| `category` | `draft.category` (생식/동결건조/동결텐더) 매핑 | 생식·미분류→`'raw'`, 동결건조·동결텐더→`'freezeDry'` (best-effort, 생산앱 보완). recipesss `RecipeCategory`는 §4.1 |
| `active` | — | **항상 `false`** (생산앱에서 활성화) |
| `version` | — | `1` |
| `sortOrder` | — | `0` (생산앱 재정렬) |
| `ingredients[]` | `composition` 중 **kind==='ingredient'** (영양제 제외) | `{ id: ingredientId, name: ingredient.name, baseWeightG: weight, unitName: unit, isProductionUnit: ingredientId===draft.unitIngredientId, sortOrder, autoDeductInventory:false, linkedToInventory:false }`. `meatTypeId` 생략. |
| `unitPresets` | — | `[]` (또는 추후 프리셋 targetWeight 매핑 — 이번 제외) |
| `createdAt`/`updatedAt` | — | `serverTimestamp()` (Firestore Timestamp) |
| `createdBy` | `ownerUid` | |
| `source` | — | `'recipesss'` (추적) |
| `recipesssDraftId` | `draft.id` | (추적) |
| `bagTypeId`,`packWeightG`,`color`,`note`,`productionMethods`,freezeDry 필드 | — | **생략** → 생산앱에서 호두님 보완 |

**등록 쓰기 계약:**
- `recipes/{recipeId}`에 **create만** (recipesss가 만들지 않은 문서는 절대 update/delete 안 함).
- 성공 시 draft에 `registeredRecipeId`·`registeredAt` 기록.
- **재푸시 deferred** (이미 등록된 draft 재수정 시 자동 반영 X — 모달 안내, DL-025).
- 권한: §7.1/DL-037 — 호두님 토큰에 production writer 없으면 `recipes`에 recipesss-create 전용 최소 규칙 추가.

### 6.7 프리셋 생산량 환산 (v2 `getRatioInfo` 포팅) — DL-035

프리셋은 `unitIngredientId`(생산단위 원료) + `inputAmount`(생산량)만 입력받고,
`targetWeight`·`ratio`·`inputUnitLabel`을 도출한다. 순수함수(Firebase·React 없음).

```ts
type RatioInfo = {
  ratio: number          // 모든 원료 weight × ratio
  targetWeight: number   // g
  inputUnitLabel: string // 입력 단위 표시('마리'/'개'/'g'/'kg')
  hasInput: boolean
}

function getPresetRatioInfo(
  draft: RecipeDraft,
  unitIngredientId: string,
  inputAmount: number,
): RatioInfo
```

규칙 (v2 `selectors.js` `getRatioInfo` L90-110 동치):
- `unitRow = draft.composition.find(r => r.ingredientId === unitIngredientId)`.
  없거나 `weight<=0`이면 `{ ratio:1, targetWeight:0, hasInput:false }`.
- `unitLabel = (draft.unitIngredientId === unitIngredientId) ? draft.unitLabel.trim() : ''`
  (레시피 단위원료와 같을 때만 '마리'/'개' 단위).
- `raw = inputAmount` (≤0이면 `hasInput:false`, `inputUnitLabel = unitLabel || unitRow.unit || 'g'`).
- `targetWeight = unitLabel ? raw * unitRow.weight`
  `             : unitRow.unit === 'kg' ? raw*1000 : raw`
- `ratio = targetWeight / unitRow.weight`.
- `inputUnitLabel = unitLabel || unitRow.unit || 'g'`.

저장 시 `Preset.targetWeight = targetWeight`, `Preset.inputAmount = raw`,
`Preset.inputUnitLabel = inputUnitLabel`, `Preset.unitIngredientId = unitIngredientId`.

**자동 코드 재할당** `normalizePresetCodes(presets, draftId)` (v2 `preset-codes.js`
`computeNormalizedPresets`의 단일 draft 버전): 해당 draft의 프리셋을 `targetWeight`
오름차순 정렬 → suffix 0,1,2… 재할당, `sortOrder`도 같은 순위로 설정. prefix는
`pickPrefix`(기존 0.5-F) 결과 1글자. 저장/삭제 mutation에서 호출해 batch write.

---

## 7. 외부 통합

### 7.1 Firebase (DL-017: fant-e5ae5)

- **Auth**: fant-e5ae5의 Google OAuth (운영관리앱·생산관리앱과 공유). 호두님은 같은 Google 계정으로 인증.
- **Firestore**: §4.9 컬렉션. **규칙 정본 = 재고관리 repo(fantapet-inventory) `firestore.rules.draft`, 배포도 재고관리 한 곳에서만 (DL-040, 5앱 공유).** recipesss는 규칙 배포 ❌(`firebase.json`에 firestore 타깃 없음). recipesss `firestore.rules`는 **참고용 사본** — 새 컬렉션/권한 필요 시 이 파일에 반영 후 **재고관리에 전달해 정본에 합쳐 1회 배포**. 라이브 확인 = Firebase 콘솔 규칙 탭.
- **Functions**: MVP에서 사용 안 함.
- **Storage**: 미사용.
- **Hosting**: §10 — `hosting:recipesss` 타겟 (운영·생산앱 옆 세 번째 사이트).

### 7.2 USDA FoodData Central

- 베이스: `https://api.nal.usda.gov/fdc/v1`
- 인증: API key (`VITE_USDA_API_KEY`)
- 검색: `GET /foods/search?query=...&pageSize=10`
- 상세: `GET /food/{fdcId}?nutrients=...`
- 매핑 테이블: FDC nutrient ID → recipesss NutrientKey (`src/features/usda/fdcNutrientMap.ts`)
- 캐시: `usdaCache/{fdcId}` Firestore 컬렉션 (동일 fdcId 재호출 안 함)
- 결측 처리: 매핑 후 값 없는 영양소는 `null` → UI 노란 경고 + 수동 입력 가능

### 7.3 PDF (@react-pdf/renderer — DL-004)

- 폰트: Noto Sans KR Regular + Bold (`public/fonts/`)
- 컴포넌트: `src/features/print/OrderPdf.tsx` (OrderPdf1·OrderPdf2), 데이터 = `printSelectors.ts` (순수, v2 ui-tab-preview 포팅)
- 호출: `pdf(<RecipePdf1 .../>).toBlob()` → 다운로드 트리거

### 7.4 생산관리앱 푸시 (DL-025)

**메커니즘**: 같은 fant-e5ae5 Firebase 프로젝트 내 다른 컬렉션 쓰기. Firestore 직접 write.

**푸시 페이로드** (DL-025, DL-029):
- ✅ 포함: `name`, `species`, `composition`(원료만, 영양제 제외), `unitLabel`
- ❌ 미포함: `declaredNutrients` (확정값), `standardId`, recipesss 내부 metadata

**액션 흐름**:
```
1. 사용자가 레시피 목록에서 1개 이상 선택 → "생산관리로 푸시" 클릭
2. 확인 모달: "N개 레시피를 생산관리앱에 등록합니다. 영양제는 자동 제외됩니다."
3. 각 드래프트에 draftToRecipe() 적용 → recipes/{newId} 신규 생성
4. 드래프트에 registeredRecipeId·registeredAt 기록
5. 토스트: "N개 등록 완료. 생산관리앱에서 확인 가능."
```

**중복 방지**:
- 이미 등록된 드래프트(`registeredRecipeId` 존재)는 "이미 등록됨" 표시
- 재등록 옵션 (덮어쓰기 또는 새 ID 부여) 후속 PR

**롤백**:
- 등록 직후 N초 안에 "취소" 가능 (Toast 안에 취소 버튼) — 후속 PR
- 그 후엔 생산관리앱 측에서 삭제 요청

**권한**:
- recipes 컬렉션 write는 작성자 본인만 (Firestore Rules)
- recipesss·생산관리앱·운영관리앱 모두 fant-e5ae5의 같은 Auth 사용

---

## 8. 데이터 흐름·상태관리

### 8.1 Zustand store 분할

| Store | 책임 |
|---|---|
| `authStore` | 현재 사용자, fant-e5ae5 인증 상태 |
| `appStore` | UI 전역 상태 (사이드바 open) |
| `draftEditorStore` | 활성 드래프트 편집 상태 (미저장 변경 추적) |
| `toastStore` | 토스트 큐 |

### 8.2 TanStack Query 키 정책

```ts
// 1인 사용(DL-015) — 키에 uid 미포함. 현재 로그인 컨텍스트가 곧 호두님.
// (다중 사용자 전환 시 키에 uid 추가 + 재로그인 invalidate 필요)
['recipeDrafts']                       // 호두님 드래프트 전체
['recipeDraft', draftId]
['recipes']                            // 등록된 레시피 (공유)
['recipe', recipeId]
['recipesssIngredients']               // 원료 마스터
['ingredient', ingredientId]
['nutrientProfiles']                   // (staleTime: Infinity)
['nutrientProfile', profileId]
['usdaSearch', query]                  // (staleTime: 5분)
['usdaFood', fdcId]                    // (staleTime: Infinity)
['recipesssPresets']
['recipesssSnapshots']
```

캐시 무효화: mutation 후 관련 키 invalidate. 실시간 동기화는 `onSnapshot` + `queryClient.setQueryData`.

### 8.3 폼 검증 (Zod)

모든 폼은 Zod 스키마 정의 → React Hook Form `zodResolver` 연결.

```ts
const RecipeDraftSchema = z.object({
  name: z.string().min(1, '이름 필수'),
  species: z.enum(['cat', 'dog']).nullable(),
  composition: z.array(CompositionRowSchema).min(1),
  standardId: z.string().min(1),
})
```

---

## 9. 테스트 전략

### 9.1 단위 테스트 (Vitest) — 필수

대상:
- `src/features/nutrition/*` — 최소 30 케이스
- `src/features/recipes/draftToRecipe.ts` — 변환 함수 (영양제 제외 검증) — 최소 10 케이스
- `src/features/usda/fdcNutrientMap.ts`
- 모든 Zod 스키마
- `src/lib/utils.ts`

명령: `npm run test`

### 9.2 컴포넌트 테스트 (Testing Library) — 선택적

대상: 영양 매트릭스 셀 색상 분기, 푸시 액션 모달 등 시각·상호작용 로직.
페이지 전체는 테스트 안 함.

### 9.3 통합·E2E

MVP에서 미사용.

---

## 10. 운영·배포

### 10.1 환경 분리

| 환경 | URL | Firebase | 사용 |
|---|---|---|---|
| local | localhost:5173 | (emulator 또는 prod) | 개발 |
| prod | recipesss-app.web.app (또는 결정) | fant-e5ae5 | 호두님 실사용 |

### 10.2 Firebase Hosting 타겟

```jsonc
// firebase.json (recipesss 리포)
{
  "hosting": {
    "target": "recipesss",
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

`.firebaserc`에 `target` 매핑 추가:
```jsonc
{
  "projects": { "default": "fant-e5ae5" },
  "targets": {
    "fant-e5ae5": {
      "hosting": {
        "recipesss": ["recipesss-app"]   // ← Firebase Console에서 사이트 생성 후 ID
      }
    }
  }
}
```

### 10.3 푸시·머지 정책

- 브랜치: `main` 단일. PR 없이 직접 push 허용 (1인 개발).
- 커밋 메시지: 영문 imperative + Co-Authored-By.
- 각 커밋은 동작해야 함. 깨진 상태 commit 금지.
- 배포는 명시 명령: `npm run deploy`. auto-deploy 안 함.

### 10.4 버전 표기

- `package.json:version` 시맨틱 버전 (MVP 시작 = 1.0.0)
- 사이드바 푸터에 `v1.0.0 · a1b2c3d` 표시 (Vite build 시 commit hash 주입)

### 10.5 GitHub Pages 비활 시점 (DL-020)

```
1. 단계 0.5 완료 — 신규 앱이 fant-e5ae5 Hosting에서 정상 동작 확인
2. 호두님이 신규 URL로 며칠 사용 후 OK
3. GitHub 리포 Settings → Pages → Source: None → 비활성화
4. 구 URL (green-cloud-workroom.github.io/recipesss/) 404
5. 아이폰 PWA 아이콘 신규 URL로 재설치
```

### 10.6 푸시 체크리스트

```
[ ] 변경 사항 의도와 SPEC 일치 확인
[ ] npm run typecheck
[ ] npm run lint
[ ] npm run test
[ ] npm run build
[ ] git commit
[ ] git push origin main
[ ] npm run deploy:hosting (의도 시)
[ ] 라이브 URL에서 동작 확인 (강력 새로고침)
```

### 10.7 롤백

```bash
git log --oneline -5
git checkout <prev-hash>
npm ci && npm run deploy
git checkout main
```

데이터는 §11.5 안전망. 스키마 변경된 경우 마이그레이션 역함수 미리 준비.

---

## 11. 마이그레이션 계획

### 11.1 v2 → v3 스키마 변환

v2 상태 (현 recipesss):
```ts
{ version: 2, products, ingredients, prices, presets, productOrder, orderQuantities, ui, ... }
```

v3 상태 (신규):
```ts
{
  version: 3,
  recipeDrafts: products → recipeDrafts 변환 (모두 status: 'draft'),
  ingredients: 그대로 + nutrientProfile 빈 객체로 초기화 + sortOrder 부여,
  presets: 그대로 + sortOrder 부여,
  prices: 별도 처리 (DL-024)
}
```

변환 함수 `migrateV2toV3(state)`. 순수 함수 + Vitest.

### 11.2 데이터 이전 (backups JSON → fant-e5ae5) — DL-031

작업 #14 참조. **실행 = 앱 내 1회성 UI** (`/settings`), Node 스크립트 아님 (DL-031).

**절차**:
```
1. /settings 에서 backups/*.json (v2 백업 다운로드 산출물) 업로드
2. migrateV2toV3(state, { ownerUid: 현재 로그인 uid, now: Date.now() }) 적용
3. dry-run 미리보기: 변환 결과 개수·샘플을 화면에 표시 (write 전)
4. 호두님이 "쓰기" 확인 → fant-e5ae5 의 다음 컬렉션에 batch write:
   - recipeDrafts/{uid}/items/{draftId}
   - recipesssIngredients/{uid}/items/{ingredientId}
   - recipesssPresets/{uid}/items/{presetId}
   - (prices 는 DL-024 인터페이스 미정 → 이번 이전 대상에서 제외, 보류)
5. write 후 검증: 쓰인 문서 수가 변환 결과 수와 일치하는지 화면에 표시
   - 레시피(드래프트) 수 / 원료 수 / 프리셋 수
```

**소스 = `backups/2026-06-03-pre-rewrite.json`** (DL-031). 구 recipesss Firebase 라이브
읽기는 폐기 — recipesss는 client SDK만 보유하고 구 프로젝트 credential 도 없으며, 구
Firebase 는 읽기전용(DL-019)이라 스냅샷 이후 변경분이 없다는 전제. 변환 함수
`migrateV2toV3` 는 이 백업을 픽스처로 회귀 검증됨 (`src/features/migration/`).

### 11.3 폴더 이동 (OneDrive → C:\dev\recipesss)

작업 #4 참조.

```
1. 현 OneDrive 폴더의 모든 변경사항 commit + push 확인
2. PowerShell: Move-Item "C:\Users\oddsk\Downloads\OneDrive\문서\recipesss" "C:\dev\recipesss"
3. Claude Code 재시작 (working dir 변경)
4. git status로 정상 인식 확인
```

**※ 생산관리앱 (`fant management/fant`)도 OneDrive에 있음**. 별도 작업으로 옮길지는 호두님 결정.

### 11.4 데이터 안전 정책 (DL-014)

3중 안전망:
1. **브라우저 localStorage** — 호두님 기기 (오프라인 동작)
2. **Firebase Firestore** — 클라우드 (구 recipesss + fant-e5ae5 양쪽 다)
3. **리포 `backups/` 디렉토리** — 큰 작업 직전 JSON 스냅샷

**원칙**:
- 호스팅·코드 변경은 데이터에 0 영향
- 큰 작업 직전 `backups/<YYYY-MM-DD>-<사유>.json` 추가 후 commit
- 마이그레이션 함수는 순수 함수 + Vitest 회귀

### 11.5 구 recipesss Firebase 처리 (DL-019)

마이그레이션 후:
- 구 프로젝트는 **그대로 두고 읽기 전용**
- 몇 달 동안 신규 앱이 안정적인지 확인
- 완전 판단 명확하면 그 때 삭제

### 11.6 GitHub Pages 비활 절차

§10.5 참조.

---

## 12. 단계별 일정

각 단계 끝에 **배포 + 호두님 검증 + SPEC §13 결정 기록**.

### 단계 0: 인프라 (작업 #5)
- Vite/React/TS/Tailwind 골격
- shadcn 컴포넌트 10개 mirror (운영관리앱)
- `lib/ui.ts` 클래스 상수 mirror
- AppLayout + 라우터 + 사이드바 (DL-024 메뉴 트리)
- Firebase init (fant-e5ae5)
- Vitest 설정
- `@dnd-kit/*` 의존성 추가 (DL-022)
- 첫 배포 (빈 페이지 + 사이드바 동작)
- **mirror 종료 시점** (DL-021) — 이후 운영관리앱 독립 진행
- **완료 기준**: 사이드바 메뉴 클릭 시 빈 페이지 전환됨. fant-e5ae5 Hosting에 배포 완료.

### 단계 0.5: 데이터·기능 이식 (작업 #6 + #14)
- v2 → v3 마이그레이션 함수 + Vitest
- 데이터 이전 스크립트 (구 → fant-e5ae5)
- 5개 페이지 신규 디자인으로 이식: 신규 레시피·레시피 목록·원료 마스터·발주·PDF 출력
- 영양 매트릭스는 단계 1에서, 단계 0.5에선 placeholder
- 회귀 테스트: 현 앱과 동일 결과 확인
- **GitHub Pages 비활** (DL-020)
- **완료 기준**: 호두님이 현 앱 대신 신규 앱 상시 사용. 데이터 손실 0.

### 단계 1: 영양 엔진 + AAFCO (작업 #7 + #12)
- NutrientProfile 스키마 + AAFCO 2024 4종 적재
- Ingredient에 nutrientProfile 수동 입력 UI
- ME/NFE/환산/판정 함수 + 30+ 테스트
- 신규 레시피 화면에 영양 매트릭스 통합 (단계 0.5 placeholder 대체)
- **완료 기준**: 호두님 레시피 5건에 대해 매트릭스 일치 검증

### 단계 2: USDA 통합 (작업 #8)
- API 키 환경변수
- 검색 모달 (원료 마스터 내장)
- usdaCache + 결측 보완
- **완료 기준**: 신규 원료 5개 USDA import → 매트릭스 즉시 반영

### 단계 3: 푸시 + 매트릭스 보강 (작업 #9 + #13)
- 생산관리앱 recipes 스키마 정확히 파악 (작업 #13)
- draftToRecipe 변환 함수 + Vitest
- 레시피 목록에 "생산관리로 푸시" 액션
- 매트릭스 보강 (표준 토글·기준단위 토글·종합 판정 배지)
- **완료 기준**: 드래프트 1건 등록 → 생산관리앱에서 보임

### 단계 4: PDF 출력 (작업 #10)
- @react-pdf 출력 1·2 두 양식
- Noto Sans KR 임베드
- **완료 기준**: 두 양식 다운로드. 인쇄 깨짐 없음.

### 단계 5: 마무리 (작업 #11)
- 백업·복원 페이지
- 단가 인터페이스 결정 (생산관리앱과 협의)
- 자잘한 UX 다듬기

---

## 13. 결정 로그

| ID | 날짜 | 결정 | 근거 |
|---|---|---|---|
| ~~DL-001~~ | 2026-06-03 | ~~Firebase 프로젝트 = 현 recipesss 그대로~~ | **DL-017로 supersede.** |
| DL-002 | 2026-06-03 | 호스팅 = Firebase Hosting | 운영관리앱 동일 패턴, SPA rewrites 표준 지원. |
| DL-003 | 2026-06-03 | 디자인 토큰 = `--fp-*` 그대로 mirror (미정의 상태 포함) | 운영관리앱 mirror. 실제 스타일은 `lib/ui.ts`. |
| DL-004 | 2026-06-03 | PDF = `@react-pdf/renderer` | React 친화, 폰트 임베딩 표준. |
| ~~DL-005~~ | 2026-06-03 | ~~기본 표준 = AAFCO 2024~~ | **DL-032로 개정 (다표준 동등, FEDIAF 우선 적재).** |
| DL-006 | 2026-06-03 | 대상 = 자견·성견·자묘·성묘 4종 | 핸드오프 §3 그대로. 종 한정 시 열 자동 숨김. |
| DL-007 | 2026-06-03 | ME 식 = 수정 Atwater 3.5/8.5/3.5 고정 | 펫푸드 업계 표준. |
| DL-008 | 2026-06-03 | 기본 기준 단위 = per 1000 kcal ME | AAFCO 표시 관례. DM 토글. |
| DL-009 | 2026-06-03 | 승인 워크플로우·QR = MVP 제외 | 1인 사용. |
| DL-010 | 2026-06-03 | 폴더 위치 = C:\dev\recipesss | OneDrive 동기화 충돌 제거. |
| DL-011 | 2026-06-03 | 코드 리포 = github.com/green-cloud-workroom/recipesss 유지 | 기존 리모트 그대로. |
| ~~DL-012~~ | 2026-06-03 | ~~AAFCO 표준 표 = 단계 1 직전 클로드가 공식 자료로 수동 입력~~ | **DL-032로 개정 (호두님이 FEDIAF 2025 공식표 제공 → 좌표 추출 전사).** |
| DL-013 | 2026-06-03 | GitHub Pages = 완전 제거 | 혼동 소지 제거. |
| DL-014 | 2026-06-03 | 데이터 안전 정책 = localStorage·Firestore·`backups/` 3중 | 호스팅 변경과 무관 보호. |
| DL-015 | 2026-06-03 | 사이드바 푸터 = 이메일 + 로그아웃만 | 1인 사용. |
| DL-016 | 2026-06-03 | USDA API 키 = 단계 2 직전 호두님 본인 발급 | 외부 서비스 본인 책임. |
| **DL-017** | 2026-06-03 | **recipesss = fant-e5ae5 Firebase 통합 (DL-001 supersede)** | 생산관리앱 푸시·운영관리앱 mirror 모두 같은 프로젝트라 자연스러움. |
| **DL-018** | 2026-06-03 | **컬렉션 = recipeDrafts(작성·임시) + recipes(등록·생산앱 공유)** | 권한·UX 명확. 등록 = 영양제 제외 후 recipes로 승격. |
| **DL-019** | 2026-06-03 | **구 recipesss Firebase = 마이그레이션 후 읽기 전용 유지** | 안전한 롤백 안전망. 몇 달 후 판단. |
| **DL-020** | 2026-06-03 | **GitHub Pages 비활 = 단계 0.5 끝·신규 앱 정상 확인 후** | 데이터 영향 0. 신규 앱 검증 후 정리. |
| **DL-021** | 2026-06-03 | **운영관리앱 mirror 종료 = 단계 0 끝까지만** | 디자인 토큰·shadcn·레이아웃·`lib/ui.ts`까지. 이후 독립. |
| **DL-022** | 2026-06-03 | **표 드래그&드롭 디폴트 = `@dnd-kit/sortable`** | React 표준. 생산관리앱은 SortableJS이나 recipesss는 React 패턴. |
| **DL-023** | 2026-06-03 | **Claude=아키텍트, Codex=구현 협업 (fantapet CLAUDE.md 패턴 채택)** | 검증된 패턴. docs/Codex지시서_*.md로 단계별 핸드오프. |
| **DL-024** | 2026-06-03 | **메뉴 트리 재정의 (영양 매트릭스+레시피 작성 통합, /lookup 제거, /prices 별도)** | 호두님 의도 반영. 신규 레시피 = 입력·계산·등록 한 화면. |
| **DL-025** | 2026-06-03 | **푸시 = 영양제 제외 + 이름·종·composition·unitLabel만 → recipes/에 신규 생성** | 생산관리앱은 영양제 안 다룸. 최소 필드. |
| ~~DL-026~~ | 2026-06-03 | ~~발주 그룹 = 프리셋 설정(/presets)·발주·PDF 3페이지로 분리~~ | **DL-035로 개정 (프리셋 설정은 레시피 상세에 통합, /presets 제거).** |
| **DL-027** | 2026-06-03 | **영양값 = 계산값 + 확정값 이중 컬럼. 확정값 = 모든 영양소 수동 가능** | 라벨링·보장 분석 직전 수동 미세조정 필요. |
| **DL-028** | 2026-06-03 | **부족분 판정 = 확정값 우선, 없으면 계산값** | 호두님 의도가 정답값. 펫푸드 라벨링 관례. |
| **DL-029** | 2026-06-03 | **원료 변경 시 확정값 자동 갱신 (= 새 계산값으로 덮어쓰기)** | 워크플로우: 원료 셋업 끝 → 마지막 단계에서 확정값 미세조정 → 등록. UI에 명시. |
| **DL-030** | 2026-06-03 | **원료 마스터 = USDA + 수동 원료 추가 + 영양값 직접 입력 (영양제 포함)** | 영양제·특수 원료는 USDA에 없음. 수동 입력 필수. 모든 원료가 같은 nutrientProfile 필드 보유. |
| **DL-031** | 2026-06-04 | **마이그레이션 실행 = 앱 내 1회성 UI(/settings) + `backups/*.json` 소스 (구 §11.2 "Node.js 스크립트 + 구 Firebase 라이브 읽기" supersede)** | recipesss는 client SDK(`firebase`)만 보유·admin 없음. 앱 내 실행은 이미 로그인된 uid·Auth context를 그대로 써 credential 추가 0, dry-run이 화면에 보임. `backups/2026-06-03-pre-rewrite.json`은 `migrateV2toV3`로 회귀 검증됨. 단 스냅샷 이후 구 앱 변경분은 미포함(DL-019 구 Firebase 읽기전용이라 변경 없음 전제). |
| **DL-032** | 2026-06-05 | **영양 표준 = 다표준 동등 지원. FEDIAF 2025 7종 먼저 적재(개 4·고양이 3, 성체 MER 2종 포함). NutrientKey 키셋 ~45 확정. 표준 데이터 = 앱 정적 번들(`src/features/nutrition/profiles/*`, Firestore `nutrientProfiles` 미사용). ME = 수정 Atwater 유지(DL-007). DL-005·DL-012 개정** | 호두님 FEDIAF 공식표(Nutritional Guidelines 2025) 제공 → 좌표 추출로 정확 전사(DM↔ME ×2.5 교차검증). DM+per-1000kcal 두 단위 제공돼 recipesss basis 토글과 호환. 불변 표준이라 정적 번들이 단순(write·seed·규칙 불필요). Calvez 2019(NRC 2006tdf 권장)는 TDF 등 원료데이터 요구로 MVP 부적합 → 수정 Atwater 유지. 성체 MER 2종·calcium 후기성장 대형견(b)·고양이 성장/번식 보수값 등은 `fediaf2025.ts` 주석 참조. AAFCO·NRC는 동일 스키마로 자료 입수 후 추가. |
| **DL-033** | 2026-06-05 | **firestore.rules 정본 = recipesss git의 통합본(운영+생산+recipesss 3앱). 미커밋 보류(HANDOFF §3) 해제 → git 커밋. 규칙 변경은 이 파일만 수정 후 배포.** | 공유 프로젝트(fant-e5ae5)는 규칙이 1개인데 3앱이 각자 배포하며 recipesss 블록이 **반복 소실(3회 사고: 미게시→계정→재소실)**. git 정본화로 추적·복구 가능. **규칙 deploy는 access control 변경이라 호두님이 직접**(`firebase deploy --only firestore:rules`); Claude는 파일 정본만 관리. 다른 앱(생산·운영)이 규칙 배포할 때도 이 통합본을 써야 재소실 방지(호두님이 3앱 간 조율). recipesss 신규 컬렉션 규칙 추가 시 이 파일에. |
| **DL-034** | 2026-06-05 | **원료 병합 정합성: ①병합으로 동일 원료 행이 공존하면 weight 합산해 1행으로(첫 등장 위치·unit 유지). ②합산이 일어난 draft는 `mergeReviewPending=true` → 레시피 화면에서 호두님이 확인(붉은 버튼) 전까지 사용 게이트. ③`draft.unitIngredientId`·`Preset.unitIngredientId`가 삭제 대상이면 target으로 치환. ④등록된 `recipes/*`는 미수정(DL-025 단방향 유지) + 모달 경고. ⑤duplicate의 nutrientProfile/source는 삭제로 소멸 → 모달 경고.** | 기존 병합(`71d5f20`)이 composition `ingredientId`만 치환하고 `unitIngredientId`(draft·preset)·중복행을 방치 → dangling 참조 + 중복행 위험. 영양/발주 합계는 row 가산이라 보존되나 ②의 v2 ratio 계산이 `composition에서 unitIngredientId 행 찾기`로 돌아 깨짐. 합산은 사용자 의도와 일치하나 weight가 바뀌므로 자동 적용 대신 확인 게이트. 등록분·영양값 손실은 자동 처리 대신 경고로 호두님 판단에 맡김(재푸시는 DL-025대로 deferred). |
| **DL-039** | 2026-06-11 | **발주 저장/재출력: `recipesssOrders/{uid}/items/{orderId}` = `SavedOrder { date(로컬 YYYY-MM-DD), presetIds[], createdAt }`. 발주 화면에서 "오늘 날짜로 발주 저장" → 저장 목록에서 클릭 시 `/print?presets=`로 재출력, 삭제 가능. 규칙 = 본인 read/write (recipesss* 패턴).** | 재출력 요구(호두님). 프리셋 **id만 저장** — 재출력은 현재 프리셋 데이터 기준이라 이후 프리셋 수정/삭제 시 출력이 달라지거나 빠질 수 있음(스냅샷 아님, v2 동작과 동일 수준). 규칙 deploy 호두님. |
| **DL-040** | 2026-06-12 | **Firestore 규칙 정본·배포처 = 재고관리 repo(fantapet-inventory) 한 곳으로 단일화 (공식 공지). DL-033/036의 "recipesss가 정본" 가정 폐기.** 라이브 룰 = 재고관리 `firestore.rules.draft`와 전 줄 일치(5앱 규칙 포함) 확인됨. **recipesss 포함 다른 repo는 규칙 배포 금지**(`firebase.json`에서 firestore 타깃 제거 — recipesss는 이미 없음). 규칙 변경 필요 시 recipesss `firestore.rules`(참고용)에 반영 후 **그 내용을 재고관리에 전달**, 재고관리에서 1회 배포. 라이브 진실은 Firebase 콘솔 규칙 탭. | DL-036 "단일화" 방향은 맞았으나 정본 위치를 recipesss로 추정한 게 오류. 5앱이 같은 프로젝트(fant-e5ae5)·룰셋 1개라 각자 배포 시 상호 덮어쓰기 → "갑자기 접근 거부" 반복의 진짜 원인. 권한 설계 자체는 정상(앱별 분리). recipesssOrders 등 미반영 블록은 재고관리에 전달 필요. |
| **DL-038** | 2026-06-11 | **PDF 출력 라우트 = `/print?presets=<id,...>` (구 `/print/:recipeId` 대체). 출력 1·2 = v2 ui-tab-preview 충실 포팅(출력1 = 제품별 난각분 표 + 코드(투입량), 출력2 = 난각분 단독 내림차순 + 코드 prefix별 치환명 표). 데이터 = `printSelectors.ts`(순수), PDF = `OrderPdf.tsx`(@react-pdf, Noto Sans KR R/B `public/fonts/` 임베드), `/print`는 lazy 코드 스플릿.** | 발주 선택이 여러 레시피의 프리셋을 한 시트로 출력하므로 단일 recipeId 라우트가 부적합(v2 동작과 일치). @react-pdf 청크 ~1.4MB → lazy 분리로 메인 번들 영향 0. 폰트 = Google Fonts 정적 TTF 다운로드. |
| **DL-037** | 2026-06-09 | **생산앱 recipes 스키마 정합 + 등록 부분-create 계약. SPEC §4.2/§6.6 이전 모델(species·composition·unitLabel)은 stale → 생산앱 실스키마(target·category·ingredients[baseWeightG/unitName/isProductionUnit/meatType] ·active·Timestamp·productionMethods 등)로 개정. 등록 = 영양제 제외 + active:false 부분 create + source/recipesssDraftId 추적, create-only(기존 문서 미수정), 재푸시 deferred. 생산 전용 필드(category·bagTypeId·packWeightG 등)는 호두님이 생산앱에서 보완.** | 등록 구현 직전 `fant-production` recipes 백업·spec v26 대조 → SPEC Recipe 모델이 실제와 크게 다름 확인(컬렉션 오염 위험). 잘못 push 방지 위해 정합 먼저(A). target(cat/dog/null→?)·category 기본값은 호두님(생산앱 owner) 확정 필요. 권한: `recipes` write=`isProductionWriter()`라 recipesss 토큰에 production writer 없으면 막힘 → 규칙 넓히지 말고 recipes에 recipesss-create 전용 최소 규칙 추가(호두님 claims 확인 후). |
| **DL-036** | 2026-06-05 | **Firestore 규칙 배포 단일화: recipesss `firestore.rules`가 3앱 정본, 다른 repo는 규칙 배포 금지(`firebase.json`에서 firestore 타깃 제거). DL-033 잔존 리스크의 영구 해법.** | DL-033 후에도 권한 소실 재발 → 원인 확정: `fantapet-inventory/firestore.rules.draft`·`fant-inv-cutover/firestore.rules.draft`·`fant-production/firestore.rules` 3개에 recipesss 블록(recipeDrafts·recipesssIngredients·recipesssPresets, +usdaCache)이 없어, 그 repo들이 규칙 포함 배포할 때마다 recipesss가 죽음. 블록 복제 동기화(A안)는 영구적 수작업 의존이라 또 깨짐 → 다른 repo가 규칙을 **배포 못 하게** 막는 단일화(B안)가 유일한 구조적 해법. 정본 파일 상단에 배너 명시. 신규 컬렉션 규칙도 이 파일에만. deploy·3앱 firebase.json 정리는 호두님(access control). |
| **DL-035** | 2026-06-05 | **프리셋 설정 = 레시피 상세 화면(`/recipes/:draftId`)에 통합(별도 `/presets` 페이지·메뉴 제거). 프리셋 입력 = 생산단위 원료 select + 생산량 → `targetWeight`/`ratio`/`inputUnitLabel` 자동 도출(§6.7 v2 `getRatioInfo` 포팅). 자동 코드 = draft 내 `targetWeight` 오름차순 X0·X1…(`normalizePresetCodes`), 코드 suffix·표시순서 둘 다 targetWeight 순 고정 → 프리셋 드래그 정렬(0.5-G) 미적용. DL-026 개정.** | 0.5-D/E/F/G의 별도 `/presets`가 호두님 실제 워크플로우(v2 결과 탭)와 어긋나 코드·생산단위가 꼬임. v2로 회귀: 레시피 클릭 → 그 화면에서 생산량 입력 → 환산·자동코드. 코드를 크기순으로 고정하면 수동 정렬 불필요(예측가능·결정적). 이번 범위(②)는 최소 — 레시피 헤더+프리셋 패널만; 영양 매트릭스·구성표·원가는 1-D에서 같은 `/recipes/:draftId`에 추가. 마이그레이션 프리셋(~100)도 첫 저장 시 자동 재코딩. |
| **DL-041** | 2026-09-09 | **사용자 승인 시안으로 준비·출력 중심 UI 변경. 네 메뉴, 제품별 프리셋 추가·영양제 확인, 준비 목록 저장·출력 전 자동 저장, 날짜별 스냅샷 재출력.** DL-024/026/035의 메뉴·입력 위치와 DL-039의 ID-only 저장을 본문 §5에서 개정. 계산·PDF 두 양식·인증/공유 Firestore 권한은 유지. | 공동 대표의 쉬운 조회와 수십 프리셋 일괄 출력, 저장 당시 수치의 정확한 재출력 요구. 과거 ID-only 기록은 복원 가능하다고 주장하지 않고 별도 안내. |
| **DL-042** | 2026-09-09 | **레시피 임시/비활성 상태 제거. 존재하는 모든 레시피를 조회·사용하며 목록과 상세에서 전체 삭제 확인 모달을 제공한다.** 레시피와 연결 프리셋을 한 배치로 삭제하고, 마스터 원료·저장 내역·공유 생산 레시피는 유지한다. | 상태 대신 레시피 존재/삭제만으로 관리하려는 사용자 요청. 삭제 범위·취소·실패를 명확히 표시한다. |

### 결정 변경 절차
1. 변경 사유와 영향 범위를 §13 새 행으로 추가. 이전 행은 두고 ~~취소선~~ + supersede.
2. 영향 받는 §1~12 본문 수정.
3. 코드 변경 (커밋 메시지에 `Refs: DL-NNN`).

---

## 부록 A. 작업 트래킹

| # | 제목 | 의존 |
|---|---|---|
| 1 | 운영관리앱 디자인 시스템 추출 | - |
| 2 | SPEC.md 초안 작성 | #1 |
| 3 | SPEC.md 호두님 검토·수정 | #2 |
| 4 | 폴더 이동 OneDrive→C:\dev\recipesss | #3 |
| 5 | 단계 0 인프라 (Vite/React/TS/Tailwind/shadcn) | #3, #4 |
| 6 | 단계 0.5 데이터·기능 이식 | #5 |
| 7 | 단계 1 영양 엔진 + AAFCO | #6 |
| 8 | 단계 2 USDA 통합 | #7 |
| 9 | 단계 3 부족분 매트릭스 + 푸시 | #7 |
| 10 | 단계 4 PDF 출력 | #9 |
| 11 | 단계 5 마무리 | #9 |
| 12 | CLAUDE.md 작성 | #3 |
| 13 | 생산관리앱 recipes 스키마 파악 | #3 |
| 14 | 구 recipesss → fant-e5ae5 마이그레이션 스크립트 | #5 |

## 부록 B. 미해결 사항

해결 완료 → §13 결정 로그로 이관:
- ~~AAFCO 자료 입수~~ → DL-012
- ~~USDA API 키~~ → DL-016
- ~~GitHub Pages 처리~~ → DL-013, DL-020
- ~~사이드바 푸터~~ → DL-015
- ~~Firebase 프로젝트~~ → DL-017
- ~~컬렉션 구조~~ → DL-018
- ~~구 프로젝트 처리~~ → DL-019
- ~~mirror 종료 시점~~ → DL-021
- ~~표 드래그&드롭~~ → DL-022
- ~~코덱스 협업 패턴~~ → DL-023
- ~~메뉴 재정의~~ → DL-024, DL-026 (발주 분리)
- ~~푸시 인터페이스~~ → DL-025, DL-029 (확정값 미포함)
- ~~영양값 입력 패턴~~ → DL-027, DL-028, DL-029
- ~~원료 추가 흐름~~ → DL-030

남은 미해결:
- 단가 인터페이스 (DL-024 placeholder, 단계 5에서 결정)
- 생산관리앱 recipes 스키마 상세 (작업 #13에서 확정)

---

*문서 끝.*
