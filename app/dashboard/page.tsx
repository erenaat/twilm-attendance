'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import StaffNav from '../components/StaffNav'

interface ProfileData {
  full_name: string | null
  role: string
  employee_code?: string | null
  store_id: string | null
  stores?: {
    name: string
  } | {
    name: string
  }[] | null
}

interface AttendanceRecord {
  id: string
  work_date: string
  clock_in_at: string | null
  clock_out_at: string | null
  punctuality_status?: string | null
  status: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
  const [pendingTaskCount, setPendingTaskCount] = useState<number>(0)
  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentDate, setCurrentDate] = useState<string>('')
  const [greetingTime, setGreetingTime] = useState<string>('MORNING')
  const [scheduledDisplay, setScheduledDisplay] = useState<string>('09:00 — 17:00')
  const [punctualityRate, setPunctualityRate] = useState<number>(100)

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
      if (hour < 12) {
        setGreetingTime('MORNING')
      } else if (hour < 18) {
        setGreetingTime('AFTERNOON')
      } else {
        setGreetingTime('EVENING')
      }
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
        .select('full_name, role, employee_code, store_id, stores(name)')
        .eq('id', session.user.id)
        .maybeSingle()

      let storeName = ''
      if (profData && isMounted) {
        setProfile(profData as unknown as ProfileData)
        const resolvedStore = Array.isArray(profData.stores)
          ? profData.stores[0]
          : profData.stores
        storeName = resolvedStore?.name?.toLowerCase() || ''
      }

      const isOffice = !storeName || storeName.includes('office') || storeName.includes('hq') || storeName.includes('headquarter')
      const today = new Date().toISOString().split('T')[0]

      // Today attendance
      const { data: attData } = await supabase
        .from('attendance')
        .select('id, work_date, clock_in_at, clock_out_at, punctuality_status, status')
        .eq('user_id', session.user.id)
        .eq('work_date', today)
        .maybeSingle()

      if (attData && isMounted) {
        setTodayRecord(attData)
      }

      // Schedule resolution
      const { data: schData } = await supabase
        .from('schedules')
        .select('shift_start, shift_end, is_day_off')
        .eq('user_id', session.user.id)
        .eq('shift_date', today)
        .maybeSingle()

      let activeStartMins = isOffice ? 9 * 60 : 9 * 60 + 40

      if (schData && isMounted) {
        if (schData.is_day_off) {
          setScheduledDisplay('DAY OFF')
        } else if (schData.shift_start && schData.shift_end) {
          setScheduledDisplay(`${schData.shift_start.slice(0, 5)} — ${schData.shift_end.slice(0, 5)}`)
          const [shH, shM] = schData.shift_start.split(':').map(Number)
          activeStartMins = shH * 60 + shM
        }
      } else if (isMounted) {
        if (isOffice) {
          setScheduledDisplay('09:00 — 17:00')
          activeStartMins = 9 * 60
        } else {
          const nowHour = new Date().getHours()
          if (nowHour >= 11) {
            setScheduledDisplay('11:40 — 20:00')
            activeStartMins = 11 * 60 + 40
          } else {
            setScheduledDisplay('09:40 — 18:00')
            activeStartMins = 9 * 60 + 40
          }
        }
      }

      // Punctuality rate
      const { data: allAtt } = await supabase
        .from('attendance')
        .select('work_date, clock_in_at, punctuality_status')
        .eq('user_id', session.user.id)
        .not('clock_in_at', 'is', null)

      if (allAtt && allAtt.length > 0 && isMounted) {
        const onTimeCount = allAtt.filter((record) => {
          if (record.punctuality_status === 'late') return false
          if (record.clock_in_at) {
            const clockDate = new Date(record.clock_in_at)
            const timeParts = new Intl.DateTimeFormat('en-GB', {
              timeZone: 'Asia/Makassar',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).format(clockDate).split(':')
            const clockInMins = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10)
            const graceThreshold = (record.work_date === today ? activeStartMins : (isOffice ? 9 * 60 : 9 * 60 + 40)) + 5
            if (clockInMins > graceThreshold) return false
          }
          return true
        }).length

        setPunctualityRate(Math.round((onTimeCount / allAtt.length) * 100))
      } else if (isMounted) {
        setPunctualityRate(100)
      }

      // Pending tasks
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

  const shiftDuration = (() => {
    if (!todayRecord?.clock_in_at) return '0h 0m'
    const start = new Date(todayRecord.clock_in_at).getTime()
    const end = todayRecord.clock_out_at
      ? new Date(todayRecord.clock_out_at).getTime()
      : currentTime
      ? new Date().getTime()
      : start
    const diffMins = Math.max(0, Math.floor((end - start) / (1000 * 60)))
    return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`
  })()

  const formatClock = (timestamp: string | null) => {
    if (!timestamp) return '--:--'
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const resolvedStoreName = (() => {
    if (!profile?.stores) return 'Office / Headquarter'
    return Array.isArray(profile.stores) ? profile.stores[0]?.name : profile.stores.name
  })()

  const displayName = profile?.full_name?.split(' ')[0] || 'Associate'

  return (
    <main className="min-h-screen bg-[#FAF8F5] pb-32 md:pb-16 text-[#191C1A]">
      <StaffNav userRole={profile?.role} />

      <div className="max-w-5xl mx-auto px-4 pt-6 md:pt-8 space-y-6">
        {/* Luxury Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#191C1A] via-[#242A27] to-[#141615] text-white p-7 sm:p-9 shadow-xl border border-[#E3DDD1]">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#C26D53]/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-[#9E7B56]/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] tracking-[0.3em] uppercase text-[#D8C7B5] font-mono">
                  STAFF OS / PERSONAL ATELIER
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#C26D53]" />
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/10 text-[#FAF7F2] border border-white/15">
                  {profile?.role || 'STAFF'}
                </span>
                {profile?.employee_code && (
                  <span className="text-[10px] uppercase font-mono text-[#D8C7B5]">
                    #{profile.employee_code}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-5xl font-light tracking-tight mt-3 text-[#FAF7F2]">
                GOOD {greetingTime},{' '}
                <span className="font-serif italic font-normal text-[#E8C5A8]">{displayName}</span>
              </h1>
              <p className="text-xs text-[#B5AEA4] mt-1.5 tracking-wide">
                {currentDate} • Operating from <span className="text-[#FAF7F2] font-medium">{resolvedStoreName}</span>
              </p>
            </div>

            {/* Bali Time Pill */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-left md:text-right min-w-[200px]">
              <div className="flex items-center md:justify-end space-x-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C26D53] animate-ping" />
                <span className="text-[9px] uppercase tracking-widest text-[#D8C7B5] font-mono">
                  BALI WITA
                </span>
              </div>
              <span className="text-2xl sm:text-3xl font-mono font-light text-white tracking-tight block">
                {currentTime || '00:00:00'}
              </span>
              <span className="text-[10px] font-mono text-[#C2B7A8] block mt-1">
                Store Schedule: {scheduledDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Live Shift Card */}
        <div className="rounded-2xl bg-white border border-[#E8E2D5] p-6 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2D5] pb-5">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#FBF0EC] border border-[#F2D7CE] flex items-center justify-center text-[#C26D53] text-base">
                ⏱
              </div>
              <div>
                <span className="text-[10px] tracking-widest uppercase text-[#8A857C] font-mono block">
                  ACTIVE SHIFT STATUS
                </span>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="text-lg sm:text-xl font-medium tracking-tight text-[#191C1A]">
                    {!todayRecord?.clock_in_at
                      ? 'Ready to Clock In'
                      : todayRecord.clock_out_at
                      ? 'Shift Completed for Today'
                      : 'Currently On Floor'}
                  </span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      !todayRecord?.clock_in_at
                        ? 'bg-[#DCD6C8]'
                        : todayRecord.clock_out_at
                        ? 'bg-[#2E473B]'
                        : 'bg-[#C26D53] animate-pulse'
                    }`}
                  />
                </div>
              </div>
            </div>

            <Link
              href="/attendance"
              className="px-6 py-3 rounded-full bg-[#191C1A] hover:bg-[#C26D53] text-white text-xs uppercase tracking-[0.2em] font-medium transition-all shadow-sm text-center"
            >
              {!todayRecord?.clock_in_at
                ? '✦ Clock In Now'
                : todayRecord.clock_out_at
                ? 'View Logbook'
                : 'Complete & Clock Out'}
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E2D5]/70">
              <span className="text-[10px] tracking-wider uppercase text-[#8A857C] font-mono block">
                CLOCK IN
              </span>
              <span className="text-sm sm:text-base font-mono font-medium text-[#191C1A] mt-1 block">
                {formatClock(todayRecord?.clock_in_at || null)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E2D5]/70">
              <span className="text-[10px] tracking-wider uppercase text-[#8A857C] font-mono block">
                CLOCK OUT
              </span>
              <span className="text-sm sm:text-base font-mono font-medium text-[#191C1A] mt-1 block">
                {formatClock(todayRecord?.clock_out_at || null)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E2D5]/70">
              <span className="text-[10px] tracking-wider uppercase text-[#8A857C] font-mono block">
                FLOOR TIME
              </span>
              <span className="text-sm sm:text-base font-mono font-medium text-[#191C1A] mt-1 block">
                {shiftDuration}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E2D5]/70">
              <span className="text-[10px] tracking-wider uppercase text-[#8A857C] font-mono block">
                SCHEDULE
              </span>
              <span className="text-sm sm:text-base font-mono font-medium text-[#191C1A] mt-1 block">
                {scheduledDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Triple Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/attendance#history"
            className="group rounded-2xl bg-white border border-[#E8E2D5] p-5 hover:border-[#C26D53] hover:shadow-md transition-all block relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <span className="text-[10px] tracking-widest uppercase text-[#8A857C] font-mono">
                PUNCTUALITY
              </span>
              <span
                className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-mono font-medium ${
                  punctualityRate >= 90
                    ? 'bg-[#EDF4F0] text-[#2E473B] border border-[#CFE2D7]'
                    : 'bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4]'
                }`}
              >
                {punctualityRate >= 90 ? 'PERFECT STANDING' : 'NEEDS ATTENTION'}
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-light font-mono text-[#191C1A] group-hover:text-[#C26D53] transition-colors">
                {punctualityRate}%
              </span>
              <p className="text-[11px] text-[#8A857C] mt-1">Tap to review shift history ✦</p>
            </div>
          </Link>

          <Link
            href="/tasks"
            className="group rounded-2xl bg-white border border-[#E8E2D5] p-5 hover:border-[#2E473B] hover:shadow-md transition-all block"
          >
            <div className="flex justify-between items-start">
              <span className="text-[10px] tracking-widest uppercase text-[#8A857C] font-mono">
                STORE RITUALS
              </span>
              <span className="text-[9px] uppercase px-2 py-0.5 rounded-full bg-[#FAF0E6] text-[#9E7B56] border border-[#EEDCC7] font-mono font-medium">
                ACTIVE TODAY
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-light font-mono text-[#191C1A] group-hover:text-[#2E473B] transition-colors">
                {pendingTaskCount}
              </span>
              <p className="text-[11px] text-[#8A857C] mt-1">Checklist items to inspect ✦</p>
            </div>
          </Link>

          <Link
            href="/leave"
            className="group rounded-2xl bg-white border border-[#E8E2D5] p-5 hover:border-[#9E7B56] hover:shadow-md transition-all block"
          >
            <div className="flex justify-between items-start">
              <span className="text-[10px] tracking-widest uppercase text-[#8A857C] font-mono">
                LEAVE ENTITLEMENT
              </span>
              <span className="text-[9px] uppercase px-2 py-0.5 rounded-full bg-[#F2EFE8] text-[#635E56] font-mono">
                ANNUAL
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-light font-mono text-[#191C1A] group-hover:text-[#9E7B56] transition-colors">
                12
              </span>
              <p className="text-[11px] text-[#8A857C] mt-1">Available balance days ✦</p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  )
}