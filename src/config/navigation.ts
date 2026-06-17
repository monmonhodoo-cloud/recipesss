import {
  ChefHat,
  ClipboardList,
  Database,
  Gauge,
  ListChecks,
  Printer,
  Receipt,
  ShoppingCart,
  Wheat,
} from 'lucide-react'

// SPEC §5.1 (DL-024, DL-026) — 1인 사용이라 role 없음. 모든 메뉴 항상 노출.

type NavigationIcon = typeof Gauge

export type NavigationItem = {
  icon: NavigationIcon
  label: string
  path: string
}

export type NavigationGroup = {
  collapsible?: boolean
  icon: NavigationIcon
  id: string
  items: NavigationItem[]
  label: string
}

function item(
  icon: NavigationIcon,
  label: string,
  path: string,
): NavigationItem {
  return { icon, label, path }
}

export const navigationGroups: NavigationGroup[] = [
  {
    icon: ChefHat,
    id: 'recipes',
    label: '레시피',
    items: [
      item(ChefHat, '신규 레시피', '/recipes/new'),
      item(ListChecks, '레시피 목록', '/recipes'),
      item(ClipboardList, '레시피 확인', '/recipe-check'),
    ],
  },
  {
    collapsible: false,
    icon: Wheat,
    id: 'ingredients',
    label: '원료',
    items: [item(Wheat, '원료 마스터', '/ingredients')],
  },
  {
    icon: ShoppingCart,
    id: 'orders',
    label: '발주',
    items: [
      item(ShoppingCart, '발주', '/orders'),
      item(Printer, 'PDF 출력', '/print'),
    ],
  },
  {
    collapsible: false,
    icon: Receipt,
    id: 'prices',
    label: '원가',
    items: [item(Receipt, '단가 관리', '/prices')],
  },
  {
    collapsible: false,
    icon: Database,
    id: 'settings',
    label: '설정',
    items: [item(Database, '백업·복원', '/settings')],
  },
]
