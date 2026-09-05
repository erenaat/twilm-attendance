'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import StaffNav from '../components/StaffNav'

interface LeaveBalance {
  annual_leave_total: number
  annual_leave_used: number
  sick_leave_used: number
}

interface LeaveRequestItem {
  id: string
  leave_type: string
  start_date: string
  end_date: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export default function LeavePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | undefined>(undefined)
  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [requests, setRequests] = useState<LeaveRequestItem[]>([])
  const [loading, setLoading] = useState(true)

  // Form State
  const [leaveType, setLeaveType] = useState<string>('annual')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    const initLeaveData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)

      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()
      if (prof) setUserRole(prof.role)

      // Fetch leave balances for current year
      const currentYear = new Date().getFullYear()
      const { data: balData } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('year', currentYear)
        .maybeSingle()

      if (balData) {
        setBalance(balData)
      } else {
        // Fallback default
        setBalance({ annual_leave_total: 12, annual_leave_used: 0, sick_leave_used: 0 })
      }

      // Fetch leave requests history
      const { data: reqData } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (reqData) {
        setRequests(reqData)
      }

      setLoading(false)
    }

    initLeaveData()
  }, [router])

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!startDate || !endDate || !reason) {
      alert('Please complete all form fields.')
      return
    }

    if (new Date(startDate) > new Date(endDate)) {
      alert('End date cannot be earlier than start date.')
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
      alert('Submission failed: ' + error.message)
    } else if (data) {
      setRequests((prev) => [data, ...prev])
      setStartDate('')
      setEndDate('')
      setReason('')
      setMessage('Leave request submitted for management review.')
      setTimeout(() => setMessage(''), 4000)
    }
  }

  const remainingAnnual = (balance?.annual_leave_total || 12) - (balance?.annual_leave_used || 0)

  return (
    <main className="min-h-screen bg-[#fbfbf9] pb-24 sm:pb-12 text-[#171716]">
      <StaffNav userRole={userRole} />

      <div className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
        <div className="border-b border-[#eaeae5] pb-4">
          <span className="text-[10px] tracking-[0.25em] uppercase text-[#73726c] font-mono">
            STAFF OS / TIME OFF
          </span>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight mt-1">
            LEAVE <span className="font-serif italic font-normal">CENTER</span>
          </h1>
        </div>

        {/* Leave Balance Overview Cards */}
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
              PENDING REQUESTS
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-light font-mono">
                {requests.filter((r) => r.status === 'pending').length}
              </span>
              <span className="text-xs text-amber-700">under review</span>
            </div>
            <p className="text-[11px] text-[#73726c] mt-2">
              Reviewed by Store Management.
            </p>
          </div>
        </div>

        {/* Submission Form and History Table */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Request Submission Form */}
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
                  className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none focus:border-black"
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
                  className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none focus:border-black font-mono"
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
                  className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none focus:border-black font-mono"
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
                  className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none focus:border-black resize-none"
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

          {/* Past Requests History */}
          <div className="md:col-span-2 bg-white border border-[#eaeae5]">
            <div className="p-4 border-b border-[#eaeae5]">
              <span className="text-xs uppercase tracking-wider text-[#73726c]">
                Leave History & Status
              </span>
            </div>

            {loading ? (
              <p className="p-8 text-center text-xs text-[#73726c] animate-pulse">
                Loading leave records...
              </p>
            ) : requests.length === 0 ? (
              <p className="p-8 text-center text-xs text-[#73726c]">
                No leave requests filed yet.
              </p>
            ) : (
              <div className="divide-y divide-[#eaeae5]">
                {requests.map((item) => (
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
      </div>
    </main>
  )
}