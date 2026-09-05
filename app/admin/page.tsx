'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../lib/supabase'
import StaffNav from '../components/StaffNav'

interface ProfileSummary {
  id: string
  full_name: string | null
  email: string | null
  role: string
  employee_code: string | null
  store_id: string | null
  stores?: {
    id: string
    name: string
  } | null
}

interface StoreSummary {
  id: string
  name: string
}

interface AttendanceRecord {
  id: string
  work_date: string
  clock_in_at: string | null
  clock_in_lat: number | null
  clock_in_lng: number | null
  clock_in_accuracy: number | null
  clock_in_photo_url: string | null
  clock_in_address: string | null
  clock_out_at: string | null
  clock_out_lat: number | null
  clock_out_lng: number | null
  clock_out_accuracy: number | null
  clock_out_photo_url: string | null
  clock_out_address: string | null
  status: string
  store_id: string | null
  punctuality_status?: string | null
  late_minutes?: number | null
  overtime_minutes?: number | null
  handover_notes?: string | null
  cash_drawer_balance?: string | null
  profiles: ProfileSummary | null
  stores: StoreSummary | null
}

interface LeaveRequestItem {
  id: string
  user_id: string
  leave_type: string
  start_date: string
  end_date: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  profiles: ProfileSummary | null
}

interface ScheduleItem {
  id: string
  user_id: string
  store_id: string | null
  shift_date: string
  shift_start: string | null
  shift_end: string | null
  is_day_off: boolean
  notes: string | null
  profiles: ProfileSummary | null
  stores: StoreSummary | null
}

interface TaskItem {
  id: string
  title: string
  description: string | null
  store_id: string | null
  due_date: string | null
  priority: 'low' | 'normal' | 'high'
  status: 'pending' | 'completed'
  stores: StoreSummary | null
}

interface AnnouncementItem {
  id: string
  title: string
  content: string
  store_id: string | null
  priority: 'normal' | 'urgent'
  created_at: string
  stores: StoreSummary | null
}

export default function AdminPage() {
  const router = useRouter()
  const [currentAdminProfile, setCurrentAdminProfile] = useState<ProfileSummary | null>(null)
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [allStaffList, setAllStaffList] = useState<ProfileSummary[]>([])

  // Data states
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestItem[]>([])
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [loading, setLoading] = useState(true)

  // Navigation & Filtering
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<
    'attendance' | 'leave' | 'schedule' | 'tasks' | 'news' | 'team'
  >('attendance')

  // Form Modals / Expanders
  const [showRosterForm, setShowRosterForm] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showNewsForm, setShowNewsForm] = useState(false)

  // Roster form fields
  const [newRosterUser, setNewRosterUser] = useState('')
  const [newRosterDate, setNewRosterDate] = useState('')
  const [newRosterStart, setNewRosterStart] = useState('08:40')
  const [newRosterEnd, setNewRosterEnd] = useState('17:40')
  const [newRosterIsOff, setNewRosterIsOff] = useState(false)
  const [newRosterNotes, setNewRosterNotes] = useState('')

  // Task form fields
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDesc, setNewTaskDesc] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'normal' | 'high'>('normal')

  // News form fields
  const [newNewsTitle, setNewNewsTitle] = useState('')
  const [newNewsContent, setNewNewsContent] = useState('')
  const [newNewsPriority, setNewNewsPriority] = useState<'normal' | 'urgent'>('normal')

  // Inline team edit state
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
  const [editEmployeeCode, setEditEmployeeCode] = useState('')
  const [editRole, setEditRole] = useState<'staff' | 'admin'>('staff')
  const [editStoreId, setEditStoreId] = useState<string>('')
  const [savingStaff, setSavingStaff] = useState(false)

  const fetchAllAdminData = useCallback(async () => {
    // 1. Fetch Stores
    const { data: storeData } = await supabase.from('stores').select('id, name').order('name')
    if (storeData) setStores(storeData)

    // 2. Fetch Profiles
    const { data: staffData } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, employee_code, store_id, stores(id, name)')
      .order('full_name')
    if (staffData) {
      setAllStaffList(staffData as unknown as ProfileSummary[])
      setNewRosterUser((prev) => prev || (staffData.length > 0 ? staffData[0].id : ''))
    }

    // 3. Fetch Attendance
    const { data: attData } = await supabase
      .from('attendance')
      .select('*, profiles(id, full_name, email, store_id), stores(id, name)')
      .order('work_date', { ascending: false })
      .limit(100)
    if (attData) setRecords(attData as unknown as AttendanceRecord[])

    // 4. Fetch Leave
    const { data: lData } = await supabase
      .from('leave_requests')
      .select('*, profiles(id, full_name, email, store_id)')
      .order('created_at', { ascending: false })
    if (lData) setLeaveRequests(lData as unknown as LeaveRequestItem[])

    // 5. Fetch Schedules
    const { data: schData } = await supabase
      .from('schedules')
      .select('*, profiles(id, full_name, email, store_id), stores(id, name)')
      .order('shift_date', { ascending: false })
      .limit(60)
    if (schData) setSchedules(schData as unknown as ScheduleItem[])

    // 6. Fetch Tasks
    const { data: tskData } = await supabase
      .from('tasks')
      .select('*, stores(id, name)')
      .order('created_at', { ascending: false })
    if (tskData) setTasks(tskData as unknown as TaskItem[])

    // 7. Fetch News
    const { data: newsData } = await supabase
      .from('announcements')
      .select('*, stores(id, name)')
      .order('created_at', { ascending: false })
    if (newsData) setAnnouncements(newsData as unknown as AnnouncementItem[])

    setLoading(false)
  }, [])

  useEffect(() => {
    let isMounted = true

    const checkAuthAndLoad = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (prof?.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      if (isMounted) {
        setCurrentAdminProfile(prof as ProfileSummary)
        if (prof.store_id) {
          setSelectedStoreFilter(prof.store_id)
        }
      }

      await fetchAllAdminData()
    }

    checkAuthAndLoad()

    return () => {
      isMounted = false
    }
  }, [router, fetchAllAdminData])

  // Leave Actions
  const handleLeaveDecision = async (id: string, decision: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('leave_requests')
      .update({ status: decision, reviewed_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      alert('Error updating leave: ' + error.message)
    } else {
      setLeaveRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: decision } : r))
      )
    }
  }

  // Create Roster Shift
  const handleCreateRoster = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRosterUser || !newRosterDate) {
      alert('Select staff member and shift date.')
      return
    }

    const assignedStoreId =
      selectedStoreFilter !== 'all'
        ? selectedStoreFilter
        : currentAdminProfile?.store_id || stores[0]?.id || null

    const { data, error } = await supabase
      .from('schedules')
      .upsert(
        {
          user_id: newRosterUser,
          shift_date: newRosterDate,
          shift_start: newRosterIsOff ? null : `${newRosterStart}:00`,
          shift_end: newRosterIsOff ? null : `${newRosterEnd}:00`,
          is_day_off: newRosterIsOff,
          notes: newRosterNotes || (newRosterIsOff ? 'Day Off' : 'Regular Shift'),
          store_id: assignedStoreId,
        },
        { onConflict: 'user_id,shift_date' }
      )
      .select('*, profiles(id, full_name, email, store_id), stores(id, name)')
      .single()

    if (error) {
      alert('Failed to save shift: ' + error.message)
    } else if (data) {
      setSchedules((prev) => [
        data as unknown as ScheduleItem,
        ...prev.filter((s) => s.id !== data.id),
      ])
      setShowRosterForm(false)
      setNewRosterNotes('')
      alert('Shift assigned successfully.')
    }
  }

  // Delete Roster Shift
  const handleDeleteRoster = async (id: string) => {
    if (!confirm('Delete this shift?')) return
    const { error } = await supabase.from('schedules').delete().eq('id', id)
    if (!error) {
      setSchedules((prev) => prev.filter((s) => s.id !== id))
    }
  }

  // Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle) return

    const targetStoreId =
      selectedStoreFilter !== 'all' ? selectedStoreFilter : currentAdminProfile?.store_id || null

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: newTaskTitle,
        description: newTaskDesc,
        priority: newTaskPriority,
        store_id: targetStoreId,
        status: 'pending',
      })
      .select('*, stores(id, name)')
      .single()

    if (error) {
      alert('Failed to create task: ' + error.message)
    } else if (data) {
      setTasks((prev) => [data as unknown as TaskItem, ...prev])
      setShowTaskForm(false)
      setNewTaskTitle('')
      setNewTaskDesc('')
    }
  }

  // Delete Task
  const handleDeleteTask = async (id: string) => {
    if (!confirm('Delete this task?')) return
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== id))
    }
  }

  // Create Announcement
  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNewsTitle || !newNewsContent) return

    const targetStoreId =
      selectedStoreFilter !== 'all' ? selectedStoreFilter : currentAdminProfile?.store_id || null

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title: newNewsTitle,
        content: newNewsContent,
        priority: newNewsPriority,
        store_id: targetStoreId,
      })
      .select('*, stores(id, name)')
      .single()

    if (error) {
      alert('Failed to publish broadcast: ' + error.message)
    } else if (data) {
      setAnnouncements((prev) => [data as unknown as AnnouncementItem, ...prev])
      setShowNewsForm(false)
      setNewNewsTitle('')
      setNewNewsContent('')
    }
  }

  // Delete News
  const handleDeleteNews = async (id: string) => {
    if (!confirm('Delete this broadcast?')) return
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (!error) {
      setAnnouncements((prev) => prev.filter((n) => n.id !== id))
    }
  }

  // Edit Team Member Handlers
  const startEditStaff = (staff: ProfileSummary) => {
    setEditingStaffId(staff.id)
    setEditEmployeeCode(staff.employee_code || '')
    setEditRole((staff.role as 'staff' | 'admin') || 'staff')
    setEditStoreId(staff.store_id || '')
  }

  const cancelEditStaff = () => {
    setEditingStaffId(null)
  }

  const handleSaveStaff = async (staffId: string) => {
    setSavingStaff(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        employee_code: editEmployeeCode.trim() || null,
        role: editRole,
        store_id: editStoreId || null,
      })
      .eq('id', staffId)

    setSavingStaff(false)

    if (error) {
      alert('Failed to update staff: ' + error.message)
    } else {
      setAllStaffList((prev) =>
        prev.map((s) =>
          s.id === staffId
            ? {
                ...s,
                employee_code: editEmployeeCode.trim() || null,
                role: editRole,
                store_id: editStoreId || null,
                stores: stores.find((st) => st.id === editStoreId) || null,
              }
            : s
        )
      )
      setEditingStaffId(null)
    }
  }

  // Stable filter check
  const checkMatchesStore = useCallback(
    (storeId: string | null | undefined, staffStoreId?: string | null) => {
      if (selectedStoreFilter === 'all') return true
      return storeId === selectedStoreFilter || staffStoreId === selectedStoreFilter
    },
    [selectedStoreFilter]
  )

  const filteredAttendance = useMemo(() => {
    return records.filter((r) => checkMatchesStore(r.store_id, r.profiles?.store_id))
  }, [records, checkMatchesStore])

  const filteredLeave = useMemo(() => {
    return leaveRequests.filter((l) => checkMatchesStore(l.profiles?.store_id))
  }, [leaveRequests, checkMatchesStore])

  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => checkMatchesStore(s.store_id, s.profiles?.store_id))
  }, [schedules, checkMatchesStore])

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => checkMatchesStore(t.store_id))
  }, [tasks, checkMatchesStore])

  const filteredNews = useMemo(() => {
    return announcements.filter((n) => checkMatchesStore(n.store_id))
  }, [announcements, checkMatchesStore])

  const filteredStaffList = useMemo(() => {
    if (selectedStoreFilter === 'all') return allStaffList
    return allStaffList.filter((s) => s.store_id === selectedStoreFilter)
  }, [allStaffList, selectedStoreFilter])

  // Export Organized & Payroll-Ready Spreadsheet
  const exportToCSV = () => {
    if (filteredAttendance.length === 0) {
      alert('No attendance data to export for this selection.')
      return
    }

    const headers = [
      'Date',
      'Employee Code',
      'Staff Name',
      'Email',
      'Store Branch',
      'Clock In',
      'Punctuality',
      'Late (Mins)',
      'Clock Out',
      'Overtime (Mins)',
      'Total Hours Worked',
      'Closing Cash Drawer',
      'Shift Handover Notes',
      'Status',
    ]

    const rows = filteredAttendance.map((r) => {
      // Clean time strings
      const clockIn = r.clock_in_at
        ? new Date(r.clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '--:--'
      const clockOut = r.clock_out_at
        ? new Date(r.clock_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '--:--'

      // Calculate numeric hours worked for easy Excel formulas
      let hoursWorked = '0.00'
      if (r.clock_in_at && r.clock_out_at) {
        const diffMs = new Date(r.clock_out_at).getTime() - new Date(r.clock_in_at).getTime()
        const totalHrs = Math.max(0, diffMs / (1000 * 60 * 60))
        hoursWorked = totalHrs.toFixed(2)
      }

      // Clean notes to avoid breaking CSV rows
      const cleanHandover = (r.handover_notes || '')
        .replace(/(\r\n|\n|\r)/gm, ' ')
        .replace(/"/g, '""')
        .trim()
      const cleanCash = (r.cash_drawer_balance || '')
        .replace(/(\r\n|\n|\r)/gm, ' ')
        .replace(/"/g, '""')
        .trim()

      return [
        `"${r.work_date}"`,
        `"${r.profiles?.employee_code || '-'}"`,
        `"${r.profiles?.full_name || 'Staff'}"`,
        `"${r.profiles?.email || ''}"`,
        `"${r.stores?.name || 'Office'}"`,
        `"${clockIn}"`,
        `"${r.punctuality_status === 'late' ? 'LATE' : r.clock_in_at ? 'ON-TIME' : '-'}"`,
        `"${r.late_minutes || 0}"`,
        `"${clockOut}"`,
        `"${r.overtime_minutes || 0}"`,
        `"${hoursWorked}"`,
        `"${cleanCash || '-'}"`,
        `"${cleanHandover || '-'}"`,
        `"${r.clock_out_at ? 'COMPLETED' : r.status.toUpperCase()}"`,
      ]
    })

    // Prepend UTF-8 BOM (\uFEFF) so Excel respects formatting, accents & columns
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    const branchName =
      selectedStoreFilter === 'all'
        ? 'ALL_STORES'
        : stores.find((s) => s.id === selectedStoreFilter)?.name.replace(/\s+/g, '_') || 'STORE'

    const todayStr = new Date().toISOString().split('T')[0]
    link.setAttribute('download', `TWILM_Attendance_${branchName}_${todayStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const formatTime = (ts: string | null) =>
    ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'

  return (
    <main className="min-h-screen bg-[#fbfbf9] pb-32 md:pb-16 text-[#171716]">
      <StaffNav userRole="admin" />

      <div className="max-w-6xl mx-auto px-4 pt-8 space-y-6">
        {/* Header Management Strip */}
        <div className="border-b border-[#eaeae5] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] tracking-[0.25em] uppercase text-[#73726c] font-mono">
              STORE MANAGEMENT OS
            </span>
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight mt-1">
              STORE <span className="font-serif italic font-normal">ADMINISTRATION</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Store Switcher */}
            <div className="flex items-center space-x-2 bg-white border border-[#eaeae5] px-3 py-1.5">
              <span className="text-[10px] uppercase tracking-wider text-[#73726c]">Store:</span>
              <select
                value={selectedStoreFilter}
                onChange={(e) => setSelectedStoreFilter(e.target.value)}
                className="text-xs bg-transparent text-[#171716] font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">All Boutiques & Office</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={exportToCSV}
              className="px-3.5 py-1.5 bg-white border border-[#eaeae5] text-[11px] uppercase tracking-wider hover:bg-neutral-50 transition"
            >
              Export Sheet
            </button>
            <button
              onClick={fetchAllAdminData}
              className="px-3.5 py-1.5 bg-[#171716] text-white text-[11px] uppercase tracking-wider hover:bg-neutral-800 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#eaeae5] space-x-6 text-xs uppercase tracking-wider overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`pb-2 transition-colors whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-[#73726c]'
            }`}
          >
            Attendance ({filteredAttendance.length})
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`pb-2 transition-colors whitespace-nowrap ${
              activeTab === 'team'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-[#73726c]'
            }`}
          >
            Team Directory ({filteredStaffList.length})
          </button>
          <button
            onClick={() => setActiveTab('leave')}
            className={`pb-2 transition-colors whitespace-nowrap ${
              activeTab === 'leave'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-[#73726c]'
            }`}
          >
            Leave Approvals ({filteredLeave.filter((l) => l.status === 'pending').length})
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`pb-2 transition-colors whitespace-nowrap ${
              activeTab === 'schedule'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-[#73726c]'
            }`}
          >
            Roster Shifts ({filteredSchedules.length})
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`pb-2 transition-colors whitespace-nowrap ${
              activeTab === 'tasks'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-[#73726c]'
            }`}
          >
            Store Tasks ({filteredTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={`pb-2 transition-colors whitespace-nowrap ${
              activeTab === 'news'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-[#73726c]'
            }`}
          >
            Broadcast News ({filteredNews.length})
          </button>
        </div>

        {/* TAB 1: ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="bg-white border border-[#eaeae5] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#171716]">
                <thead className="bg-[#fbfbf9] text-[10px] uppercase tracking-wider text-[#73726c] border-b border-[#eaeae5]">
                  <tr>
                    <th className="p-3.5">Staff</th>
                    <th className="p-3.5">Store</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Clock In / Punctuality</th>
                    <th className="p-3.5">Selfie</th>
                    <th className="p-3.5">Clock Out / OT</th>
                    <th className="p-3.5">Handover Log</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eaeae5]">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-xs text-[#73726c]">
                        Loading...
                      </td>
                    </tr>
                  ) : filteredAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-xs text-[#73726c]">
                        No logs for this store.
                      </td>
                    </tr>
                  ) : (
                    filteredAttendance.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#fbfbf9]/60">
                        <td className="p-3.5 font-medium whitespace-nowrap">
                          {rec.profiles?.full_name || 'Staff'}
                          <div className="text-[10px] text-[#73726c] font-normal">
                            {rec.profiles?.email}
                          </div>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="text-[10px] tracking-wider uppercase px-2 py-0.5 bg-neutral-100 border border-[#eaeae5]">
                            {rec.stores?.name || 'Unassigned'}
                          </span>
                        </td>
                        <td className="p-3.5 whitespace-nowrap font-mono">{rec.work_date}</td>

                        {/* Clock In + Punctuality Badge */}
                        <td className="p-3.5 whitespace-nowrap font-mono">
                          <div>{formatTime(rec.clock_in_at)}</div>
                          {rec.punctuality_status === 'late' ? (
                            <span className="inline-block text-[9px] uppercase tracking-wider px-1.5 py-0.2 bg-rose-50 text-rose-800 border border-rose-200 mt-0.5">
                              Late ({rec.late_minutes}m)
                            </span>
                          ) : rec.clock_in_at ? (
                            <span className="inline-block text-[9px] uppercase tracking-wider px-1.5 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 mt-0.5">
                              On-Time
                            </span>
                          ) : null}
                        </td>

                        {/* Selfie Preview */}
                        <td className="p-3.5">
                          {rec.clock_in_photo_url ? (
                            <a href={rec.clock_in_photo_url} target="_blank" rel="noreferrer">
                              <div className="relative w-9 h-11 border border-[#eaeae5] overflow-hidden">
                                <Image
                                  src={rec.clock_in_photo_url}
                                  alt="Selfie"
                                  fill
                                  unoptimized
                                  className="object-cover"
                                />
                              </div>
                            </a>
                          ) : (
                            '--'
                          )}
                        </td>

                        {/* Clock Out + Overtime Badge */}
                        <td className="p-3.5 whitespace-nowrap font-mono">
                          <div>{formatTime(rec.clock_out_at)}</div>
                          {rec.overtime_minutes && rec.overtime_minutes > 0 ? (
                            <span className="inline-block text-[9px] uppercase tracking-wider px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 mt-0.5">
                              OT (+{Math.floor(rec.overtime_minutes / 60)}h {rec.overtime_minutes % 60}m)
                            </span>
                          ) : null}
                        </td>

                        {/* Handover Notes & Cash */}
                        <td className="p-3.5 max-w-xs text-[11px] text-[#73726c]">
                          {rec.handover_notes ? (
                            <div>
                              <span className="text-[#171716] block">{rec.handover_notes}</span>
                              {rec.cash_drawer_balance && (
                                <span className="font-mono text-[10px] text-[#8c8b85] block mt-0.5">
                                  Cash: {rec.cash_drawer_balance}
                                </span>
                              )}
                            </div>
                          ) : (
                            '--'
                          )}
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 text-[10px] uppercase font-medium ${
                              rec.clock_out_at
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {rec.clock_out_at ? 'Present' : 'Working'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: TEAM / STAFF DIRECTORY (EDITABLE) */}
        {activeTab === 'team' && (
          <div className="bg-white border border-[#eaeae5] overflow-hidden">
            <div className="p-4 border-b border-[#eaeae5] bg-[#fbfbf9]/60 flex justify-between items-center">
              <div>
                <span className="text-xs uppercase tracking-wider font-medium text-[#171716]">
                  Team Directory & Profile Scoping
                </span>
                <p className="text-[11px] text-[#73726c]">
                  Manage staff roles, employee IDs, and assigned store branches directly.
                </p>
              </div>
              <span className="text-[11px] font-mono text-[#73726c]">
                {filteredStaffList.length} Team Members
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#171716]">
                <thead className="bg-[#fbfbf9] text-[10px] uppercase tracking-wider text-[#73726c] border-b border-[#eaeae5]">
                  <tr>
                    <th className="p-3.5">Staff Member</th>
                    <th className="p-3.5">Employee Code</th>
                    <th className="p-3.5">Assigned Store</th>
                    <th className="p-3.5">System Role</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eaeae5]">
                  {filteredStaffList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-xs text-[#73726c]">
                        No team members registered for this store.
                      </td>
                    </tr>
                  ) : (
                    filteredStaffList.map((member) => {
                      const isEditing = editingStaffId === member.id

                      return (
                        <tr key={member.id} className="hover:bg-[#fbfbf9]/40 transition-colors">
                          <td className="p-3.5 font-medium whitespace-nowrap">
                            {member.full_name || 'Staff Member'}
                            <div className="text-[10px] text-[#73726c] font-normal">
                              {member.email}
                            </div>
                          </td>

                          {/* Employee Code */}
                          <td className="p-3.5">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editEmployeeCode}
                                onChange={(e) => setEditEmployeeCode(e.target.value)}
                                placeholder="e.g. TW-BM-01"
                                className="p-1.5 text-xs border border-[#eaeae5] bg-white font-mono w-32 uppercase"
                              />
                            ) : (
                              <span className="font-mono text-xs text-[#171716]">
                                {member.employee_code || (
                                  <span className="text-[#8c8b85] italic">Not set</span>
                                )}
                              </span>
                            )}
                          </td>

                          {/* Assigned Store */}
                          <td className="p-3.5">
                            {isEditing ? (
                              <select
                                value={editStoreId}
                                onChange={(e) => setEditStoreId(e.target.value)}
                                className="p-1.5 text-xs border border-[#eaeae5] bg-white text-[#171716]"
                              >
                                <option value="">Global / Office</option>
                                {stores.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[10px] tracking-wider uppercase px-2 py-0.5 bg-neutral-100 border border-[#eaeae5] font-mono">
                                {member.stores?.name || 'Office / Unassigned'}
                              </span>
                            )}
                          </td>

                          {/* Role */}
                          <td className="p-3.5">
                            {isEditing ? (
                              <select
                                value={editRole}
                                onChange={(e) =>
                                  setEditRole(e.target.value as 'staff' | 'admin')
                                }
                                className="p-1.5 text-xs border border-[#eaeae5] bg-white font-mono uppercase"
                              >
                                <option value="staff">STAFF</option>
                                <option value="admin">ADMIN</option>
                              </select>
                            ) : (
                              <span
                                className={`text-[10px] tracking-wider uppercase px-2 py-0.5 font-mono font-medium ${
                                  member.role === 'admin'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-neutral-50 text-[#73726c] border border-[#eaeae5]'
                                }`}
                              >
                                {member.role}
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 text-right whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => handleSaveStaff(member.id)}
                                  disabled={savingStaff}
                                  className="px-2.5 py-1 bg-black text-white text-[11px] uppercase tracking-wider hover:bg-neutral-800 disabled:bg-neutral-300"
                                >
                                  {savingStaff ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={cancelEditStaff}
                                  className="px-2.5 py-1 bg-white border border-[#eaeae5] text-[11px] uppercase tracking-wider text-[#73726c] hover:text-black"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEditStaff(member)}
                                className="px-2.5 py-1 border border-[#eaeae5] bg-white text-[11px] uppercase tracking-wider text-[#171716] hover:bg-neutral-50"
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: LEAVE APPROVALS */}
        {activeTab === 'leave' && (
          <div className="bg-white border border-[#eaeae5] divide-y divide-[#eaeae5]">
            {filteredLeave.length === 0 ? (
              <p className="p-8 text-center text-xs text-[#73726c]">
                No leave requests for this store.
              </p>
            ) : (
              filteredLeave.map((req) => (
                <div
                  key={req.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">
                        {req.profiles?.full_name || 'Staff'}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-neutral-100 border border-[#eaeae5]">
                        {req.leave_type} Leave
                      </span>
                      <span
                        className={`text-[9px] uppercase px-2 py-0.5 font-mono ${
                          req.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-800'
                            : req.status === 'rejected'
                            ? 'bg-rose-50 text-rose-800'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#73726c] mt-1">{req.reason}</p>
                    <span className="text-[11px] font-mono text-[#73726c]">
                      Dates: {req.start_date} to {req.end_date}
                    </span>
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleLeaveDecision(req.id, 'approved')}
                        className="px-3 py-1.5 bg-emerald-800 text-white text-[11px] uppercase tracking-wider hover:bg-emerald-900 transition"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleLeaveDecision(req.id, 'rejected')}
                        className="px-3 py-1.5 bg-white border border-[#eaeae5] text-rose-700 text-[11px] uppercase tracking-wider hover:bg-rose-50 transition"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: ROSTER / SHIFT PLANNER */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white border border-[#eaeae5] p-4">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold">
                  Store Roster Schedule
                </span>
                <p className="text-[11px] text-[#73726c]">
                  Assign shifts, day-offs, and store locations for staff.
                </p>
              </div>
              <button
                onClick={() => setShowRosterForm(!showRosterForm)}
                className="px-3.5 py-1.5 bg-[#171716] text-white text-xs uppercase tracking-wider hover:bg-neutral-800 transition"
              >
                {showRosterForm ? 'Close' : '+ Add Shift'}
              </button>
            </div>

            {showRosterForm && (
              <form
                onSubmit={handleCreateRoster}
                className="bg-white border border-[#eaeae5] p-5 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] uppercase text-[#73726c] block mb-1">
                      Select Staff
                    </label>
                    <select
                      value={newRosterUser}
                      onChange={(e) => setNewRosterUser(e.target.value)}
                      className="w-full p-2 text-xs border border-[#eaeae5] bg-[#fbfbf9]"
                    >
                      {allStaffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name || s.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-[#73726c] block mb-1">
                      Shift Date
                    </label>
                    <input
                      type="date"
                      value={newRosterDate}
                      onChange={(e) => setNewRosterDate(e.target.value)}
                      required
                      className="w-full p-2 text-xs border border-[#eaeae5] bg-[#fbfbf9] font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-[#73726c] block mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={newRosterStart}
                      disabled={newRosterIsOff}
                      onChange={(e) => setNewRosterStart(e.target.value)}
                      className="w-full p-2 text-xs border border-[#eaeae5] bg-[#fbfbf9] font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-[#73726c] block mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={newRosterEnd}
                      disabled={newRosterIsOff}
                      onChange={(e) => setNewRosterEnd(e.target.value)}
                      className="w-full p-2 text-xs border border-[#eaeae5] bg-[#fbfbf9] font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-6 text-xs">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRosterIsOff}
                      onChange={(e) => setNewRosterIsOff(e.target.checked)}
                      className="accent-black"
                    />
                    <span>Mark as Day Off / Rest</span>
                  </label>

                  <input
                    type="text"
                    value={newRosterNotes}
                    onChange={(e) => setNewRosterNotes(e.target.value)}
                    placeholder="Notes (optional, e.g. Opening Shift)"
                    className="flex-1 p-2 text-xs border border-[#eaeae5] bg-[#fbfbf9]"
                  />

                  <button
                    type="submit"
                    className="px-4 py-2 bg-black text-white text-xs uppercase tracking-widest"
                  >
                    Save Shift
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white border border-[#eaeae5] divide-y divide-[#eaeae5]">
              {filteredSchedules.length === 0 ? (
                <p className="p-8 text-center text-xs text-[#73726c]">No shifts scheduled.</p>
              ) : (
                filteredSchedules.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex items-center justify-between hover:bg-[#fbfbf9]"
                  >
                    <div className="flex items-center space-x-4">
                      <span className="font-mono text-xs w-24">{item.shift_date}</span>
                      <div>
                        <span className="text-xs font-semibold">
                          {item.profiles?.full_name || 'Staff'}
                        </span>
                        <span className="text-[10px] text-[#73726c] ml-2 font-mono">
                          ({item.stores?.name || 'Store'})
                        </span>
                        <p className="text-[11px] text-[#73726c]">{item.notes}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <span className="text-xs font-mono">
                        {item.is_day_off
                          ? 'DAY OFF'
                          : `${item.shift_start?.slice(0, 5)} - ${item.shift_end?.slice(0, 5)}`}
                      </span>
                      <button
                        onClick={() => handleDeleteRoster(item.id)}
                        className="text-rose-600 hover:text-rose-900 text-xs px-2 py-1 border border-rose-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: STORE TASKS */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white border border-[#eaeae5] p-4">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold">
                  Store Operational Checklist
                </span>
                <p className="text-[11px] text-[#73726c]">
                  Create daily tasks and procedures for store staff.
                </p>
              </div>
              <button
                onClick={() => setShowTaskForm(!showTaskForm)}
                className="px-3.5 py-1.5 bg-[#171716] text-white text-xs uppercase tracking-wider hover:bg-neutral-800 transition"
              >
                {showTaskForm ? 'Close' : '+ New Task'}
              </button>
            </div>

            {showTaskForm && (
              <form
                onSubmit={handleCreateTask}
                className="bg-white border border-[#eaeae5] p-5 space-y-3"
              >
                <input
                  type="text"
                  placeholder="Task title (e.g. Inspect Fitting Rooms)"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  required
                  className="w-full p-2 text-xs border border-[#eaeae5] bg-[#fbfbf9]"
                />
                <input
                  type="text"
                  placeholder="Task description..."
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  className="w-full p-2 text-xs border border-[#eaeae5] bg-[#fbfbf9]"
                />
                <div className="flex justify-between items-center">
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as 'low' | 'normal' | 'high')}
                    className="p-2 text-xs border border-[#eaeae5] bg-[#fbfbf9]"
                  >
                    <option value="low">Low Priority</option>
                    <option value="normal">Normal Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-black text-white text-xs uppercase tracking-widest"
                  >
                    Create Task
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white border border-[#eaeae5] divide-y divide-[#eaeae5]">
              {filteredTasks.length === 0 ? (
                <p className="p-8 text-center text-xs text-[#73726c]">
                  No tasks logged for this store.
                </p>
              ) : (
                filteredTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 flex justify-between items-center hover:bg-[#fbfbf9]"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-xs font-medium ${
                            t.status === 'completed' ? 'line-through text-[#73726c]' : ''
                          }`}
                        >
                          {t.title}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-neutral-100 font-mono">
                          {t.stores?.name || 'All Stores'}
                        </span>
                      </div>
                      {t.description && (
                        <p className="text-[11px] text-[#73726c]">{t.description}</p>
                      )}
                    </div>

                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-[10px] font-mono uppercase ${
                          t.status === 'completed' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {t.status}
                      </span>
                      <button
                        onClick={() => handleDeleteTask(t.id)}
                        className="text-xs text-rose-600 hover:text-rose-900 px-2 py-1 border border-rose-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 6: BROADCAST NEWS */}
        {activeTab === 'news' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white border border-[#eaeae5] p-4">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold">
                  Store Broadcast News
                </span>
                <p className="text-[11px] text-[#73726c]">
                  Publish announcements for staff at selected store.
                </p>
              </div>
              <button
                onClick={() => setShowNewsForm(!showNewsForm)}
                className="px-3.5 py-1.5 bg-[#171716] text-white text-xs uppercase tracking-wider hover:bg-neutral-800 transition"
              >
                {showNewsForm ? 'Close' : '+ New Broadcast'}
              </button>
            </div>

            {showNewsForm && (
              <form
                onSubmit={handleCreateNews}
                className="bg-white border border-[#eaeae5] p-5 space-y-3"
              >
                <input
                  type="text"
                  placeholder="Broadcast Title"
                  value={newNewsTitle}
                  onChange={(e) => setNewNewsTitle(e.target.value)}
                  required
                  className="w-full p-2 text-xs border border-[#eaeae5] bg-[#fbfbf9]"
                />
                <textarea
                  rows={3}
                  placeholder="Broadcast content details..."
                  value={newNewsContent}
                  onChange={(e) => setNewNewsContent(e.target.value)}
                  required
                  className="w-full p-2 text-xs border border-[#eaeae5] bg-[#fbfbf9] resize-none"
                />
                <div className="flex justify-between items-center">
                  <select
                    value={newNewsPriority}
                    onChange={(e) => setNewNewsPriority(e.target.value as 'normal' | 'urgent')}
                    className="p-2 text-xs border border-[#eaeae5] bg-[#fbfbf9]"
                  >
                    <option value="normal">Standard Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-black text-white text-xs uppercase tracking-widest"
                  >
                    Publish Broadcast
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {filteredNews.length === 0 ? (
                <div className="bg-white border border-[#eaeae5] p-8 text-center text-xs text-[#73726c]">
                  No broadcasts found for this store.
                </div>
              ) : (
                filteredNews.map((n) => (
                  <div key={n.id} className="bg-white border border-[#eaeae5] p-5 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">{n.title}</span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-neutral-100">
                          {n.stores?.name || 'All Stores'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteNews(n.id)}
                        className="text-xs text-rose-600 hover:text-rose-900 border border-rose-200 px-2 py-0.5"
                      >
                        Delete
                      </button>
                    </div>
                    <p className="text-xs text-[#73726c]">{n.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}