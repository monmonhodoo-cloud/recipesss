import type { Preset, RecipeDraft, Species } from '../../types/recipe'

export type OrderGroup = {
  draftId: string
  draftName: string
  species: Species
  unitLabel: string
  category?: RecipeDraft['category']
  presets: Preset[]
}

export type OrderSelection = Record<string, true>

export type OrderFilter = 'all' | 'cat' | 'dog' | 'freezeDried'

export type OrderSummaryItem = { code: string }
export type OrderSummaryGroup = {
  draftId: string
  label: string
  items: OrderSummaryItem[]
}

const CODE_RE = /^([A-Za-z])(\d+)$/

export function speciesLabel(species: Species): string {
  if (species === 'cat') return '고양이'
  if (species === 'dog') return '강아지'
  return '공용'
}

export function groupLabel(draft: RecipeDraft): string {
  return `(${speciesLabel(draft.species)})${draft.name}`
}

export function groupPresetsByRecipe(
  drafts: RecipeDraft[],
  presets: Preset[],
  includeEmpty = false,
): OrderGroup[] {
  const presetsByDraft = new Map<string, Preset[]>()

  for (const preset of presets) {
    const list = presetsByDraft.get(preset.draftId) ?? []
    list.push(preset)
    presetsByDraft.set(preset.draftId, list)
  }

  return [...drafts]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((draft) => {
      const draftPresets = presetsByDraft.get(draft.id)
      if (!includeEmpty && (!draftPresets || draftPresets.length === 0))
        return []

      return [
        {
          draftId: draft.id,
          draftName: draft.name,
          species: draft.species,
          unitLabel: draft.unitLabel,
          category: draft.category,
          presets: sortPresetsForOrders(draftPresets ?? []),
        },
      ]
    })
}

export function sortPresetsForOrders(presets: Preset[]): Preset[] {
  return [...presets].sort(comparePresetCode)
}

function comparePresetCode(a: Preset, b: Preset): number {
  const parsedA = parsePresetCode(a.code)
  const parsedB = parsePresetCode(b.code)

  if (parsedA && parsedB) {
    const prefix = parsedA.prefix.localeCompare(parsedB.prefix)
    if (prefix !== 0) return prefix
    if (parsedA.suffix !== parsedB.suffix)
      return parsedA.suffix - parsedB.suffix
  } else if (parsedA || parsedB) {
    return parsedA ? -1 : 1
  }

  const code = a.code.localeCompare(b.code)
  if (code !== 0) return code
  return a.sortOrder - b.sortOrder
}

function parsePresetCode(
  code: string,
): { prefix: string; suffix: number } | null {
  const match = CODE_RE.exec(code.trim())
  if (!match) return null
  return { prefix: match[1]!.toUpperCase(), suffix: Number(match[2]) }
}

export function formatPresetInput(preset: Preset): string {
  const unit = preset.inputUnitLabel.trim()
  if (!unit) return String(preset.inputAmount)
  return `${preset.inputAmount} ${unit}`
}

export function buildOrderSummary(
  groups: OrderGroup[],
  selection: OrderSelection,
): OrderSummaryGroup[] {
  return groups.flatMap((group) => {
    const items = group.presets.flatMap((preset) => {
      if (!Object.prototype.hasOwnProperty.call(selection, preset.id)) return []

      return [
        {
          code: preset.code,
        },
      ]
    })

    if (items.length === 0) return []

    return [
      {
        draftId: group.draftId,
        label: `(${speciesLabel(group.species)})${group.draftName}`,
        items,
      },
    ]
  })
}

export function filterOrderGroups(
  groups: OrderGroup[],
  filter: OrderFilter,
): OrderGroup[] {
  if (filter === 'all') return groups
  return groups.filter((group) => {
    const freezeDried = group.category
      ? group.category === '동결건조' || group.category === '동결텐더'
      : isFreezeDriedName(group.draftName)
    return filter === 'freezeDried'
      ? freezeDried
      : group.species === filter && !freezeDried
  })
}

function isFreezeDriedName(name: string): boolean {
  const normalized = name.toLowerCase()
  return (
    normalized.includes('동결') ||
    normalized.includes('freeze') ||
    normalized.includes('frozen')
  )
}

export function formatOrderLine(group: OrderSummaryGroup): string {
  const body = group.items.map((item) => item.code).join(' / ')

  return `${group.label}  ${body}`
}

export function totalSelectedCount(selection: OrderSelection): number {
  return Object.keys(selection).length
}
