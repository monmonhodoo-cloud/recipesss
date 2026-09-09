import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IngredientPreparationSettings } from './IngredientPreparationSettings'
import type { Ingredient } from '../types/recipe'

const ingredient: Ingredient = {
  id: 'tomato',
  name: '찐 토마토 가루',
  kind: 'ingredient',
  hidden: false,
  aliases: [],
  displayName: '',
  sortOrder: 0,
}

describe('출력 설정', () => {
  it('일반 원료를 포함하고 치환명을 별도로 저장한다', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    render(
      <IngredientPreparationSettings
        ingredient={ingredient}
        isPending={false}
        onSave={save}
      />,
    )
    expect(
      screen.getByRole('checkbox', { name: '계량·출력에 포함' }),
    ).not.toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: '계량·출력에 포함' }))
    expect(
      screen.getByText(/직원용 출력에는 치환명이 필요/),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '직원용 치환명' }), {
      target: { value: ' 가 ' },
    })
    fireEvent.click(screen.getByRole('button', { name: '출력 설정 저장' }))
    expect(await screen.findByRole('status')).toHaveTextContent('저장했습니다')
    expect(save).toHaveBeenCalledWith({
      includeInPreparation: true,
      displayName: '가',
    })
    expect(ingredient.kind).toBe('ingredient')
  })

  it('저장 실패를 알리고 입력한 설정을 유지해 다시 저장할 수 있다', async () => {
    const save = vi.fn().mockRejectedValue(new Error('연결 오류'))
    render(
      <IngredientPreparationSettings
        ingredient={ingredient}
        isPending={false}
        onSave={save}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: '계량·출력에 포함' }))
    fireEvent.click(screen.getByRole('button', { name: '출력 설정 저장' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('연결 오류')
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
