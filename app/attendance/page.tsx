'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import StaffNav from '../components/StaffNav'

interface Store {
  id: string
  name: string
  code: string | null
}

interface Profile {
  id: string
  role: string | null
  store_id: string | null
}

interface AttendanceItem {
  id: string
  work_date: string
  clock_in_at: string | null
  clock_in_photo_url: string | null
  clock_in_address: string | null
  clock_out_at: string | null
  clock_out_photo_url: string | null
  clock_out_address: string | null
  store_id: string | null
  stores?: { name: string } | null
}

export default function AttendancePage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [photoData, setPhotoData] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [todayRecord, setTodayRecord] = useState<AttendanceItem | null>(null)
  const [historyRecords, setHistoryRecords] = useState<AttendanceItem[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today')

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)

      const { data: profData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()
      if (profData) {
        setProfile(profData)
        if (profData.store_id) setSelectedStoreId(profData.store_id)
      }

      const { data: storesData } = await supabase
        .from('stores')
        .select('*')
        .order('name')
      if (storesData) {
        setStores(storesData)
        if (!selectedStoreId && storesData.length > 0) {
          setSelectedStoreId(storesData[0].id)
        }
      }

      const today = new Date().toISOString().split('T')[0]
      const { data: todayData } = await supabase
        .from('attendance')
        .select('*, stores(name)')
        .eq('user_id', session.user.id)
        .eq('work_date', today)
        .maybeSingle()

      if (todayData) {
        setTodayRecord(todayData)
        if (todayData.store_id) setSelectedStoreId(todayData.store_id)
      }

      const { data: pastData } = await supabase
        .from('attendance')
        .select('*, stores(name)')
        .eq('user_id', session.user.id)
        .order('work_date', { ascending: false })
        .limit(30)

      if (pastData) {
        setHistoryRecords(pastData)
      }
    }
    init()
  }, [router, selectedStoreId])

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch {
      alert('Camera access denied. Camera is required for attendance.')
    }
  }

  const takeSnapshot = () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = 480
    canvas.height = 640
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6)
      setPhotoData(dataUrl)
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
        setStream(null)
      }
    }
  }

  const getCoordinates = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'))
      } else {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      }
    })
  }

  const fetchAddress = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      )
      if (!res.ok) return 'Location captured'
      const data = await res.json()
      const addr = data.address || {}
      const parts = [
        addr.road || addr.pedestrian || addr.building,
        addr.village || addr.suburb || addr.neighbourhood,
        addr.city || addr.town || addr.county || addr.state,
      ].filter(Boolean)

      return parts.length > 0
        ? parts.join(', ')
        : data.display_name || 'Location captured'
    } catch {
      return 'Location captured'
    }
  }

  const base64ToBlob = (base64: string) => {
    const arr = base64.split(',')
    const mimeMatch = arr[0].match(/:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new Blob([u8arr], { type: mime })
  }

  const handleAttendance = async (type: 'clock_in' | 'clock_out') => {
    if (!photoData || !user) {
      alert('Please take a selfie first.')
      return
    }

    setLoading(true)
    setStatusMessage('Capturing GPS location...')

    try {
      const pos = await getCoordinates()
      const { latitude, longitude, accuracy } = pos.coords

      setStatusMessage('Finding address...')
      const address = await fetchAddress(latitude, longitude)

      setStatusMessage('Uploading selfie...')
      const blob = base64ToBlob(photoData)
      const fileName = `${user.id}/${Date.now()}_${type}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('selfies')
        .upload(fileName, blob, { contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('selfies').getPublicUrl(fileName)

      const today = new Date().toISOString().split('T')[0]
      const now = new Date().toISOString()

      setStatusMessage('Saving record...')

      if (type === 'clock_in') {
        const { data, error } = await supabase
          .from('attendance')
          .insert({
            user_id: user.id,
            work_date: today,
            clock_in_at: now,
            clock_in_lat: latitude,
            clock_in_lng: longitude,
            clock_in_accuracy: accuracy,
            clock_in_photo_url: publicUrl,
            clock_in_address: address,
            store_id: selectedStoreId || null,
            status: 'incomplete',
          })
          .select('*, stores(name)')
          .single()

        if (error) throw error
        setTodayRecord(data)
        setHistoryRecords((prev) => [
          data,
          ...prev.filter((r) => r.id !== data.id),
        ])
        alert('Clock-in recorded successfully.')
      } else {
        if (!todayRecord) return
        const { data, error } = await supabase
          .from('attendance')
          .update({
            clock_out_at: now,
            clock_out_lat: latitude,
            clock_out_lng: longitude,
            clock_out_accuracy: accuracy,
            clock_out_photo_url: publicUrl,
            clock_out_address: address,
            store_id: selectedStoreId || todayRecord.store_id || null,
            status: 'present',
          })
          .eq('id', todayRecord.id)
          .select('*, stores(name)')
          .single()

        if (error) throw error
        setTodayRecord(data)
        setHistoryRecords((prev) => [
          data,
          ...prev.filter((r) => r.id !== data.id),
        ])
        alert('Clock-out recorded successfully.')
      }

      setPhotoData(null)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Location or upload failed.'
      alert('Error: ' + errorMessage)
    } finally {
      setLoading(false)
      setStatusMessage('')
    }
  }

  const totalDaysRecorded = historyRecords.length
  const completedDays = historyRecords.filter((r) => r.clock_out_at).length
  const attendanceRate =
    totalDaysRecorded > 0
      ? Math.round((completedDays / totalDaysRecorded) * 100)
      : 100

  return (
    <main className="min-h-screen bg-[#fbfbf9] pb-24 sm:pb-12 text-[#171716]">
      <StaffNav userRole={profile?.role || undefined} />

      <div className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
        <div className="border-b border-[#eaeae5] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] tracking-[0.25em] uppercase text-[#73726c] font-mono">
              STAFF OS / ATTENDANCE
            </span>
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight mt-1">
              ATTENDANCE{' '}
              <span className="font-serif italic font-normal">LOG</span>
            </h1>
          </div>

          <div className="flex border border-[#eaeae5] bg-white p-0.5 text-xs">
            <button
              onClick={() => setActiveTab('today')}
              className={`px-4 py-1.5 uppercase tracking-wider transition-colors ${
                activeTab === 'today'
                  ? 'bg-[#171716] text-white font-medium'
                  : 'text-[#73726c] hover:text-black'
              }`}
            >
              Action / Today
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 uppercase tracking-wider transition-colors ${
                activeTab === 'history'
                  ? 'bg-[#171716] text-white font-medium'
                  : 'text-[#73726c] hover:text-black'
              }`}
            >
              History ({historyRecords.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 bg-white border border-[#eaeae5] divide-x divide-[#eaeae5] text-center py-4">
          <div>
            <span className="text-[10px] tracking-widest uppercase text-[#73726c] block">
              DAYS RECORDED
            </span>
            <span className="text-xl sm:text-2xl font-mono font-light mt-1 block">
              {totalDaysRecorded}
            </span>
          </div>
          <div>
            <span className="text-[10px] tracking-widest uppercase text-[#73726c] block">
              COMPLETED
            </span>
            <span className="text-xl sm:text-2xl font-mono font-light mt-1 block">
              {completedDays}
            </span>
          </div>
          <div>
            <span className="text-[10px] tracking-widest uppercase text-[#73726c] block">
              ATTENDANCE RATE
            </span>
            <span className="text-xl sm:text-2xl font-mono font-light mt-1 block">
              {attendanceRate}%
            </span>
          </div>
        </div>

        {activeTab === 'today' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="bg-white border border-[#eaeae5] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-[#73726c]">
                  Verification Camera
                </span>
                {stream && (
                  <span className="flex items-center space-x-1.5 text-[10px] uppercase tracking-wider text-red-600">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                    <span>Live</span>
                  </span>
                )}
              </div>

              <div className="relative aspect-[3/4] bg-[#171716] rounded-none overflow-hidden flex items-center justify-center border border-[#eaeae5]">
                {photoData ? (
                  <Image
                    src={photoData}
                    alt="Captured Selfie"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                )}

                {!stream && !photoData && (
                  <button
                    onClick={startCamera}
                    className="absolute bg-white text-[#171716] px-5 py-2.5 text-xs uppercase tracking-widest border border-[#eaeae5] hover:bg-neutral-50 shadow-sm"
                  >
                    Open Camera
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {stream && (
                  <button
                    onClick={takeSnapshot}
                    className="w-full py-3 bg-[#171716] hover:bg-neutral-800 text-white text-xs uppercase tracking-widest transition"
                  >
                    Capture Snapshot
                  </button>
                )}

                {photoData && (
                  <button
                    onClick={() => {
                      setPhotoData(null)
                      startCamera()
                    }}
                    className="w-full py-3 bg-white border border-[#eaeae5] text-[#171716] hover:bg-neutral-50 text-xs uppercase tracking-widest transition"
                  >
                    Retake Photo
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white border border-[#eaeae5] p-6 space-y-6">
              <div>
                <span className="text-[10px] tracking-widest uppercase text-[#73726c] block">
                  STORE ALLOCATION
                </span>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  disabled={Boolean(todayRecord?.clock_out_at)}
                  className="mt-2 w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none focus:border-black"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#eaeae5]">
                <div className="flex justify-between text-xs">
                  <span className="text-[#73726c]">Clock In Timestamp:</span>
                  <span className="font-mono font-medium">
                    {todayRecord?.clock_in_at
                      ? new Date(todayRecord.clock_in_at).toLocaleTimeString()
                      : 'Pending'}
                  </span>
                </div>
                {todayRecord?.clock_in_address && (
                  <div className="text-[11px] text-[#73726c] bg-[#fbfbf9] p-2.5 border border-[#eaeae5]">
                    {todayRecord.clock_in_address}
                  </div>
                )}

                <div className="flex justify-between text-xs pt-2">
                  <span className="text-[#73726c]">Clock Out Timestamp:</span>
                  <span className="font-mono font-medium">
                    {todayRecord?.clock_out_at
                      ? new Date(todayRecord.clock_out_at).toLocaleTimeString()
                      : 'Pending'}
                  </span>
                </div>
                {todayRecord?.clock_out_address && (
                  <div className="text-[11px] text-[#73726c] bg-[#fbfbf9] p-2.5 border border-[#eaeae5]">
                    {todayRecord.clock_out_address}
                  </div>
                )}
              </div>

              {statusMessage && (
                <p className="text-center text-xs text-neutral-600 font-mono tracking-wider animate-pulse">
                  {statusMessage}
                </p>
              )}

              <div className="pt-4 border-t border-[#eaeae5]">
                {!todayRecord?.clock_in_at ? (
                  <button
                    onClick={() => handleAttendance('clock_in')}
                    disabled={loading || !photoData}
                    className="w-full py-4 bg-[#171716] hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white text-xs font-medium tracking-[0.2em] uppercase transition"
                  >
                    {loading ? 'VERIFYING...' : 'CONFIRM CLOCK IN'}
                  </button>
                ) : !todayRecord?.clock_out_at ? (
                  <button
                    onClick={() => handleAttendance('clock_out')}
                    disabled={loading || !photoData}
                    className="w-full py-4 bg-[#171716] hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white text-xs font-medium tracking-[0.2em] uppercase transition"
                  >
                    {loading ? 'VERIFYING...' : 'CONFIRM CLOCK OUT'}
                  </button>
                ) : (
                  <div className="text-center text-xs tracking-widest uppercase text-emerald-800 bg-emerald-50/60 border border-emerald-200 py-3.5">
                    ✓ TODAY&apos;S SHIFT COMPLETED
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white border border-[#eaeae5]">
            <div className="p-4 border-b border-[#eaeae5]">
              <span className="text-xs uppercase tracking-wider text-[#73726c]">
                Recent Shifts (Last 30 Days)
              </span>
            </div>

            {historyRecords.length === 0 ? (
              <p className="p-8 text-center text-xs text-[#73726c]">
                No attendance logs found yet.
              </p>
            ) : (
              <div className="divide-y divide-[#eaeae5]">
                {historyRecords.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#fbfbf9] transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      {item.clock_in_photo_url ? (
                        <div className="relative w-12 h-14 border border-[#eaeae5] overflow-hidden">
                          <Image
                            src={item.clock_in_photo_url}
                            alt="Selfie"
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-14 bg-neutral-100 border border-[#eaeae5] flex items-center justify-center text-[9px] text-[#73726c]">
                          No Photo
                        </div>
                      )}

                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">
                            {new Intl.DateTimeFormat('en-GB', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                            }).format(new Date(item.work_date))}
                          </span>
                          <span className="text-[10px] tracking-wider uppercase bg-neutral-100 text-[#73726c] px-2 py-0.5">
                            {item.stores?.name || 'Store'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#73726c] mt-0.5 line-clamp-1">
                          {item.clock_in_address || 'Address logged'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6 text-xs font-mono">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-[#73726c] block">
                          IN
                        </span>
                        <span>
                          {item.clock_in_at
                            ? new Date(item.clock_in_at).toLocaleTimeString(
                                [],
                                { hour: '2-digit', minute: '2-digit' }
                              )
                            : '--:--'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-[#73726c] block">
                          OUT
                        </span>
                        <span>
                          {item.clock_out_at
                            ? new Date(item.clock_out_at).toLocaleTimeString(
                                [],
                                { hour: '2-digit', minute: '2-digit' }
                              )
                            : '--:--'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-[#73726c] block">
                          STATUS
                        </span>
                        <span
                          className={
                            item.clock_out_at
                              ? 'text-emerald-700 font-sans uppercase text-[10px]'
                              : 'text-amber-700 font-sans uppercase text-[10px]'
                          }
                        >
                          {item.clock_out_at ? 'Complete' : 'Incomplete'}
                        </span>
                      </div>
                    </div>
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