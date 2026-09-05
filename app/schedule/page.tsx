'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import StaffNav from '../components/StaffNav'

interface Store {
  id: string
  name: string
  code: string | null
}

interface ProfileOption {
  id: string
  full_name: string | null
  email: string | null
  store_id: string | null
}

interface ScheduleItem {
  id: string
  user_id: string
  shift_date: string
  shift_start: string | null
  shift_end: string | null
  is_day_off: boolean
  notes: string | null
  store_id: string | null
  stores?: Store | null
  profiles?: ProfileOption | null
}

export default function SchedulePage() {
  const router = useRouter()
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [staffList, setStaffList] = useState<ProfileOption[]>([])
  const [userRole, setUserRole] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [formUserId, setFormUserId] = useState('')
  const [formStoreId, setFormStoreId] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formStart, setFormStart] = useState('08:40')
  const [formEnd, setFormEnd] = useState('17:40')
  const [formIsOff, setFormIsOff] = useState(false)
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('role, store_id')
        .eq('id', session.user.id)
        .maybeSingle()

      const isAdmin = prof?.role === 'admin'
      if (prof && isMounted) {
        setUserRole(prof.role)
        if (prof.store_id && isAdmin) {
          setSelectedStoreFilter(prof.store_id)
        }
      }

      if (isAdmin) {
        const { data: storeData } = await supabase
          .from('stores')
          .select('id, name, code')
          .order('name')
        if (storeData && isMounted) {
          setStores(storeData)
          if (storeData.length > 0) {
            setFormStoreId(prof?.store_id || storeData[0].id)
          }
        }

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email, store_id')
          .order('full_name')
        if (profilesData && isMounted) {
          setStaffList(profilesData)
          if (profilesData.length > 0) {
            setFormUserId(profilesData[0].id)
          }
        }
      }

      const today = new Date().toISOString().split('T')[0]
      let query = supabase
        .from('schedules')
        .select('*, stores(id, name, code), profiles(id, full_name, email, store_id)')
        .gte('shift_date', today)
        .order('shift_date', { ascending: true })

      if (!isAdmin) {
        query = query.eq('user_id', session.user.id).limit(14)
      } else {
        query = query.limit(100)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching schedules:', error)
      } else if (data && isMounted) {
        setSchedules(data as unknown as ScheduleItem[])
      }

      if (isMounted) setLoading(false)
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [router])

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formUserId || !formDate) {
      alert('Pilih nama staf dan tanggal shift.')
      return
    }

    setSubmitting(true)
    const targetStore = formStoreId || (stores[0]?.id ?? null)

    const { data, error } = await supabase
      .from('schedules')
      .upsert(
        {
          user_id: formUserId,
          shift_date: formDate,
          shift_start: formIsOff ? null : `${formStart}:00`,
          shift_end: formIsOff ? null : `${formEnd}:00`,
          is_day_off: formIsOff,
          notes: formNotes || (formIsOff ? 'Day Off' : 'Store Shift'),
          store_id: targetStore,
        },
        { onConflict: 'user_id,shift_date' }
      )
      .select('*, stores(id, name, code), profiles(id, full_name, email, store_id)')
      .single()

    setSubmitting(false)

    if (error) {
      alert('Gagal menyimpan jadwal: ' + error.message)
    } else if (data) {
      setSchedules((prev) => [
        data as unknown as ScheduleItem,
        ...prev.filter((s) => s.id !== data.id),
      ])
      setShowAddForm(false)
      setFormNotes('')
      alert('Jadwal shift berhasil diperbarui.')
    }
  }

  const handleDeleteShift = async (id: string) => {
    if (!confirm('Hapus jadwal shift ini?')) return

    const { error } = await supabase.from('schedules').delete().eq('id', id)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
    } else {
      setSchedules((prev) => prev.filter((s) => s.id !== id))
    }
  }

  const formatShiftTime = (timeStr: string | null) => {
    if (!timeStr) return ''
    return timeStr.slice(0, 5)
  }

  const filteredSchedules = useMemo(() => {
    if (userRole !== 'admin' || selectedStoreFilter === 'all') {
      return schedules
    }
    return schedules.filter(
      (s) =>
        s.store_id === selectedStoreFilter ||
        s.profiles?.store_id === selectedStoreFilter
    )
  }, [schedules, selectedStoreFilter, userRole])

  return (
    <main className="min-h-screen bg-[#fbfbf9] pb-24 sm:pb-12 text-[#171716]">
      <StaffNav userRole={userRole} />

      <div className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
        <div className="border-b border-[#eaeae5] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] tracking-[0.25em] uppercase text-[#73726c] font-mono">
              STAFF OS / ROSTER
            </span>
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight mt-1">
              SHIFT <span className="font-serif italic font-normal">SCHEDULE</span>
            </h1>
          </div>

          {userRole === 'admin' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1.5 bg-white border border-[#eaeae5] px-2.5 py-1.5 text-xs">
                <span className="text-[10px] uppercase text-[#73726c]">Store:</span>
                <select
                  value={selectedStoreFilter}
                  onChange={(e) => setSelectedStoreFilter(e.target.value)}
                  className="bg-transparent text-[#171716] font-medium focus:outline-none cursor-pointer"
                >
                  <option value="all">All Stores</option>
                  {stores.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-3.5 py-1.5 bg-[#171716] text-white text-xs uppercase tracking-wider hover:bg-neutral-800 transition"
              >
                {showAddForm ? 'Close' : '+ Assign Shift'}
              </button>
            </div>
          )}
        </div>

        {userRole === 'admin' && showAddForm && (
          <form
            onSubmit={handleSaveShift}
            className="bg-white border border-[#eaeae5] p-5 space-y-4 shadow-sm"
          >
            <div>
              <span className="text-xs uppercase tracking-wider text-[#73726c] block">
                Assign / Modify Staff Shift
              </span>
              <p className="text-[11px] text-[#73726c]">
                Tentukan jadwal kerja atau hari libur (Day Off) untuk staf.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#73726c] block mb-1">
                  Pilih Staf
                </label>
                <select
                  value={formUserId}
                  onChange={(e) => setFormUserId(e.target.value)}
                  className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none"
                >
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.full_name || st.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                  Toko / Lokasi
                </label>
                <select
                  value={formStoreId}
                  onChange={(e) => setFormStoreId(e.target.value)}
                  className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none"
                >
                  {stores.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                  Tanggal Shift
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                  Jam Masuk (Clock In)
                </label>
                <input
                  type="time"
                  value={formStart}
                  disabled={formIsOff}
                  onChange={(e) => setFormStart(e.target.value)}
                  className="w-full p-2 text-xs bg-[#fbfbf9] border border-[#eaeae5] font-mono disabled:opacity-40"
                />
              </div>

              <div>
                <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                  Jam Keluar (Clock Out)
                </label>
                <input
                  type="time"
                  value={formEnd}
                  disabled={formIsOff}
                  onChange={(e) => setFormEnd(e.target.value)}
                  className="w-full p-2 text-xs bg-[#fbfbf9] border border-[#eaeae5] font-mono disabled:opacity-40"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
              <label className="flex items-center space-x-2 text-xs text-[#171716] cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsOff}
                  onChange={(e) => setFormIsOff(e.target.checked)}
                  className="accent-black w-4 h-4"
                />
                <span className="font-medium">Tandai sebagai DAY OFF (Libur Mingguan)</span>
              </label>

              <input
                type="text"
                placeholder="Catatan shift (opsional, misal: Opening/Closing)"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full sm:w-72 p-2 text-xs bg-[#fbfbf9] border border-[#eaeae5]"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-[#171716] hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs uppercase tracking-widest transition"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Shift'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-xs uppercase tracking-widest text-[#73726c] animate-pulse py-8 text-center">
            Loading Shift Schedule...
          </p>
        ) : filteredSchedules.length === 0 ? (
          <div className="bg-white border border-[#eaeae5] p-8 text-center text-xs text-[#73726c]">
            No upcoming shifts assigned yet. Click + Assign Shift above to add one.
          </div>
        ) : (
          <div className="bg-white border border-[#eaeae5] divide-y divide-[#eaeae5]">
            {filteredSchedules.map((item) => {
              const dateObj = new Date(item.shift_date)
              const dayName = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
                .format(dateObj)
                .toUpperCase()
              const fullDate = new Intl.DateTimeFormat('en-GB', {
                day: 'numeric',
                month: 'short',
              }).format(dateObj)

              const isToday =
                item.shift_date === new Date().toISOString().split('T')[0]

              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    isToday ? 'bg-[#fbfbf9]/70' : 'hover:bg-[#fbfbf9]'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="text-center w-14 border-r border-[#eaeae5] pr-4">
                      <span className="text-xs font-mono font-bold block">
                        {dayName}
                      </span>
                      <span className="text-[11px] text-[#73726c] block">
                        {fullDate}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        {userRole === 'admin' && (
                          <span className="text-xs font-semibold text-[#171716]">
                            {item.profiles?.full_name || 'Staff Member'} —
                          </span>
                        )}

                        {item.is_day_off ? (
                          <span className="text-xs font-medium tracking-wide text-rose-700">
                            DAY OFF
                          </span>
                        ) : (
                          <span className="text-xs font-medium tracking-wide text-[#171716]">
                            {item.stores?.name || 'Store'}
                          </span>
                        )}

                        {isToday && (
                          <span className="text-[9px] uppercase tracking-wider bg-black text-white px-2 py-0.5 font-mono">
                            TODAY
                          </span>
                        )}
                      </div>

                      {item.notes && (
                        <p className="text-[11px] text-[#73726c] mt-0.5">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      {item.is_day_off ? (
                        <span className="text-xs font-mono text-[#73726c] tracking-widest uppercase">
                          REST
                        </span>
                      ) : (
                        <span className="font-mono text-xs sm:text-sm tracking-tight text-[#171716]">
                          {formatShiftTime(item.shift_start)} —{' '}
                          {formatShiftTime(item.shift_end)}
                        </span>
                      )}
                    </div>

                    {userRole === 'admin' && (
                      <button
                        onClick={() => handleDeleteShift(item.id)}
                        className="text-[11px] text-rose-600 hover:text-rose-900 border border-rose-200 px-2 py-1 transition"
                      >
                        Delete
                      </button>
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