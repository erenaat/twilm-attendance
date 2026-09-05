'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import StaffNav from '../components/StaffNav'

interface ProfileData {
  full_name: string | null
  role: string
  store_id: string | null
  stores?: {
    name: string
  } | null
}

interface AttendanceRecord {
  id: string
  work_date: string
  clock_in_at: string | null
  clock_out_at: string | null
  status: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
  const [pendingTaskCount, setPendingTaskCount] = useState<number>(0)
  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentDate, setCurrentDate] = useState<string>('')
  const [greetingTime, setGreetingTime] = useState<string>('DAY')

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const timeStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Makassar',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now)

      const dateStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Makassar',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now)

      setCurrentTime(timeStr)
      setCurrentDate(dateStr)

      const hour = parseInt(timeStr.split(':')[0], 10)
      if (hour >= 4 && hour < 12) setGreetingTime('MORNING')
      else if (hour >= 12 && hour < 17) setGreetingTime('AFTERNOON')
      else setGreetingTime('EVENING')
    }

    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let isMounted = true

    const fetchDashboardData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      const { data: profData } = await supabase
        .from('profiles')
        .select('full_name, role, store_id, stores(name)')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profData && isMounted) {
        setProfile(profData as unknown as ProfileData)
      }

      const today = new Date().toISOString().split('T')[0]
      const { data: attData } = await supabase
        .from('attendance')
        .select('id, work_date, clock_in_at, clock_out_at, status')
        .eq('user_id', session.user.id)
        .eq('work_date', today)
        .maybeSingle()

      if (attData && isMounted) {
        setTodayRecord(attData)
      }

      const { count: taskCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .or(`assigned_to.eq.${session.user.id},assigned_to.is.null`)
        .eq('status', 'pending')

      if (isMounted) {
        setPendingTaskCount(taskCount ?? 0)
      }
    }

    fetchDashboardData()

    return () => {
      isMounted = false
    }
  }, [router])

  // Pure derived state — no effect or setState required
  const shiftDuration = (() => {
    if (!todayRecord?.clock_in_at) return '0h 0m'
    const start = new Date(todayRecord.clock_in_at).getTime()
    const end = todayRecord.clock_out_at
      ? new Date(todayRecord.clock_out_at).getTime()
      : currentTime
      ? new Date().getTime()
      : start
    const diffMins = Math.max(0, Math.floor((end - start) / (1000 * 60)))
    const hrs = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return `${hrs}h ${mins}m`
  })()

  const formatClock = (timestamp: string | null) => {
    if (!timestamp) return '--:--'
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const displayName = profile?.full_name?.split(' ')[0] || 'TEAM'

  return (
    <main className="min-h-screen bg-[#fbfbf9] pb-32 md:pb-16 text-[#171716]">
      <StaffNav userRole={profile?.role} />

      <div className="max-w-4xl mx-auto px-4 pt-6 md:pt-8 space-y-6">
        <div className="border-b border-[#eaeae5] pb-5">
          <span className="text-[10px] tracking-[0.25em] uppercase text-[#73726c] font-mono">
            STAFF OS / PERSONAL
          </span>
          <h1 className="text-2xl sm:text-4xl font-light tracking-tight mt-1 break-words">
            GOOD {greetingTime},{' '}
            <span className="font-serif italic font-normal">{displayName}</span>
          </h1>
          <p className="text-xs text-[#73726c] mt-1 tracking-wide">{currentDate}</p>

          <div className="mt-3 inline-flex flex-col">
            <span className="text-[9px] uppercase tracking-widest text-[#73726c] font-mono">
              BALI TIME
            </span>
            <span className="text-xl sm:text-2xl font-mono tracking-tight font-light mt-0.5">
              {currentTime || '00:00:00'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#eaeae5] p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#eaeae5] pb-4">
            <div>
              <span className="text-[10px] tracking-widest uppercase text-[#73726c] block">
                TODAY&apos;S STATUS
              </span>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-lg sm:text-xl font-normal tracking-tight">
                  {!todayRecord?.clock_in_at
                    ? 'Not Clocked In'
                    : todayRecord.clock_out_at
                    ? 'Shift Finished'
                    : 'Active Shift'}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    !todayRecord?.clock_in_at
                      ? 'bg-neutral-300'
                      : todayRecord.clock_out_at
                      ? 'bg-neutral-400'
                      : 'bg-emerald-500 animate-pulse'
                  }`}
                />
              </div>
              <span className="text-xs text-[#73726c] mt-0.5 block">
                Location: {profile?.stores?.name || 'Office / Unassigned'}
              </span>
            </div>

            <Link
              href="/attendance"
              className="px-5 py-3 bg-[#171716] hover:bg-neutral-800 text-white text-xs uppercase tracking-widest transition text-center"
            >
              {!todayRecord?.clock_in_at
                ? 'Clock In Now'
                : todayRecord.clock_out_at
                ? 'View Attendance Record'
                : 'Clock Out Shift'}
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            <div>
              <span className="text-[10px] tracking-wider uppercase text-[#73726c] block">
                CLOCK IN
              </span>
              <span className="text-sm sm:text-base font-mono font-light mt-1 block">
                {formatClock(todayRecord?.clock_in_at || null)}
              </span>
            </div>

            <div>
              <span className="text-[10px] tracking-wider uppercase text-[#73726c] block">
                CLOCK OUT
              </span>
              <span className="text-sm sm:text-base font-mono font-light mt-1 block">
                {formatClock(todayRecord?.clock_out_at || null)}
              </span>
            </div>

            <div>
              <span className="text-[10px] tracking-wider uppercase text-[#73726c] block">
                WORKING DURATION
              </span>
              <span className="text-sm sm:text-base font-mono font-light mt-1 block">
                {shiftDuration}
              </span>
            </div>

            <div>
              <span className="text-[10px] tracking-wider uppercase text-[#73726c] block">
                SCHEDULE
              </span>
              <span className="text-sm sm:text-base font-mono font-light mt-1 block">
                08:40 — 17:40
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/attendance"
            className="bg-white border border-[#eaeae5] p-5 hover:border-black transition-colors block"
          >
            <div className="flex justify-between items-start">
              <span className="text-[10px] tracking-widest uppercase text-[#73726c]">
                ATTENDANCE RECORD
              </span>
              <span className="text-[9px] uppercase px-1.5 py-0.5 bg-emerald-50 text-emerald-800 font-mono">
                GOOD STANDING
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-light font-mono">100%</span>
              <p className="text-[11px] text-[#73726c] mt-1">Verified on-time check-in</p>
            </div>
          </Link>

          <Link
            href="/tasks"
            className="bg-white border border-[#eaeae5] p-5 hover:border-black transition-colors block"
          >
            <div className="flex justify-between items-start">
              <span className="text-[10px] tracking-widest uppercase text-[#73726c]">
                STORE TASKS
              </span>
              <span className="text-[9px] uppercase px-1.5 py-0.5 bg-amber-50 text-amber-800 font-mono">
                TODAY
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-light font-mono">{pendingTaskCount}</span>
              <p className="text-[11px] text-[#73726c] mt-1">Pending checklist items</p>
            </div>
          </Link>

          <Link
            href="/leave"
            className="bg-white border border-[#eaeae5] p-5 hover:border-black transition-colors block"
          >
            <div className="flex justify-between items-start">
              <span className="text-[10px] tracking-widest uppercase text-[#73726c]">
                LEAVE BALANCE
              </span>
              <span className="text-[9px] uppercase px-1.5 py-0.5 bg-neutral-100 text-[#171716] font-mono">
                ANNUAL
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-light font-mono">12</span>
              <p className="text-[11px] text-[#73726c] mt-1">Days remaining this year</p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  )
}