'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import StaffNav from '../components/StaffNav'

interface Store {
  id: string
  name: string
  code: string | null
}

interface Profile {
  id: string
  full_name: string | null
  role: string | null
  stores?: Store | null
}

interface AttendanceRecord {
  id: string
  clock_in_at: string | null
  clock_out_at: string | null
  work_date: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [store, setStore] = useState<Store | null>(null)
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [nowTimestamp, setNowTimestamp] = useState<number>(() => Date.now())

  // Ticking Bali clock and timer tracker
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const currentTime = useMemo(() => {
    return new Date(nowTimestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }, [nowTimestamp])

  // Compute elapsed duration purely without triggering setState inside an effect
  const elapsedDuration = useMemo(() => {
    if (!todayRecord?.clock_in_at) return '0h 0m'
    const start = new Date(todayRecord.clock_in_at).getTime()
    const end = todayRecord.clock_out_at
      ? new Date(todayRecord.clock_out_at).getTime()
      : nowTimestamp
    const diffMinutes = Math.max(0, Math.floor((end - start) / 60000))
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    return `${hours}h ${minutes}m`
  }, [todayRecord, nowTimestamp])

  // Load user data
  useEffect(() => {
    const loadStaffData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login')
          return
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*, stores(*)')
          .eq('id', session.user.id)
          .maybeSingle()

        if (profileData) {
          setProfile(profileData)
          if (profileData.stores) {
            setStore(profileData.stores)
          }
        }

        const today = new Date().toISOString().split('T')[0]
        const { data: attData } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('work_date', today)
          .maybeSingle()

        if (attData) {
          setTodayRecord(attData)
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadStaffData()
  }, [router])

  const todayFormatted = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  const firstName = profile?.full_name?.split(' ')[0] || 'Team'

  if (loading) {
    return (
      <main className="min-h-screen bg-[#fbfbf9] flex items-center justify-center">
        <p className="text-xs uppercase tracking-widest text-[#73726c] animate-pulse">
          Loading TWILM OS...
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#fbfbf9] pb-24 sm:pb-12 text-[#171716]">
      <StaffNav userRole={profile?.role || undefined} />

      <div className="max-w-4xl mx-auto px-4 pt-8 space-y-8">
        {/* Header Greeting */}
        <div className="border-b border-[#eaeae5] pb-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
          <div>
            <span className="text-[10px] tracking-[0.25em] uppercase text-[#73726c] font-mono">
              STAFF OS / PERSONAL
            </span>
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight mt-1">
              GOOD{' '}
              {new Date().getHours() < 12
                ? 'MORNING'
                : new Date().getHours() < 17
                ? 'AFTERNOON'
                : 'EVENING'}
              ,{' '}
              <span className="font-serif italic font-normal">
                {firstName.toUpperCase()}
              </span>
            </h1>
            <p className="text-xs text-[#73726c] mt-1">{todayFormatted}</p>
          </div>

          <div className="sm:text-right">
            <span className="text-[10px] tracking-widest uppercase text-[#73726c] block">
              BALI TIME
            </span>
            <span className="font-mono text-xl tracking-tight text-[#171716]">
              {currentTime}
            </span>
          </div>
        </div>

        {/* Primary Action Card */}
        <section className="bg-white border border-[#eaeae5] p-6 rounded-none sm:rounded-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] tracking-widest uppercase text-[#73726c]">
                TODAY&apos;S STATUS
              </span>
              <div className="flex items-center space-x-3">
                <span className="text-xl font-light">
                  {todayRecord?.clock_out_at
                    ? 'Shift Finished'
                    : todayRecord?.clock_in_at
                    ? 'Currently Working'
                    : 'Not Clocked In'}
                </span>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    todayRecord?.clock_out_at
                      ? 'bg-neutral-400'
                      : todayRecord?.clock_in_at
                      ? 'bg-emerald-600 animate-ping'
                      : 'bg-amber-600'
                  }`}
                />
              </div>
              <p className="text-xs text-[#73726c]">
                Location:{' '}
                <span className="font-medium text-[#171716]">
                  {store?.name || 'Store Not Assigned'}
                </span>
              </p>
            </div>

            <Link
              href="/attendance"
              className="inline-flex items-center justify-center px-6 py-3.5 bg-[#0f0f0e] hover:bg-neutral-800 text-white text-xs tracking-widest uppercase transition-all"
            >
              {todayRecord?.clock_out_at
                ? 'View Attendance Record'
                : todayRecord?.clock_in_at
                ? 'Proceed to Clock Out'
                : 'Proceed to Clock In'}
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[#eaeae5] text-xs">
            <div>
              <span className="text-[10px] tracking-wider uppercase text-[#73726c] block">
                CLOCK IN
              </span>
              <span className="font-mono mt-0.5 block text-sm">
                {todayRecord?.clock_in_at
                  ? new Date(todayRecord.clock_in_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '--:--'}
              </span>
            </div>

            <div>
              <span className="text-[10px] tracking-wider uppercase text-[#73726c] block">
                CLOCK OUT
              </span>
              <span className="font-mono mt-0.5 block text-sm">
                {todayRecord?.clock_out_at
                  ? new Date(todayRecord.clock_out_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '--:--'}
              </span>
            </div>

            <div>
              <span className="text-[10px] tracking-wider uppercase text-[#73726c] block">
                WORKING DURATION
              </span>
              <span className="font-mono mt-0.5 block text-sm font-medium">
                {elapsedDuration}
              </span>
            </div>

            <div>
              <span className="text-[10px] tracking-wider uppercase text-[#73726c] block">
                SCHEDULE
              </span>
              <span className="font-mono mt-0.5 block text-sm text-[#73726c]">
                08:40 — 17:40
              </span>
            </div>
          </div>
        </section>

        {/* Operational Overview Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white border border-[#eaeae5] p-5">
            <span className="text-[10px] tracking-widest uppercase text-[#73726c] block">
              ATTENDANCE RECORD
            </span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-light font-mono">
                {todayRecord ? '100%' : 'Active'}
              </span>
              <span className="text-[10px] tracking-wider uppercase text-emerald-800 bg-emerald-50 px-2 py-0.5">
                Good Standing
              </span>
            </div>
            <p className="text-[11px] text-[#73726c] mt-2">
              Monthly overview updated daily.
            </p>
          </div>

          <div className="bg-white border border-[#eaeae5] p-5">
            <span className="text-[10px] tracking-widest uppercase text-[#73726c] block">
              ANNUAL LEAVE
            </span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-light font-mono">12</span>
              <span className="text-xs text-[#73726c]">days remaining</span>
            </div>
            <p className="text-[11px] text-[#73726c] mt-2">
              Leave Center launching in Phase 7.
            </p>
          </div>

          <div className="bg-white border border-[#eaeae5] p-5">
            <span className="text-[10px] tracking-widest uppercase text-[#73726c] block">
              TODAY&apos;S TASKS
            </span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-light font-mono">3</span>
              <span className="text-xs text-[#73726c]">pending check</span>
            </div>
            <p className="text-[11px] text-[#73726c] mt-2">
              Daily checklist arriving in Phase 8.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}