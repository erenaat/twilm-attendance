'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function DashboardPage() {
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Staff Dashboard</h1>
          <p className="text-sm text-gray-600">Welcome to TWILM Attendance.</p>
        </div>

        <button
          onClick={() => router.push('/attendance')}
          className="w-full py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-sm"
        >
          Go to Attendance (Clock In / Out)
        </button>

        <button
          onClick={handleSignOut}
          className="w-full py-2 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
        >
          Sign Out
        </button>
      </div>
    </main>
  )
}