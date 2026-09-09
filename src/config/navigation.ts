import { BookOpen, History, ListChecks, Pill } from 'lucide-react'

// DL-041: 준비·출력과 날짜별 내역을 앞에, 원본 편집은 관리에 둔다.
export const navigationGroups = [
  {
    id: 'prepare',
    label: '',
    items: [
      { icon: ListChecks, label: '영양제 준비·출력', path: '/orders' },
      { icon: History, label: '준비 내역', path: '/history' },
    ],
  },
  {
    id: 'manage',
    label: '관리',
    items: [
      { icon: BookOpen, label: '레시피 관리', path: '/recipes' },
      { icon: Pill, label: '원료·영양제 관리', path: '/ingredients' },
    ],
  },
]
