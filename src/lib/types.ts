export type Photographer = {
  id: string
  email: string
  name: string
  logo_url: string | null
  brand_color: string
  allow_album_download: boolean
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
  client_password?: string | null
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

export type CalendarCategory = 'shoot' | 'delivery' | 'meeting' | 'personal' | 'other'
export type CalendarKind = 'event' | 'task'

export type CalendarEvent = {
  id: string
  photographer_id: string
  event_date: string
  event_time: string | null
  title: string
  notes: string | null
  category: CalendarCategory
  kind: CalendarKind
  completed: boolean
  reminder_minutes_before: number | null
  reminder_sent: boolean
  created_at: string
  updated_at: string
}

export type Album = {
  id: string
  portfolio_id: string
  name: string
  pdf_url: string | null
  image_urls: string[] | null
  page_count: number
  last_page_single: boolean | null
  spread_notes: Record<string, string> | null
  created_at: string
}
