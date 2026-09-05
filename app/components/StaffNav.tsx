'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function StaffNav({ userRole }: { userRole?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const primaryNavItems = [
    { label: 'Dash', fullLabel: 'Dashboard', href: '/dashboard' },
    { label: 'Clock', fullLabel: 'Attendance', href: '/attendance' },
    { label: 'Roster', fullLabel: 'Schedule', href: '/schedule' },
    { label: 'Tasks', fullLabel: 'Tasks', href: '/tasks' },
    { label: 'Leave', fullLabel: 'Leave', href: '/leave' },
  ]

  const allNavItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Attendance', href: '/attendance' },
    { label: 'Schedule', href: '/schedule' },
    { label: 'Tasks', href: '/tasks' },
    { label: 'Leave', href: '/leave' },
    { label: 'News & Memo', href: '/announcements' },
    { label: 'My Profile', href: '/profile' },
  ]

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#fbfbf9]/95 backdrop-blur-md border-b border-[#eaeae5]">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link
              href="/dashboard"
              className="text-xs tracking-[0.25em] font-medium uppercase text-[#171716]"
            >
              TWILM <span className="text-[#73726c]">OS</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-5 text-xs tracking-wider uppercase">
              {allNavItems.map((item) => (
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

          <div className="flex items-center space-x-2">
            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-[10px] tracking-widest uppercase text-[#171716] px-2.5 py-1.5 border border-[#eaeae5] bg-white rounded cursor-pointer"
            >
              {mobileMenuOpen ? 'CLOSE' : 'MENU'}
            </button>

            <button
              onClick={handleSignOut}
              className="text-[10px] tracking-wider uppercase text-[#73726c] hover:text-black transition-colors px-2.5 py-1.5 border border-[#eaeae5] bg-white rounded cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Mobile Expanded Drawer Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#eaeae5] bg-white px-5 py-4 space-y-3 shadow-lg animate-in slide-in-from-top duration-200">
            <span className="text-[9px] uppercase tracking-widest text-[#73726c] font-mono block mb-1">
              NAVIGATION
            </span>
            <div className="grid grid-cols-2 gap-2">
              {allNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`p-2.5 text-xs uppercase tracking-wider border ${
                    pathname === item.href
                      ? 'bg-black text-white border-black font-medium'
                      : 'bg-[#fbfbf9] text-[#171716] border-[#eaeae5]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}

              {userRole === 'admin' && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="col-span-2 p-2.5 text-xs uppercase tracking-wider text-center bg-amber-900 text-white font-medium"
                >
                  Management Admin Portal
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Modern Mobile Bottom Dock */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#eaeae5] px-2 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {primaryNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-1 px-2.5 transition-colors ${
                  isActive ? 'text-black' : 'text-[#8c8b85]'
                }`}
              >
                <span
                  className={`text-[10px] tracking-wider uppercase font-mono ${
                    isActive ? 'font-bold' : 'font-normal'
                  }`}
                >
                  {item.label}
                </span>
                {isActive && (
                  <span className="w-1.5 h-1.5 bg-black rounded-full mt-1 animate-pulse" />
                )}
              </Link>
            )
          })}

          {userRole === 'admin' ? (
            <Link
              href="/admin"
              className={`flex flex-col items-center py-1 px-2.5 ${
                pathname === '/admin' ? 'text-amber-800' : 'text-amber-700'
              }`}
            >
              <span className="text-[10px] tracking-wider uppercase font-mono font-bold">
                ADMIN
              </span>
              {pathname === '/admin' && (
                <span className="w-1.5 h-1.5 bg-amber-800 rounded-full mt-1" />
              )}
            </Link>
          ) : (
            <Link
              href="/announcements"
              className={`flex flex-col items-center py-1 px-2.5 ${
                pathname === '/announcements' ? 'text-black' : 'text-[#8c8b85]'
              }`}
            >
              <span className="text-[10px] tracking-wider uppercase font-mono">
                NEWS
              </span>
            </Link>
          )}
        </div>
      </nav>
    </>
  )
}