'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import StaffNav from '../components/StaffNav'

interface Store {
  id: string
  name: string
  code: string | null
}

interface ScheduleItem {
  id: string
  shift_date: string
  shift_start: string | null
  shift_end: string | null
  is_day_off: boolean
  notes: string | null
  stores?: Store | null
}

export default function SchedulePage() {
  const router = useRouter()
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [userRole, setUserRole] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSchedule = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()
      if (prof) setUserRole(prof.role)

      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('schedules')
        .select('*, stores(id, name, code)')
        .eq('user_id', session.user.id)
        .gte('shift_date', today)
        .order('shift_date', { ascending: true })
        .limit(14)

      if (error) {
        console.error('Error fetching schedule:', error)
      } else if (data) {
        setSchedules(data)
      }
      setLoading(false)
    }

    loadSchedule()
  }, [router])

  const formatShiftTime = (timeStr: string | null) => {
    if (!timeStr) return ''
    return timeStr.slice(0, 5)
  }

  return (
    <main className="min-h-screen bg-[#fbfbf9] pb-24 sm:pb-12 text-[#171716]">
      <StaffNav userRole={userRole} />

      <div className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
        <div className="border-b border-[#eaeae5] pb-4">
          <span className="text-[10px] tracking-[0.25em] uppercase text-[#73726c] font-mono">
            STAFF OS / ROSTER
          </span>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight mt-1">
            SHIFT <span className="font-serif italic font-normal">SCHEDULE</span>
          </h1>
        </div>

        {loading ? (
          <p className="text-xs uppercase tracking-widest text-[#73726c] animate-pulse py-8 text-center">
            Loading Shift Schedule...
          </p>
        ) : schedules.length === 0 ? (
          <div className="bg-white border border-[#eaeae5] p-8 text-center text-xs text-[#73726c]">
            No upcoming shifts assigned yet. Check back once management publishes the roster.
          </div>
        ) : (
          <div className="bg-white border border-[#eaeae5] divide-y divide-[#eaeae5]">
            {schedules.map((item) => {
              const dateObj = new Date(item.shift_date)
              const dayName = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
                .format(dateObj)
                .toUpperCase()
              const fullDate = new Intl.DateTimeFormat('en-GB', {
                day: 'numeric',
                month: 'short',
              }).format(dateObj)

              const isToday = item.shift_date === new Date().toISOString().split('T')[0]

              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    isToday ? 'bg-[#fbfbf9]/60' : 'hover:bg-[#fbfbf9]'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="text-center w-14 border-r border-[#eaeae5] pr-4">
                      <span className="text-xs font-mono font-bold block">{dayName}</span>
                      <span className="text-[11px] text-[#73726c] block">{fullDate}</span>
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        {item.is_day_off ? (
                          <span className="text-xs font-medium tracking-wide text-[#73726c]">
                            DAY OFF
                          </span>
                        ) : (
                          <span className="text-xs font-medium tracking-wide text-[#171716]">
                            {item.stores?.name || 'Assigned Store'}
                          </span>
                        )}

                        {isToday && (
                          <span className="text-[9px] uppercase tracking-wider bg-black text-white px-2 py-0.5 font-mono">
                            TODAY
                          </span>
                        )}
                      </div>

                      {item.notes && (
                        <p className="text-[11px] text-[#73726c] mt-0.5">{item.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="sm:text-right">
                    {item.is_day_off ? (
                      <span className="text-xs font-mono text-[#73726c] tracking-widest uppercase">
                        REST
                      </span>
                    ) : (
                      <span className="font-mono text-xs sm:text-sm tracking-tight text-[#171716]">
                        {formatShiftTime(item.shift_start)} — {formatShiftTime(item.shift_end)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}