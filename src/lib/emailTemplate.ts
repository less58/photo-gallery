type EmailData = {
  photographerName: string
  clientEmail: string
  portfolioTitle: string
  magicLink: string
  siteUrl: string
  bodyTemplate: string
  logoUrl?: string | null
  brandColor?: string
  clientPassword?: string | null
  quota?: number | null
}

const DEFAULT_BODY = `היי,

איזה כיף להיזכר ברגעים המשותפים שלנו! הגלריה עם כל התמונות מהצילומים שלנו מוכנה עבורך בקישור המצורף: {link}.
כדי להיכנס, השתמשי בקוד האישי שלך: {password}.

איך הכי נוח לבחור?
יצרתי עבורך מערכת בחירה חכמה שתעזור לך להחליט בקלות:

השוואה: אם את מתלבטת בין שתי תמונות דומות, השתמשי באופציית ה"השוואה" כדי לראות אותן זו לצד זו ולבחור את הטובה ביותר.

סימון "V": לתמונות שאת בטוחה שאת רוצה באלבום.

סימון "?" : לתמונות שאת מתלבטת לגביהן. נוכל לעבור עליהן יחד בהמשך.

סימון "X": לתמונות שפחות אהבת, כדי שנוכל להסיר אותן מהסינון הסופי.

כמה דגשים קטנים:

כמות: זכרי לבחור {quota} תמונות, בהתאם לחבילה שבחרנו.

שאלות: אם יש לך תמונה שאת מתלבטת לגביה, או שתרצי שאעזור לך להחליט – אני כאן לכל שאלה (שימי לב שיש צאט בתוך המערכת)

ובסיום – אל תשכחי לשלוח לי את הרשימה הסופית דרך האתר אך בכל זאת אני תמיד רואה את הבחירות שלך גם ללא השליחה

אם משהו לא ברור או שאת זקוקה לעזרה טכנית בהתמצאות בגלריה, אני זמינה כאן לכל שאלה.

מחכה לראות את הבחירות המדויקות שלך!

באהבה,
{photographer_name}`

function applyVariables(template: string, data: EmailData): string {
  return template
    .replace(/{photographer_name}/g, data.photographerName)
    .replace(/{client_email}/g, data.clientEmail)
    .replace(/{portfolio_name}/g, data.portfolioTitle)
    .replace(/{link}/g, data.magicLink)
    .replace(/{password}/g, data.clientPassword || '')
    .replace(/{quota}/g, data.quota != null ? String(data.quota) : '')
}

export function buildEmailHtml(data: EmailData): string {
  const color = data.brandColor || '#C97B73'
  const body = applyVariables(data.bodyTemplate || DEFAULT_BODY, data)
    .split('\n').join('<br>')

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.portfolioTitle}</title>
</head>
<body style="margin:0;padding:0;background:#F5F4F2;font-family:'Arial',sans-serif;direction:rtl;text-align:right;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F2;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:${color};padding:32px 40px;text-align:center;">
            ${data.logoUrl
              ? `<img src="${data.logoUrl}" alt="${data.photographerName}" style="max-height:60px;max-width:180px;object-fit:contain;" />`
              : `<h2 style="color:#fff;margin:0;font-size:22px;">${data.photographerName}</h2>`
            }
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h1 style="color:#1C1917;font-size:20px;margin:0 0 16px 0;line-height:1.4;">
              התמונות שלך מוכנות! 📷
            </h1>
            <p style="color:#57534E;font-size:15px;line-height:1.8;margin:0 0 28px 0;">
              ${body}
            </p>

            <!-- CTA Button -->
            <div style="text-align:center;">
              <a href="${data.magicLink}"
                style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:17px;font-weight:700;">
                כניסה לבחירת התמונות ✨
              </a>
            </div>

            <p style="color:#A8A29E;font-size:12px;text-align:center;margin-top:20px;">
              הקישור תקף לחודש. אין צורך בסיסמה.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #F0EDE9;text-align:center;">
            <p style="color:#A8A29E;font-size:12px;margin:0;">
              מייל זה נשלח על ידי ${data.photographerName} דרך select it
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function buildEmailText(data: EmailData): string {
  return applyVariables(data.bodyTemplate || DEFAULT_BODY, data)
}
