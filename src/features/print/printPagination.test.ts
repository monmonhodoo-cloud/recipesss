import { describe, expect, it } from 'vitest'
import {
  chunks,
  paginateOwnerGroups,
  paginateStaffGroups,
} from './printPagination'

describe('A4 대량 출력', () => {
  it('대표용 60개 프리셋·35개 재료의 모든 셀을 정확한 열에 보존한다', () => {
    const columns = Array.from({ length: 60 }, (_, i) => ({
      header: `A${i}`,
      eggshell: '',
    }))
    const rows = Array.from({ length: 35 }, (_, r) => ({
      name: `원료${r}`,
      weights: columns.map((_, c) => `${r}-${c}g`),
    }))
    const pages = paginateOwnerGroups([{ name: '비프', columns, rows }])
    const cells: string[] = []
    for (const page of pages) {
      expect(110 + page.columns.length * 52).toBeLessThanOrEqual(539)
      expect(page.rows!.length).toBeLessThanOrEqual(16)
      for (const row of page.rows!)
        row.weights.forEach((weight, c) => {
          const originalColumn = Number(page.columns[c]!.header.slice(1))
          expect(weight).toBe(`${row.name.slice(2)}-${originalColumn}g`)
          cells.push(weight)
        })
    }
    expect(cells).toHaveLength(60 * 35)
    expect(new Set(cells).size).toBe(60 * 35)
  })
  it('60개 프리셋도 A4 가로 폭을 넘지 않고 모든 코드를 유지한다', () => {
    const codes = Array.from({ length: 60 }, (_, i) => `A${i}`)
    const owner = paginateOwnerGroups([
      {
        name: '치킨',
        columns: codes.map((header) => ({ header, eggshell: '10.0g' })),
      },
    ])
    expect(owner.every((group) => 50 + group.columns.length * 52 <= 539)).toBe(
      true,
    )
    expect(
      new Set(
        owner.flatMap((group) => group.columns.map((item) => item.header)),
      ),
    ).toEqual(new Set(codes))
    const staff = paginateStaffGroups([
      {
        name: 'A',
        codes,
        rows: [{ displayName: '가', weights: codes.map((_, i) => `${i}g`) }],
      },
    ])
    expect(staff.every((group) => 70 + group.codes.length * 52 <= 539)).toBe(
      true,
    )
    expect(staff.flatMap((group) => group.rows[0]!.weights)).toEqual(
      codes.map((_, i) => `${i}g`),
    )
    expect(chunks(codes, 30).map((items) => items.length)).toEqual([30, 30])
  })
})
