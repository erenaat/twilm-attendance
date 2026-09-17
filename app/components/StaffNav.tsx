'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

interface StaffNavProps {
  userRole?: string | null
}

export default function StaffNav({ userRole }: StaffNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navLinks = [
    { href: '/dashboard', label: 'Home', icon: '✦' },
    { href: '/attendance', label: 'Presence', icon: '⏱' },
    { href: '/tasks', label: 'Rituals', icon: '✓' },
    { href: '/leave', label: 'Leave', icon: '◷' },
  ]

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E8E2D5] w-full">
      {/* Micro-banner */}
      <div className="bg-[#191C1A] text-[#D8C7B5] px-3 py-1 text-[8px] sm:text-[9px] uppercase tracking-[0.25em] font-mono flex justify-between items-center">
        <span>TWILM ATELIER</span>
        <span>BALI • OS 2.6</span>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-13 sm:h-14 flex items-center justify-between gap-2">
        {/* Brand Mark */}
        <Link href="/dashboard" className="flex items-center space-x-1.5 shrink-0">
          <span className="w-5 h-5 rounded-full bg-[#191C1A] text-[#FAF8F5] flex items-center justify-center text-[9px] font-serif">
            T
          </span>
          <span className="text-xs tracking-[0.2em] font-light text-[#191C1A] uppercase">
            TWILM
          </span>
        </Link>

        {/* Scrollable Nav Bar for Mobile */}
        <nav className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? 'bg-[#191C1A] text-[#FAF8F5]'
                    : 'text-[#6B665E] hover:text-[#191C1A] hover:bg-[#F2EFE8]'
                }`}
              >
                <span className="mr-1 text-[9px] opacity-70">{link.icon}</span>
                {link.label}
              </Link>
            )
          })}

          {userRole === 'admin' && (
            <Link
              href="/admin"
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider whitespace-nowrap shrink-0 transition-all ${
                pathname === '/admin'
                  ? 'bg-[#C26D53] text-white'
                  : 'text-[#C26D53] bg-[#FBF0EC] border border-[#F2D7CE]'
              }`}
            >
              Admin
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="px-2 py-0.5 rounded-full border border-[#DCD6C8] text-[10px] text-[#827D73] shrink-0"
          >
            Exit
          </button>
        </nav>
      </div>
    </header>
  )
}