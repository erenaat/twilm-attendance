'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import StaffNav from '../components/StaffNav'

interface Store {
  id: string
  name: string
}

interface ProfileSummary {
  id: string
  full_name: string | null
  email: string | null
  store_id: string | null
  stores?: Store | null
}

interface LeaveBalance {
  annual_leave_total: number
  annual_leave_used: number
  sick_leave_used: number
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
  profiles?: ProfileSummary | null
}

export default function LeavePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | undefined>(undefined)
  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [personalRequests, setPersonalRequests] = useState<LeaveRequestItem[]>([])
  const [allStaffRequests, setAllStaffRequests] = useState<LeaveRequestItem[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<'personal' | 'approvals'>('personal')
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all')

  const [leaveType, setLeaveType] = useState<string>('annual')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string>('')

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

      if (isMounted) setUser(session.user)

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

      const currentYear = new Date().getFullYear()
      const { data: balData } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('year', currentYear)
        .maybeSingle()

      if (isMounted) {
        if (balData) {
          setBalance(balData)
        } else {
          setBalance({ annual_leave_total: 12, annual_leave_used: 0, sick_leave_used: 0 })
        }
      }

      const { data: reqData } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (reqData && isMounted) {
        setPersonalRequests(reqData)
      }

      if (isAdmin) {
        const { data: storeData } = await supabase
          .from('stores')
          .select('id, name')
          .order('name')
        if (storeData && isMounted) setStores(storeData)

        const { data: adminReqData } = await supabase
          .from('leave_requests')
          .select('*, profiles(id, full_name, email, store_id, stores(id, name))')
          .order('created_at', { ascending: false })

        if (adminReqData && isMounted) {
          setAllStaffRequests(adminReqData as unknown as LeaveRequestItem[])
        }
      }

      if (isMounted) setLoading(false)
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [router])

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!startDate || !endDate || !reason) {
      alert('Mohon lengkapi semua kolom formulir.')
      return
    }

    if (new Date(startDate) > new Date(endDate)) {
      alert('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.')
      return
    }

    setSubmitting(true)
    setMessage('')

    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        user_id: user.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason,
        status: 'pending',
      })
      .select()
      .single()

    setSubmitting(false)

    if (error) {
      alert('Pengajuan gagal: ' + error.message)
    } else if (data) {
      setPersonalRequests((prev) => [data, ...prev])
      if (userRole === 'admin') {
        setAllStaffRequests((prev) => [data, ...prev])
      }
      setStartDate('')
      setEndDate('')
      setReason('')
      setMessage('Pengajuan cuti berhasil dikirim.')
      setTimeout(() => setMessage(''), 4000)
    }
  }

  const handleDecision = async (id: string, decision: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: decision,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      alert('Gagal memproses keputusan: ' + error.message)
    } else {
      setAllStaffRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: decision } : r))
      )
      setPersonalRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: decision } : r))
      )
    }
  }

  const remainingAnnual = (balance?.annual_leave_total || 12) - (balance?.annual_leave_used || 0)

  const filteredApprovals = useMemo(() => {
    if (selectedStoreFilter === 'all') return allStaffRequests
    return allStaffRequests.filter((r) => r.profiles?.store_id === selectedStoreFilter)
  }, [allStaffRequests, selectedStoreFilter])

  const pendingApprovalsCount = allStaffRequests.filter((r) => r.status === 'pending').length

  return (
    <main className="min-h-screen bg-[#fbfbf9] pb-24 sm:pb-12 text-[#171716]">
      <StaffNav userRole={userRole} />

      <div className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
        <div className="border-b border-[#eaeae5] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] tracking-[0.25em] uppercase text-[#73726c] font-mono">
              STAFF OS / TIME OFF
            </span>
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight mt-1">
              LEAVE <span className="font-serif italic font-normal">CENTER</span>
            </h1>
          </div>

          {userRole === 'admin' && (
            <div className="flex border border-[#eaeae5] bg-white p-0.5 text-xs">
              <button
                onClick={() => setActiveTab('personal')}
                className={`px-3.5 py-1.5 uppercase tracking-wider transition-colors ${
                  activeTab === 'personal'
                    ? 'bg-[#171716] text-white font-medium'
                    : 'text-[#73726c] hover:text-black'
                }`}
              >
                My Applications
              </button>
              <button
                onClick={() => setActiveTab('approvals')}
                className={`px-3.5 py-1.5 uppercase tracking-wider transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'approvals'
                    ? 'bg-[#171716] text-white font-medium'
                    : 'text-[#73726c] hover:text-black'
                }`}
              >
                <span>Staff Approvals</span>
                {pendingApprovalsCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-600 text-white rounded-full text-[9px] font-mono">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-[#eaeae5] p-5">
            <span className="text-[10px] tracking-widest uppercase text-[#73726c] block">
              ANNUAL LEAVE BALANCE
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-light font-mono">{remainingAnnual}</span>
              <span className="text-xs text-[#73726c]">
                of {balance?.annual_leave_total || 12} days
              </span>
            </div>
            <p className="text-[11px] text-[#73726c] mt-2">
              Refreshes each calendar year.
            </p>
          </div>

          <div className="bg-white border border-[#eaeae5] p-5">
            <span className="text-[10px] tracking-widest uppercase text-[#73726c] block">
              SICK LEAVE RECORDED
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-light font-mono">{balance?.sick_leave_used || 0}</span>
              <span className="text-xs text-[#73726c]">days this year</span>
            </div>
            <p className="text-[11px] text-[#73726c] mt-2">
              Requires doctor notice if &gt; 2 days.
            </p>
          </div>

          <div className="bg-white border border-[#eaeae5] p-5">
            <span className="text-[10px] tracking-widest uppercase text-[#73726c] block">
              {userRole === 'admin' ? 'PENDING STORE REVIEWS' : 'MY PENDING REQUESTS'}
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-light font-mono">
                {userRole === 'admin'
                  ? pendingApprovalsCount
                  : personalRequests.filter((r) => r.status === 'pending').length}
              </span>
              <span className="text-xs text-amber-700">under review</span>
            </div>
            <p className="text-[11px] text-[#73726c] mt-2">
              Reviewed by Store Management.
            </p>
          </div>
        </div>

        {activeTab === 'personal' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="bg-white border border-[#eaeae5] p-6 space-y-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-[#73726c]">
                  Submit Leave Application
                </span>
                <p className="text-[11px] text-[#73726c] mt-0.5">
                  Apply for planned time-off or sick leave.
                </p>
              </div>

              <form onSubmit={handleSubmitRequest} className="space-y-3.5">
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                    Leave Type
                  </label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none"
                  >
                    <option value="annual">Annual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="unpaid">Unpaid Leave</option>
                    <option value="other">Other / Special</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                    Reason / Notes
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Provide context for your request..."
                    required
                    rows={3}
                    className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none resize-none"
                  />
                </div>

                {message && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5">
                    ✓ {message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-[#171716] hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs uppercase tracking-widest transition"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </form>
            </div>

            <div className="md:col-span-2 bg-white border border-[#eaeae5]">
              <div className="p-4 border-b border-[#eaeae5]">
                <span className="text-xs uppercase tracking-wider text-[#73726c]">
                  My Leave History & Status
                </span>
              </div>

              {loading ? (
                <p className="p-8 text-center text-xs text-[#73726c] animate-pulse">
                  Loading leave records...
                </p>
              ) : personalRequests.length === 0 ? (
                <p className="p-8 text-center text-xs text-[#73726c]">
                  No leave requests filed yet.
                </p>
              ) : (
                <div className="divide-y divide-[#eaeae5]">
                  {personalRequests.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#fbfbf9] transition-colors"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold uppercase tracking-wider">
                            {item.leave_type} Leave
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[9px] uppercase tracking-wider font-mono font-medium ${
                              item.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : item.status === 'rejected'
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#73726c] mt-1">{item.reason}</p>
                      </div>

                      <div className="sm:text-right font-mono text-xs text-[#171716]">
                        <span>{item.start_date}</span>
                        <span className="text-[#73726c] mx-1.5">to</span>
                        <span>{item.end_date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {userRole === 'admin' && activeTab === 'approvals' && (
          <div className="bg-white border border-[#eaeae5] space-y-4">
            <div className="p-4 border-b border-[#eaeae5] bg-[#fbfbf9]/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
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
              </div>

              <span className="text-[11px] font-mono text-[#73726c]">
                Showing {filteredApprovals.length} applications
              </span>
            </div>

            {filteredApprovals.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#73726c]">
                No leave requests found for this store.
              </div>
            ) : (
              <div className="divide-y divide-[#eaeae5]">
                {filteredApprovals.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#fbfbf9] transition-colors"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {req.profiles?.full_name || 'Staff Member'}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-neutral-100 border border-[#eaeae5]">
                          {req.profiles?.stores?.name || 'Store'}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-neutral-50 text-[#73726c] border border-[#eaeae5]">
                          {req.leave_type} Leave
                        </span>
                        <span
                          className={`text-[9px] uppercase px-2 py-0.5 font-mono ${
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

                      <p className="text-xs text-[#73726c] mt-1">{req.reason}</p>
                      <span className="text-[11px] font-mono text-[#73726c] block mt-0.5">
                        Dates: {req.start_date} to {req.end_date}
                      </span>
                    </div>

                    {req.status === 'pending' ? (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDecision(req.id, 'approved')}
                          className="px-3.5 py-1.5 bg-emerald-800 text-white text-[11px] uppercase tracking-wider hover:bg-emerald-900 transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDecision(req.id, 'rejected')}
                          className="px-3.5 py-1.5 bg-white border border-[#eaeae5] text-rose-700 text-[11px] uppercase tracking-wider hover:bg-rose-50 transition"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-mono text-[#73726c] uppercase">
                        Reviewed
                      </span>
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