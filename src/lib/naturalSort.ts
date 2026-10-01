// Sorts file names the way a person reads them: IMG_2 before IMG_10
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function compareNames(a: string, b: string): number {
  return collator.compare(a, b)
}

export function sortByName<T extends { name?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareNames(a.name || '', b.name || ''))
}
