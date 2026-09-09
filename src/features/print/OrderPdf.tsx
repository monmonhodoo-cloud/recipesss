import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'

import type { OutputOneGroup, OutputTwo } from './printSelectors'
import {
  chunks,
  paginateOwnerGroups,
  paginateStaffGroups,
} from './printPagination'

// SPEC §7.3 — Noto Sans KR 임베드 (public/fonts/, 단계 4).
Font.register({
  family: 'NotoSansKR',
  fonts: [
    { src: '/fonts/NotoSansKR-Regular.ttf' },
    { src: '/fonts/NotoSansKR-Bold.ttf', fontWeight: 700 },
  ],
})

const BORDER = '1px solid #9ca3af'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansKR',
    fontSize: 10,
    padding: 28,
    color: '#111827',
  },
  // borderBottom 없음 — 마지막 행 td.borderBottom이 테이블 하단 역할.
  // border 단축 + 마지막행 td borderBottom:0 조합은 @react-pdf에서 행 높이 불일치 발생.
  table: {
    marginBottom: 14,
    borderTop: BORDER,
    borderLeft: BORDER,
    borderRight: BORDER,
  },
  row: { flexDirection: 'row' },
  titleCell: {
    backgroundColor: '#f3f4f6',
    borderBottom: BORDER,
    fontWeight: 700,
    paddingVertical: 4,
    paddingHorizontal: 6,
    textAlign: 'center',
  },
  th: {
    backgroundColor: '#f9fafb',
    borderBottom: BORDER,
    borderRight: BORDER,
    fontSize: 9,
    fontWeight: 700,
    paddingVertical: 3,
    paddingHorizontal: 3,
    textAlign: 'center',
  },
  td: {
    borderBottom: BORDER,
    borderRight: BORDER,
    fontSize: 9,
    paddingVertical: 3,
    paddingHorizontal: 3,
    textAlign: 'center',
  },
  left: { textAlign: 'left' },
  groupName: { fontWeight: 700, marginBottom: 4 },
  groupsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  groupBlock: { marginBottom: 12 },
})

// 마지막 셀 우측 보더 제거용
function cellStyle(base: Style, isLast: boolean, extra?: Style): Style {
  return { ...base, ...(isLast ? { borderRight: 0 } : {}), ...extra }
}

// ---------- 출력 1: 제품별 난각분 표 ----------

const OUT1_LABEL_W = 50
const OUT1_COL_W = 52
// A4(595) - padding(28*2) = 539, gap=12
const PAGE_USABLE_W = 539
const ROW_GAP = 12
// 타이틀 셀 paddingHorizontal=6*2=12. NotoSansKR 10pt: 한글 ~10pt, ASCII ~6pt
const TITLE_PADDING_H = 12
const KO_CHAR_W = 10
// 2줄 minHeight: lineHeight≈14(fontSize10*1.4) * 2 + paddingVertical 4*2 = 36
const TITLE_1LINE_H = 22 // 14 + 8(pad)
const TITLE_2LINE_H = 36 // 14*2 + 8(pad)

function estimateTitleLines(name: string, tableW: number): number {
  const textW = tableW - TITLE_PADDING_H
  // 한글·ASCII 혼합을 대략 KO_CHAR_W로 통일 추정
  return name.length * KO_CHAR_W > textW ? 2 : 1
}

// 페이지 usable width 기준으로 flex-wrap 시뮬레이션 → visual row 배열 반환
function groupIntoRows(groups: OutputOneGroup[]): OutputOneGroup[][] {
  const rows: OutputOneGroup[][] = []
  let row: OutputOneGroup[] = []
  let usedW = 0
  for (const g of groups) {
    const w = OUT1_LABEL_W + g.columns.length * OUT1_COL_W
    const needed = row.length === 0 ? w : usedW + ROW_GAP + w
    if (needed > PAGE_USABLE_W && row.length > 0) {
      rows.push(row)
      row = [g]
      usedW = w
    } else {
      row.push(g)
      usedW = needed
    }
  }
  if (row.length > 0) rows.push(row)
  return rows
}

export function OrderPdf1({ groups }: { groups: OutputOneGroup[] }) {
  const rows = groupIntoRows(paginateOwnerGroups(groups))
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {rows.map((rowGroups, rowIdx) => {
          // 이 row에서 가장 긴 타이틀 기준으로 모든 표의 타이틀 높이 통일
          const maxLines = Math.max(
            ...rowGroups.map((g) => {
              const tableW = OUT1_LABEL_W + g.columns.length * OUT1_COL_W
              return estimateTitleLines(g.name, tableW)
            }),
          )
          const titleMinH = maxLines >= 2 ? TITLE_2LINE_H : TITLE_1LINE_H
          return (
            <View
              key={rowIdx}
              style={[styles.groupsRow, { marginBottom: ROW_GAP }]}
            >
              {rowGroups.map((group) => {
                const cols = group.columns.length
                const tableW = OUT1_LABEL_W + cols * OUT1_COL_W
                return (
                  <View
                    key={group.name}
                    style={[styles.table, { width: tableW }]}
                    wrap={false}
                  >
                    <Text style={[styles.titleCell, { minHeight: titleMinH }]}>
                      {group.name}
                    </Text>
                    <View style={styles.row}>
                      <Text
                        style={cellStyle(styles.th, false, {
                          width: OUT1_LABEL_W,
                        })}
                      />
                      {group.columns.map((column, index) => (
                        <Text
                          key={index}
                          style={cellStyle(styles.th, index === cols - 1, {
                            width: OUT1_COL_W,
                          })}
                        >
                          {column.header}
                        </Text>
                      ))}
                    </View>
                    <View style={styles.row}>
                      <Text
                        style={cellStyle(styles.td, false, {
                          width: OUT1_LABEL_W,
                          textAlign: 'left',
                        })}
                      >
                        난각분
                      </Text>
                      {group.columns.map((column, index) => (
                        <Text
                          key={index}
                          style={cellStyle(styles.td, index === cols - 1, {
                            width: OUT1_COL_W,
                          })}
                        >
                          {column.eggshell}
                        </Text>
                      ))}
                    </View>
                  </View>
                )
              })}
            </View>
          )
        })}
      </Page>
    </Document>
  )
}

// ---------- 출력 2: 난각분 단독 + 코드 prefix별 치환명 표 ----------

export function OrderPdf2({ output }: { output: OutputTwo }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.groupsRow}>
          {chunks(output.eggshellWeights, 30).map((weights, chunkIndex) => (
            <View
              key={chunkIndex}
              style={[styles.table, { width: 140 }]}
              wrap={false}
            >
              <Text style={styles.titleCell}>난각분</Text>
              {weights.map((weight, index) => (
                <Text key={index} style={[styles.td, { borderRight: 0 }]}>
                  {weight}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.groupsRow}>
          {paginateStaffGroups(output.aliasGroups).map((group, groupIndex) => {
            const cols = group.codes.length
            const labelW = 70
            const colW = 52
            return (
              <View
                key={`${group.name}-${groupIndex}`}
                style={styles.groupBlock}
                wrap={false}
              >
                <Text style={styles.groupName}>{group.name}</Text>
                <View style={[styles.table, { marginBottom: 0 }]}>
                  <View style={styles.row}>
                    <Text
                      style={cellStyle(styles.th, false, {
                        width: labelW,
                        textAlign: 'left',
                      })}
                    >
                      치환명
                    </Text>
                    {group.codes.map((code, index) => (
                      <Text
                        key={code}
                        style={cellStyle(styles.th, index === cols - 1, {
                          width: colW,
                        })}
                      >
                        {code}
                      </Text>
                    ))}
                  </View>
                  {group.rows.map((row) => (
                    <View key={row.displayName} style={styles.row}>
                      <Text
                        style={cellStyle(styles.td, false, {
                          width: labelW,
                          textAlign: 'left',
                        })}
                      >
                        {row.displayName}
                      </Text>
                      {row.weights.map((weight, index) => (
                        <Text
                          key={index}
                          style={cellStyle(styles.td, index === cols - 1, {
                            width: colW,
                          })}
                        >
                          {weight}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            )
          })}
        </View>
      </Page>
    </Document>
  )
}
