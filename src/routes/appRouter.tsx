import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AppLayout } from '../components/AppLayout'
import { AuthGuard } from '../components/AuthGuard'
import { IngredientsPage } from '../pages/IngredientsPage'
import { LoginPage } from '../pages/LoginPage'
import { OrdersPage } from '../pages/OrdersPage'
import { OrderHistoryPage } from '../pages/OrderHistoryPage'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { RecipeDetailPage } from '../pages/RecipeDetailPage'
import { RecipeNewPage } from '../pages/RecipeNewPage'
import { PrintPageLazy } from '../pages/PrintPageLazy'
import { RecipeCheckPage } from '../pages/RecipeCheckPage'
import { RecipesPage } from '../pages/RecipesPage'

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
            // DL-041: 앱을 열면 바로 프리셋 선택.
            path: '/',
            element: <Navigate replace to="/orders" />,
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
            path: '/history',
            element: <OrderHistoryPage />,
          },
          {
            path: '/print',
            element: <PrintPageLazy />,
          },
          {
            path: '/prices',
            element: <Navigate replace to="/orders" />,
          },
          {
            path: '/settings',
            element: <Navigate replace to="/orders" />,
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
