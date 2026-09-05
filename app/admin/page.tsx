'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../lib/supabase'
import StaffNav from '../components/StaffNav'

interface ProfileSummary {
  full_name: string | null
  email: string | null
}

interface StoreSummary {
  id?: string
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
  profiles: ProfileSummary | null
  stores: StoreSummary | null
}

interface LeaveRequestItem {
  id: string
  leave_type: string
  start_date: string
  end_date: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  profiles: ProfileSummary | null
}

export default function AdminPage() {
  const router = useRouter()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestItem[]>([])
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'attendance' | 'leave'>('attendance')

  const fetchData = async () => {
    setLoading(true)

    // 1. Fetch attendance records
    const { data: attData, error: attErr } = await supabase
      .from('attendance')
      .select(`
        id,
        work_date,
        clock_in_at,
        clock_in_lat,
        clock_in_lng,
        clock_in_accuracy,
        clock_in_photo_url,
        clock_in_address,
        clock_out_at,
        clock_out_lat,
        clock_out_lng,
        clock_out_accuracy,
        clock_out_photo_url,
        clock_out_address,
        status,
        store_id,
        profiles (
          full_name,
          email
        ),
        stores (
          name
        )
      `)
      .order('work_date', { ascending: false })

    if (attErr) {
      alert('Error fetching records: ' + attErr.message)
    } else if (attData) {
      setRecords(attData as unknown as AttendanceRecord[])
    }

    // 2. Fetch pending/recent leave requests
    const { data: lData } = await supabase
      .from('leave_requests')
      .select(`
        id,
        leave_type,
        start_date,
        end_date,
        reason,
        status,
        created_at,
        profiles (
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false })

    if (lData) {
      setLeaveRequests(lData as unknown as LeaveRequestItem[])
    }

    // 3. Fetch stores for filter dropdown
    const { data: storeList } = await supabase
      .from('stores')
      .select('id, name')
      .order('name')

    if (storeList) {
      setStores(storeList)
    }

    setLoading(false)
  }

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profile?.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      fetchData()
    }

    checkAdmin()
  }, [router])

  // Handle approving or rejecting leave
  const handleLeaveDecision = async (id: string, decision: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: decision,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      alert('Decision update failed: ' + error.message)
    } else {
      setLeaveRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: decision } : r))
      )
    }
  }

  // Filtered attendance records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesStore =
        selectedStoreFilter === 'all' || r.store_id === selectedStoreFilter
      const isComplete = r.status === 'present' || Boolean(r.clock_out_at)
      const matchesStatus =
        selectedStatusFilter === 'all' ||
        (selectedStatusFilter === 'complete' && isComplete) ||
        (selectedStatusFilter === 'incomplete' && !isComplete)

      return matchesStore && matchesStatus
    })
  }, [records, selectedStoreFilter, selectedStatusFilter])

  // Export Attendance to CSV
  const exportToCSV = () => {
    if (filteredRecords.length === 0) {
      alert('No records available to export.')
      return
    }

    const headers = [
      'Staff Name',
      'Staff Email',
      'Store Location',
      'Date',
      'Clock In Time',
      'Clock In Address',
      'Clock Out Time',
      'Clock Out Address',
      'Status',
    ]

    const csvRows = filteredRecords.map((r) => [
      `"${r.profiles?.full_name || 'Staff'}"`,
      `"${r.profiles?.email || ''}"`,
      `"${r.stores?.name || 'Unassigned'}"`,
      `"${r.work_date}"`,
      `"${r.clock_in_at ? new Date(r.clock_in_at).toLocaleTimeString() : ''}"`,
      `"${(r.clock_in_address || '').replace(/"/g, '""')}"`,
      `"${r.clock_out_at ? new Date(r.clock_out_at).toLocaleTimeString() : ''}"`,
      `"${(r.clock_out_address || '').replace(/"/g, '""')}"`,
      `"${r.clock_out_at ? 'Present' : r.status}"`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `TWILM_Attendance_Export_${new Date().toISOString().split('T')[0]}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '--:--'
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const completedCount = records.filter((r) => r.status === 'present' || r.clock_out_at).length
  const pendingLeaveCount = leaveRequests.filter((l) => l.status === 'pending').length

  return (
    <main className="min-h-screen bg-[#fbfbf9] pb-24 sm:pb-12 text-[#171716]">
      <StaffNav userRole="admin" />

      <div className="max-w-6xl mx-auto px-4 pt-8 space-y-6">
        {/* Section Header */}
        <div className="border-b border-[#eaeae5] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] tracking-[0.25em] uppercase text-[#73726c] font-mono">
              MANAGEMENT / CONTROLS
            </span>
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight mt-1">
              STORE <span className="font-serif italic font-normal">OPERATIONS</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportToCSV}
              className="px-3.5 py-1.5 bg-white border border-[#eaeae5] text-[11px] uppercase tracking-wider text-[#171716] hover:bg-neutral-50 transition"
            >
              Export CSV
            </button>
            <button
              onClick={fetchData}
              className="px-3.5 py-1.5 bg-[#171716] text-white text-[11px] uppercase tracking-wider hover:bg-neutral-800 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Overview Metric Bar */}
        <div className="grid grid-cols-3 bg-white border border-[#eaeae5] divide-x divide-[#eaeae5] text-center py-4">
          <div>
            <span className="text-[10px] tracking-widest uppercase text-[#73726c] block">
              TOTAL LOGS
            </span>
            <span className="text-xl sm:text-2xl font-mono font-light mt-1 block">
              {records.length}
            </span>
          </div>
          <div>
            <span className="text-[10px] tracking-widest uppercase text-[#73726c] block">
              COMPLETED
            </span>
            <span className="text-xl sm:text-2xl font-mono font-light mt-1 block text-emerald-800">
              {completedCount}
            </span>
          </div>
          <div>
            <span className="text-[10px] tracking-widest uppercase text-[#73726c] block">
              PENDING LEAVE
            </span>
            <span className="text-xl sm:text-2xl font-mono font-light mt-1 block text-amber-800">
              {pendingLeaveCount}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#eaeae5] space-x-6 text-xs uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`pb-2 transition-colors ${
              activeTab === 'attendance'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-[#73726c] hover:text-black'
            }`}
          >
            Attendance Logs ({filteredRecords.length})
          </button>
          <button
            onClick={() => setActiveTab('leave')}
            className={`pb-2 transition-colors ${
              activeTab === 'leave'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-[#73726c] hover:text-black'
            }`}
          >
            Leave Approvals ({pendingLeaveCount})
          </button>
        </div>

        {/* TAB 1: ATTENDANCE LOGS WITH FILTERS */}
        {activeTab === 'attendance' && (
          <div className="bg-white border border-[#eaeae5] overflow-hidden space-y-4">
            {/* Filter Toolbar */}
            <div className="p-4 border-b border-[#eaeae5] bg-[#fbfbf9]/60 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-3 items-center">
                <span className="text-[10px] uppercase tracking-wider text-[#73726c]">
                  Filter Store:
                </span>
                <select
                  value={selectedStoreFilter}
                  onChange={(e) => setSelectedStoreFilter(e.target.value)}
                  className="p-1.5 text-xs bg-white border border-[#eaeae5] text-[#171716] focus:outline-none"
                >
                  <option value="all">All Stores</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <span className="text-[10px] uppercase tracking-wider text-[#73726c] ml-2">
                  Status:
                </span>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="p-1.5 text-xs bg-white border border-[#eaeae5] text-[#171716] focus:outline-none"
                >
                  <option value="all">All Shifts</option>
                  <option value="complete">Completed Shift</option>
                  <option value="incomplete">Pending Out</option>
                </select>
              </div>

              <span className="text-[11px] font-mono text-[#73726c]">
                Showing {filteredRecords.length} records
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-[#73726c] animate-pulse">
                Loading verified records...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#73726c]">
                No matching attendance records found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#171716]">
                  <thead className="bg-[#fbfbf9] text-[10px] uppercase tracking-wider text-[#73726c] border-b border-[#eaeae5]">
                    <tr>
                      <th className="p-3.5">Staff</th>
                      <th className="p-3.5">Store</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Clock In</th>
                      <th className="p-3.5">In Selfie</th>
                      <th className="p-3.5">In Location</th>
                      <th className="p-3.5">Clock Out</th>
                      <th className="p-3.5">Out Selfie</th>
                      <th className="p-3.5">Out Location</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eaeae5]">
                    {filteredRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#fbfbf9]/60 transition-colors">
                        <td className="p-3.5 font-medium whitespace-nowrap">
                          {rec.profiles?.full_name || 'Staff Member'}
                          <div className="text-[10px] text-[#73726c] font-normal">
                            {rec.profiles?.email}
                          </div>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="text-[10px] tracking-wider uppercase px-2 py-0.5 bg-neutral-100 border border-[#eaeae5]">
                            {rec.stores?.name || 'Unassigned'}
                          </span>
                        </td>
                        <td className="p-3.5 whitespace-nowrap font-mono text-[11px]">
                          {rec.work_date}
                        </td>
                        <td className="p-3.5 whitespace-nowrap font-mono text-[11px]">
                          {formatTime(rec.clock_in_at)}
                        </td>
                        <td className="p-3.5">
                          {rec.clock_in_photo_url ? (
                            <a href={rec.clock_in_photo_url} target="_blank" rel="noreferrer">
                              <div className="relative w-9 h-11 border border-[#eaeae5] overflow-hidden">
                                <Image
                                  src={rec.clock_in_photo_url}
                                  alt="In"
                                  fill
                                  unoptimized
                                  className="object-cover hover:scale-105 transition duration-150"
                                />
                              </div>
                            </a>
                          ) : (
                            <span className="text-[#73726c] text-[10px]">--</span>
                          )}
                        </td>
                        <td className="p-3.5 min-w-[160px] max-w-xs">
                          {rec.clock_in_address ? (
                            <div className="space-y-0.5">
                              <div className="line-clamp-1 text-[11px] text-[#171716]">
                                {rec.clock_in_address}
                              </div>
                              {rec.clock_in_lat && rec.clock_in_lng && (
                                <a
                                  href={`https://www.google.com/maps?q=${rec.clock_in_lat},${rec.clock_in_lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-neutral-500 hover:text-black underline block"
                                >
                                  Map (±{rec.clock_in_accuracy?.toFixed(0)}m)
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#73726c] text-[10px]">--</span>
                          )}
                        </td>
                        <td className="p-3.5 whitespace-nowrap font-mono text-[11px]">
                          {formatTime(rec.clock_out_at)}
                        </td>
                        <td className="p-3.5">
                          {rec.clock_out_photo_url ? (
                            <a href={rec.clock_out_photo_url} target="_blank" rel="noreferrer">
                              <div className="relative w-9 h-11 border border-[#eaeae5] overflow-hidden">
                                <Image
                                  src={rec.clock_out_photo_url}
                                  alt="Out"
                                  fill
                                  unoptimized
                                  className="object-cover hover:scale-105 transition duration-150"
                                />
                              </div>
                            </a>
                          ) : (
                            <span className="text-[#73726c] text-[10px]">--</span>
                          )}
                        </td>
                        <td className="p-3.5 min-w-[160px] max-w-xs">
                          {rec.clock_out_address ? (
                            <div className="space-y-0.5">
                              <div className="line-clamp-1 text-[11px] text-[#171716]">
                                {rec.clock_out_address}
                              </div>
                              {rec.clock_out_lat && rec.clock_out_lng && (
                                <a
                                  href={`https://www.google.com/maps?q=${rec.clock_out_lat},${rec.clock_out_lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-neutral-500 hover:text-black underline block"
                                >
                                  Map (±{rec.clock_out_accuracy?.toFixed(0)}m)
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#73726c] text-[10px]">--</span>
                          )}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium ${
                              rec.status === 'present' || rec.clock_out_at
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {rec.clock_out_at ? 'Present' : rec.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LEAVE APPROVALS QUEUE */}
        {activeTab === 'leave' && (
          <div className="bg-white border border-[#eaeae5]">
            <div className="p-4 border-b border-[#eaeae5]">
              <span className="text-xs uppercase tracking-wider text-[#73726c]">
                Staff Leave Applications
              </span>
            </div>

            {leaveRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#73726c]">
                No leave requests logged in the system.
              </div>
            ) : (
              <div className="divide-y divide-[#eaeae5]">
                {leaveRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#fbfbf9] transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">
                          {req.profiles?.full_name || 'Staff Member'}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-neutral-100 border border-[#eaeae5]">
                          {req.leave_type} Leave
                        </span>
                        <span
                          className={`text-[9px] uppercase tracking-wider px-2 py-0.5 font-mono ${
                            req.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : req.status === 'rejected'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#73726c]">{req.reason}</p>
                      <span className="text-[11px] font-mono text-[#73726c] block">
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
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}