'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

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
  profiles: {
    full_name: string
    email: string
  } | null
}

export default function AdminPage() {
  const router = useRouter()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAttendanceData = async () => {
    setLoading(true)
    const { data, error } = await supabase
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
        profiles (
          full_name,
          email
        )
      `)
      .order('work_date', { ascending: false })

    if (error) {
      alert('Error fetching records: ' + error.message)
    } else if (data) {
      setRecords(data as unknown as AttendanceRecord[])
    }
    setLoading(false)
  }

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession()
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

      fetchAttendanceData()
    }

    checkAdmin()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '-'
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-xl shadow-sm gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">TWILM Admin Portal</h1>
            <p className="text-xs text-gray-500">Staff attendance and verification overview</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/attendance')}
              className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition"
            >
              Test Attendance
            </button>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-700">Attendance Logs</h2>
            <button
              onClick={fetchAttendanceData}
              className="text-xs text-blue-600 hover:underline"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-gray-500">Loading records...</div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">No attendance records logged yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-gray-700 border-b">
                  <tr>
                    <th className="p-3">Staff</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Clock In</th>
                    <th className="p-3">In Selfie</th>
                    <th className="p-3">In Location</th>
                    <th className="p-3">Clock Out</th>
                    <th className="p-3">Out Selfie</th>
                    <th className="p-3">Out Location</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">
                        {rec.profiles?.full_name || 'Unknown'}
                        <div className="text-[10px] text-gray-400 font-normal">{rec.profiles?.email}</div>
                      </td>
                      <td className="p-3 whitespace-nowrap">{rec.work_date}</td>
                      <td className="p-3 whitespace-nowrap">{formatTime(rec.clock_in_at)}</td>
                      <td className="p-3">
                        {rec.clock_in_photo_url ? (
                          <a href={rec.clock_in_photo_url} target="_blank" rel="noreferrer">
                            <img
                              src={rec.clock_in_photo_url}
                              alt="In"
                              className="w-10 h-10 object-cover rounded border hover:scale-105 transition"
                            />
                          </a>
                        ) : '-'}
                      </td>
                      <td className="p-3 min-w-[160px]">
                        {rec.clock_in_address ? (
                          <div>
                            <div className="font-medium text-gray-800">{rec.clock_in_address}</div>
                            {rec.clock_in_lat && rec.clock_in_lng && (
                              <a
                                href={`https://www.google.com/maps?q=${rec.clock_in_lat},${rec.clock_in_lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-blue-500 hover:underline"
                              >
                                View Map (±{rec.clock_in_accuracy?.toFixed(0)}m)
                              </a>
                            )}
                          </div>
                        ) : rec.clock_in_lat ? (
                          <span className="font-mono text-[10px]">{rec.clock_in_lat.toFixed(4)}, {rec.clock_in_lng?.toFixed(4)}</span>
                        ) : '-'}
                      </td>
                      <td className="p-3 whitespace-nowrap">{formatTime(rec.clock_out_at)}</td>
                      <td className="p-3">
                        {rec.clock_out_photo_url ? (
                          <a href={rec.clock_out_photo_url} target="_blank" rel="noreferrer">
                            <img
                              src={rec.clock_out_photo_url}
                              alt="Out"
                              className="w-10 h-10 object-cover rounded border hover:scale-105 transition"
                            />
                          </a>
                        ) : '-'}
                      </td>
                      <td className="p-3 min-w-[160px]">
                        {rec.clock_out_address ? (
                          <div>
                            <div className="font-medium text-gray-800">{rec.clock_out_address}</div>
                            {rec.clock_out_lat && rec.clock_out_lng && (
                              <a
                                href={`https://www.google.com/maps?q=${rec.clock_out_lat},${rec.clock_out_lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-blue-500 hover:underline"
                              >
                                View Map (±{rec.clock_out_accuracy?.toFixed(0)}m)
                              </a>
                            )}
                          </div>
                        ) : rec.clock_out_lat ? (
                          <span className="font-mono text-[10px]">{rec.clock_out_lat.toFixed(4)}, {rec.clock_out_lng?.toFixed(4)}</span>
                        ) : '-'}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          rec.status === 'present'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}