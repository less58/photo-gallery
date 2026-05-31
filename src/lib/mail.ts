export async function sendConfiguredEmail(
  sender: Record<string, unknown>,
  to: string,
  subject: string,
  html: string,
  text: string
) {
  const provider = (sender.email_provider as string) || 'gmail'
  const displayName = String(sender.sender_display_name || sender.name || 'SELECT IT')

  if (provider === 'gmail' && sender.gmail_address && sender.gmail_app_password) {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: {
        user: sender.gmail_address as string,
        pass: sender.gmail_app_password as string,
      },
    })
    await transporter.sendMail({
      from: `"${displayName}" <${sender.gmail_address as string}>`,
      to,
      subject,
      html,
      text,
    })
    return true
  }

  if (provider === 'resend' && sender.resend_api_key) {
    const { Resend } = await import('resend')
    const resend = new Resend(sender.resend_api_key as string)
    const rawSender = (sender.sender_email as string) || ''
    const isFreeEmail = /gmail\.|hotmail\.|yahoo\.|outlook\.|walla\./i.test(rawSender)
    const address = !rawSender || isFreeEmail ? 'onboarding@resend.dev' : rawSender
    const { error } = await resend.emails.send({
      from: `"${displayName}" <${address}>`,
      to,
      subject,
      html,
      text,
    })
    if (error) throw new Error(error.message)
    return true
  }

  return false
}
