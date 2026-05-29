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
