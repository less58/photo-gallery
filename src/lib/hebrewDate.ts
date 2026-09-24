const hebrewDayMonth = new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long' })
const hebrewFull = new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' })

// e.g. "י״ג בתשרי" — used inline in each day cell
export function hebrewDayMonthLabel(date: Date): string {
  return hebrewDayMonth.format(date)
}

// e.g. "13 בתשרי 5787" — used in the day detail modal
export function hebrewFullLabel(date: Date): string {
  return hebrewFull.format(date)
}

// Hebrew month name only, for detecting month boundaries in the grid
export function hebrewMonthOf(date: Date): string {
  const parts = hebrewDayMonth.formatToParts(date)
  return parts.find(p => p.type === 'month')?.value ?? ''
}
