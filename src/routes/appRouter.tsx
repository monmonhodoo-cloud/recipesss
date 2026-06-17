import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AppLayout } from '../components/AppLayout'
import { AuthGuard } from '../components/AuthGuard'
import { IngredientsPage } from '../pages/IngredientsPage'
import { LoginPage } from '../pages/LoginPage'
import { OrdersPage } from '../pages/OrdersPage'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { RecipeDetailPage } from '../pages/RecipeDetailPage'
import { RecipeNewPage } from '../pages/RecipeNewPage'
import { PrintPageLazy } from '../pages/PrintPageLazy'
import { RecipeCheckPage } from '../pages/RecipeCheckPage'
import { RecipesPage } from '../pages/RecipesPage'
import { SettingsPage } from '../pages/SettingsPage'

// SPEC §5.1 라우트 트리 + AuthGuard.
// 단계 0-C: 모든 인증된 라우트는 PlaceholderPage. 단계 0.5부터 실제 페이지로.

export const appRouter = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            // 대시보드 제거 — 루트는 레시피 목록으로.
            path: '/',
            element: <Navigate replace to="/recipes" />,
          },
          {
            path: '/recipes/new',
            element: <RecipeNewPage />,
          },
          {
            path: '/recipes/draft/:draftId',
            element: (
              <PlaceholderPage title="신규 레시피 (편집)" stage="단계 1·3" />
            ),
          },
          {
            path: '/recipes',
            element: <RecipesPage />,
          },
          {
            path: '/recipes/:draftId',
            element: <RecipeDetailPage />,
          },
          {
            path: '/recipe-check',
            element: <RecipeCheckPage />,
          },
          {
            path: '/ingredients',
            element: <IngredientsPage />,
          },
          {
            path: '/orders',
            element: <OrdersPage />,
          },
          {
            path: '/print',
            element: <PrintPageLazy />,
          },
          {
            path: '/prices',
            element: (
              <PlaceholderPage title="단가 관리" stage="단계 5 (생산앱 협의)" />
            ),
          },
          {
            path: '/settings',
            element: <SettingsPage />,
          },
          {
            path: '*',
            element: <PlaceholderPage title="404" stage="잘못된 경로" />,
          },
        ],
      },
    ],
  },
])
