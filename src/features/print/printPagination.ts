import type { OutputOneGroup, OutputTwoAliasGroup } from './printSelectors'

// A4 595pt - 좌우 28pt 여백. 기존 52pt 열 너비를 유지하며 최대 9열.
export function chunks<T>(items: T[], count: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += count)
    result.push(items.slice(index, index + count))
  return result
}

export function paginateOwnerGroups(
  groups: OutputOneGroup[],
): OutputOneGroup[] {
  return groups
    .flatMap((group) =>
      chunks(group.columns, 9).map((columns) => ({ ...group, columns })),
    )
    .sort(
      (a, b) =>
        a.columns.length - b.columns.length ||
        a.name.localeCompare(b.name, 'ko'),
    )
}

export function paginateStaffGroups(
  groups: OutputTwoAliasGroup[],
): OutputTwoAliasGroup[] {
  return groups.flatMap((group) =>
    chunks(group.codes, 9).flatMap((codes, index) =>
      chunks(group.rows, 20).map((rows) => ({
        ...group,
        codes,
        rows: rows.map((row) => ({
          ...row,
          weights: row.weights.slice(index * 9, index * 9 + codes.length),
        })),
      })),
    ),
  )
}
