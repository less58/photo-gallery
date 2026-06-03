export type Photographer = {
  id: string
  email: string
  name: string
  logo_url: string | null
  brand_color: string
  created_at: string
}

export type Portfolio = {
  id: string
  photographer_id: string
  client_email: string
  title: string
  cover_url: string | null
  magic_token: string | null
  instructions: string | null
  quota: number
  created_at: string
  photographer?: Photographer
}

export type Session = {
  id: string
  portfolio_id: string
  name: string
  description: string | null
  sort_order: number
  photos?: Photo[]
}

export type Photo = {
  id: string
  session_id: string
  url: string
  thumbnail_url: string | null
  sort_order: number
  name: string | null
}

export type SelectionStatus = 'approved' | 'rejected' | 'maybe'

export type Selection = {
  id: string
  portfolio_id: string
  photo_id: string
  status: SelectionStatus
  updated_at: string
}

export type BrandingContext = {
  color: string
  logoUrl: string | null
  photographerName: string
}

export type CollageCell = {
  x: number       // 0-1 normalized
  y: number
  w: number
  h: number
  photo_url: string | null
  pan_x: number   // -1 to 1 (left to right)
  pan_y: number   // -1 to 1 (top to bottom)
}

export type CollageTemplate = {
  id: string
  name: string
  cells: Pick<CollageCell, 'x' | 'y' | 'w' | 'h'>[]
  is_preset?: boolean
}

export type Album = {
  id: string
  portfolio_id: string
  name: string
  pdf_url: string
  page_count: number
  created_at: string
}

export type Collage = {
  id: string
  portfolio_id: string
  name: string
  cells: CollageCell[]
  border_enabled: boolean
  border_color: string
  border_width: number
  created_at: string
}
