'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function StaffNav({ userRole }: { userRole?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Attendance', href: '/attendance' },
    { label: 'Schedule', href: '/schedule' },
    { label: 'Tasks', href: '/tasks' },
    { label: 'Leave', href: '/leave' },
    { label: 'News', href: '/announcements' },
    { label: 'Profile', href: '/profile' },
  ]

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#fbfbf9]/90 backdrop-blur-md border-b border-[#eaeae5]">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link 
              href="/dashboard" 
              className="text-xs tracking-[0.25em] font-medium uppercase text-[#171716]"
            >
              TWILM <span className="text-[#73726c]">OS</span>
            </Link>

            <nav className="hidden sm:flex items-center space-x-4 text-xs tracking-wider uppercase">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`transition-colors hover:text-black ${
                    pathname === item.href
                      ? 'text-black font-semibold border-b border-black pb-0.5'
                      : 'text-[#73726c]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}

              {userRole === 'admin' && (
                <Link
                  href="/admin"
                  className="text-amber-700 font-semibold hover:text-amber-900 transition-colors"
                >
                  Admin
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleSignOut}
              className="text-[11px] tracking-wider uppercase text-[#73726c] hover:text-black transition-colors px-2.5 py-1 border border-[#eaeae5] bg-white rounded cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#eaeae5] px-2 py-3 flex justify-around">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`text-[9px] tracking-widest uppercase ${
              pathname === item.href ? 'text-black font-bold' : 'text-[#73726c]'
            }`}
          >
            {item.label}
          </Link>
        ))}
        {userRole === 'admin' && (
          <Link
            href="/admin"
            className="text-[9px] tracking-widest uppercase text-amber-700 font-bold"
          >
            Admin
          </Link>
        )}
      </nav>
    </>
  )
}