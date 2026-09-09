import { describe, expect, it } from 'vitest'
import backup from '../../../backups/2026-06-03-pre-rewrite.json'
import { migrateV2toV3 } from '../migration/migrateV2toV3'
import type { V2State } from '../migration/v2State'
import { getPresetRatioInfo } from './presetRatio'
import { buildPresetPrintViews } from '../print/printSelectors'
import { preparationIssues } from '../orders/orderSnapshot'
import type { Preset } from '../../types/recipe'

describe('사용자가 확인한 올드 패션 비프 스튜 표', () => {
  it('정제수 복구 후 30kg 배합 전체와 난각분 168g이 원본 표와 일치한다', () => {
    const data = migrateV2toV3(backup as unknown as V2State, {
      ownerUid: 'owner',
      now: 1,
    })
    const draft = data.recipeDrafts.find(
      (item) => item.id === 'draft_xto94vcl',
    )!
    const info = getPresetRatioInfo(draft, draft.unitIngredientId, 30)
    expect(
      draft.composition.map((row) => (row.weight * info.ratio).toFixed(2)),
    ).toEqual([
      '30000.00',
      '14957.14',
      '168.00',
      '2.14',
      '2.14',
      '2.14',
      '2.14',
    ])
    const preset: Preset = {
      id: 'beef30',
      draftId: draft.id,
      code: 'X2',
      unitIngredientId: draft.unitIngredientId,
      inputAmount: 30,
      inputUnitLabel: 'kg',
      targetWeight: 30000,
      sortOrder: 0,
      label: '',
      createdAt: 1,
    }
    const missing = data.ingredients.filter(
      (item) => item.id !== 'ing_afkryt5v',
    )
    const before = buildPresetPrintViews(
      [preset.id],
      [preset],
      [draft],
      missing,
    )
    expect(preparationIssues([preset.id], before, missing)).toContain(
      '올드 패션 비프 스튜: 연결되지 않은 원료가 있습니다.',
    )
    const after = buildPresetPrintViews(
      [preset.id],
      [preset],
      [draft],
      data.ingredients,
    )
    expect(preparationIssues([preset.id], after, data.ingredients)).toEqual([])
    expect(
      after[0]!.supplements.find((item) => item.name === '난각분')!
        .scaledWeight,
    ).toBeCloseTo(168)
  })
})
