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
    { href: '/dashboard', label: 'Overview', icon: '✦' },
    { href: '/attendance', label: 'Presence', icon: '⏱' },
    { href: '/tasks', label: 'Rituals & Tasks', icon: '✓' },
    { href: '/leave', label: 'Leave', icon: '◷' },
  ]

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E8E2D5]">
      {/* Top micro-banner */}
      <div className="bg-[#191C1A] text-[#D8C7B5] px-4 py-1 text-[9px] uppercase tracking-[0.3em] font-mono flex justify-between items-center">
        <span>TWILM ATELIER &amp; BOUTIQUES</span>
        <span className="hidden sm:inline">BALI • STAFF OS 2.6</span>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand Mark */}
        <Link href="/dashboard" className="flex items-center space-x-2 group">
          <span className="w-6 h-6 rounded-full bg-[#191C1A] text-[#FAF8F5] flex items-center justify-center text-[10px] font-serif group-hover:bg-[#C26D53] transition-colors">
            T
          </span>
          <span className="text-sm tracking-[0.25em] font-light text-[#191C1A] uppercase">
            TWILM <span className="font-serif italic text-xs text-[#9E7B56]">OS</span>
          </span>
        </Link>

        {/* Navigation Items */}
        <nav className="flex items-center space-x-1 sm:space-x-2">
          {navLinks.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#191C1A] text-[#FAF8F5] shadow-xs'
                    : 'text-[#6B665E] hover:text-[#191C1A] hover:bg-[#F2EFE8]'
                }`}
              >
                <span className="mr-1 text-[10px] opacity-70">{link.icon}</span>
                {link.label}
              </Link>
            )
          })}

          {userRole === 'admin' && (
            <Link
              href="/admin"
              className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition-all ${
                pathname === '/admin'
                  ? 'bg-[#C26D53] text-white shadow-xs'
                  : 'text-[#C26D53] bg-[#FBF0EC] border border-[#F2D7CE] hover:bg-[#C26D53] hover:text-white'
              }`}
            >
              Admin
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="ml-2 px-3 py-1 rounded-full border border-[#DCD6C8] text-[11px] text-[#827D73] hover:text-[#191C1A] hover:border-[#191C1A] transition"
          >
            Exit
          </button>
        </nav>
      </div>
    </header>
  )
}