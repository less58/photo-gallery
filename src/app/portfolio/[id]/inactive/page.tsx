import { Lock } from 'lucide-react'

export default function InactivePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#0A0A0A' }}>
      <div className="w-full max-w-sm text-center flex flex-col items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
          <Lock size={28} className="text-white/50" />
        </div>
        <div>
          <h1 className="text-white font-bold text-xl mb-2">הגלריה אינה פעילה עדיין</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            הגלריה עדיין לא נפתחה לצפייה.
            <br />
            יש ליצור קשר עם הצלמת לקבלת קוד גישה.
          </p>
        </div>
      </div>
    </div>
  )
}
