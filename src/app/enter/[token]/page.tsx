import { redirect } from 'next/navigation'

export default async function EnterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  redirect(`/api/enter/${token}`)
}
