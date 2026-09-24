const hebrewDayMonth = new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long' })
const hebrewFull = new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' })

// e.g. "13 בתשרי" — used inline in each day cell
export function hebrewDayMonthLabel(date: Date): string {
  return hebrewDayMonth.format(date)
}

// e.g. "13 בתשרי 5787" — used in the day detail modal
export function hebrewFullLabel(date: Date): string {
  return hebrewFull.format(date)
}

function hebrewParts(date: Date): { day: number; month: string } {
  const parts = hebrewDayMonth.formatToParts(date)
  return {
    day: Number(parts.find(p => p.type === 'day')?.value ?? 0),
    month: parts.find(p => p.type === 'month')?.value ?? '',
  }
}

// Hebrew month name only, for detecting month boundaries in the grid
export function hebrewMonthOf(date: Date): string {
  return hebrewParts(date).month
}

// Major holidays that fall on a fixed Hebrew calendar date
const FIXED_HOLIDAYS: Record<string, string> = {
  'תשרי-1': 'ראש השנה',
  'תשרי-2': 'ראש השנה',
  'תשרי-10': 'יום כיפור',
  'תשרי-15': 'סוכות',
  'תשרי-16': 'סוכות',
  'תשרי-21': 'הושענא רבה',
  'תשרי-22': 'שמיני עצרת / שמחת תורה',
  'שבט-15': 'ט״ו בשבט',
  'אדר-14': 'פורים',
  'אדר ב׳-14': 'פורים',
  'ניסן-15': 'פסח',
  'ניסן-21': 'שביעי של פסח',
  'אייר-18': 'ל״ג בעומר',
  'סיוון-6': 'שבועות',
  'אב-9': 'תשעה באב',
}

// Hanukkah starts 25 Kislev but Kislev's length (29 or 30 days) varies by year,
// so its last nights land on 1-3 Tevet unpredictably — scan backward for the
// actual 25 Kislev instead of hardcoding a Tevet offset.
export function hebrewHoliday(date: Date): string | null {
  const { day, month } = hebrewParts(date)
  const fixed = FIXED_HOLIDAYS[`${month}-${day}`]
  if (fixed) return fixed

  if (month === 'כסלו' && day >= 25) return `חנוכה — נר ${day - 24}`

  if (month === 'טבת' && day <= 3) {
    for (let back = 1; back <= day + 5; back++) {
      const d = new Date(date)
      d.setDate(d.getDate() - back)
      const p = hebrewParts(d)
      if (p.month === 'כסלו' && p.day === 25) {
        const night = back + 1
        if (night <= 8) return `חנוכה — נר ${night}`
      }
    }
  }

  return null
}
