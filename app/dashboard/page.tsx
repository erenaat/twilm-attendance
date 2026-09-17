'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../lib/supabase'
import StaffNav from '../components/StaffNav'

interface Store {
  id: string
  name: string
}

interface ProfileData {
  id: string
  full_name: string | null
  email: string | null
  role: string
  employee_code?: string | null
  store_id: string | null
  stores?: Store | Store[] | null
}

interface AttendanceRecord {
  id: string
  work_date: string
  clock_in_at: string | null
  clock_in_lat: number | null
  clock_in_lng: number | null
  clock_in_address: string | null
  clock_in_photo_url: string | null
  clock_out_at: string | null
  clock_out_lat: number | null
  clock_out_lng: number | null
  clock_out_address: string | null
  clock_out_photo_url: string | null
  status: string
  punctuality_status?: string | null
  late_minutes?: number | null
  overtime_minutes?: number | null
  handover_notes?: string | null
  cash_drawer_balance?: string | null
}

export default function AttendancePage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [assignedStore, setAssignedStore] = useState<Store | null>(null)
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([])
  const [scheduledStart, setScheduledStart] = useState<string>('09:40')
  const [scheduledEnd, setScheduledEnd] = useState<string>('18:00')
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('')

  const [cameraActive, setCameraActive] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [detectedAddress, setDetectedAddress] = useState<string>('')
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false)

  // Handover Modal State
  const [showHandoverModal, setShowHandoverModal] = useState(false)
  const [handoverNote, setHandoverNote] = useState('')
  const [cashBalance, setCashBalance] = useState('')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('')

  // Live Bali Time ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTimeStr(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Makassar',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(now)
      )
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // Convert Coordinates to Address
  const fetchAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en,id',
            'User-Agent': 'TWILM-Staff-OS',
          },
        }
      )
      if (!response.ok) return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      const data = await response.json()
      return data?.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    } catch {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    }
  }

  useEffect(() => {
    let isMounted = true

    const initializeAttendance = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      // Fetch profile
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, employee_code, store_id, stores(id, name)')
        .eq('id', session.user.id)
        .maybeSingle()

      let storeName = ''
      if (profData && isMounted) {
        setProfile(profData as unknown as ProfileData)
        const resolvedStore = Array.isArray(profData.stores)
          ? (profData.stores[0] as Store | undefined)
          : (profData.stores as Store | null)

        if (resolvedStore) {
          setAssignedStore(resolvedStore)
          storeName = resolvedStore.name?.toLowerCase() || ''
        }
      }

      // Fetch today's schedule
      const today = new Date().toISOString().split('T')[0]
      const { data: schData } = await supabase
        .from('schedules')
        .select('shift_start, shift_end, is_day_off')
        .eq('user_id', session.user.id)
        .eq('shift_date', today)
        .maybeSingle()

      if (schData && isMounted && schData.shift_start && schData.shift_end) {
        setScheduledStart(schData.shift_start.slice(0, 5))
        setScheduledEnd(schData.shift_end.slice(0, 5))
      } else if (isMounted) {
        const isOffice =
          !storeName ||
          storeName.includes('office') ||
          storeName.includes('hq') ||
          storeName.includes('headquarter')

        if (isOffice) {
          setScheduledStart('09:00')
          setScheduledEnd('17:00')
        } else {
          const nowHour = new Date().getHours()
          if (nowHour >= 11) {
            setScheduledStart('11:40')
            setScheduledEnd('20:00')
          } else {
            setScheduledStart('09:40')
            setScheduledEnd('18:00')
          }
        }
      }

      // Fetch today's attendance record
      const { data: attData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('work_date', today)
        .maybeSingle()

      if (attData && isMounted) {
        setTodayRecord(attData as AttendanceRecord)
      }

      // Fetch History
      const { data: historyData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', session.user.id)
        .order('work_date', { ascending: false })
        .limit(15)

      if (historyData && isMounted) {
        setHistoryRecords(historyData as AttendanceRecord[])
      }

      if (isMounted) setLoading(false)

      // Geolocation
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        if (isMounted) setDetectingLocation(true)
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            if (!isMounted) return
            const coords = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy),
            }
            setCurrentCoords(coords)

            const address = await fetchAddressFromCoords(coords.lat, coords.lng)
            if (isMounted) {
              setDetectedAddress(address)
              setDetectingLocation(false)
            }
          },
          (err) => {
            console.warn('Geolocation notice:', err.message)
            if (isMounted) {
              setDetectedAddress('Location permission not granted')
              setDetectingLocation(false)
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
      } else if (isMounted) {
        setDetectedAddress('Location not supported by device')
      }
    }

    initializeAttendance()

    return () => {
      isMounted = false
    }
  }, [router])

  // Camera Handling
  const startCamera = async () => {
    setCapturedPhoto(null)
    setCameraActive(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch {
      setStatusMessage('Camera access was denied. Please allow permissions.')
      setCameraActive(false)
    }
  }

  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = 480
    canvas.height = 480
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, 480, 480)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      setCapturedPhoto(dataUrl)
    }

    const stream = video.srcObject as MediaStream
    if (stream) stream.getTracks().forEach((t) => t.stop())
    setCameraActive(false)
  }

  const retakePhoto = () => {
    setCapturedPhoto(null)
    startCamera()
  }

  const uploadPhoto = async (dataUrl: string, type: 'in' | 'out'): Promise<string | null> => {
    if (!profile) return null
    try {
      const base64 = dataUrl.split(',')[1]
      const byteCharacters = atob(base64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'image/jpeg' })

      const fileName = `${profile.id}/${new Date().toISOString().split('T')[0]}_${type}_${Date.now()}.jpg`
      const { error: uploadErr } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (uploadErr) return null
      const { data: publicUrlData } = supabase.storage
        .from('attendance-photos')
        .getPublicUrl(fileName)
      return publicUrlData.publicUrl
    } catch {
      return null
    }
  }

  const computePunctuality = () => {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMin = now.getMinutes()
    const totalCurrentMins = currentHour * 60 + currentMin

    const [startH, startM] = scheduledStart.split(':').map((v) => parseInt(v, 10))
    const scheduledStartMins = startH * 60 + startM
    const gracePeriodMins = 5

    if (totalCurrentMins > scheduledStartMins + gracePeriodMins) {
      const lateBy = totalCurrentMins - scheduledStartMins
      return { status: 'late', minutes: lateBy }
    }
    return { status: 'on_time', minutes: 0 }
  }

  const computeOvertime = () => {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMin = now.getMinutes()
    const totalCurrentMins = currentHour * 60 + currentMin

    const [endH, endM] = scheduledEnd.split(':').map((v) => parseInt(v, 10))
    const scheduledEndMins = endH * 60 + endM

    if (totalCurrentMins > scheduledEndMins + 10) {
      return totalCurrentMins - scheduledEndMins
    }
    return 0
  }

  const handleClockIn = async () => {
    if (!profile) return
    if (!capturedPhoto) {
      alert('Please take a verification selfie first.')
      return
    }

    setSubmitting(true)
    setStatusMessage('Synchronizing presence & location...')

    let finalAddress = detectedAddress
    if (!finalAddress && currentCoords) {
      finalAddress = await fetchAddressFromCoords(currentCoords.lat, currentCoords.lng)
    }

    const photoUrl = await uploadPhoto(capturedPhoto, 'in')
    const today = new Date().toISOString().split('T')[0]
    const { status: punctualityStatus, minutes: lateMinutes } = computePunctuality()

    const payload = {
      user_id: profile.id,
      store_id: assignedStore?.id || profile.store_id || null,
      work_date: today,
      clock_in_at: new Date().toISOString(),
      clock_in_lat: currentCoords?.lat || null,
      clock_in_lng: currentCoords?.lng || null,
      clock_in_accuracy: currentCoords?.accuracy || null,
      clock_in_address: finalAddress || 'Location logged without street details',
      clock_in_photo_url: photoUrl,
      status: 'present',
      punctuality_status: punctualityStatus,
      late_minutes: lateMinutes,
    }

    const { data, error } = await supabase
      .from('attendance')
      .upsert(payload, { onConflict: 'user_id,work_date' })
      .select()
      .single()

    setSubmitting(false)

    if (error) {
      alert('Failed to clock in: ' + error.message)
    } else if (data) {
      setTodayRecord(data as AttendanceRecord)
      setHistoryRecords((prev) => [
        data as AttendanceRecord,
        ...prev.filter((r) => r.id !== data.id),
      ])
      setCapturedPhoto(null)
      alert(
        punctualityStatus === 'late'
          ? `Clocked in successfully. Marked as LATE (${lateMinutes} mins).`
          : `Clocked in successfully. Status: ON-TIME. Have an inspiring shift!`
      )
    }
  }

  const submitClockOut = async () => {
    if (!profile || !todayRecord) return
    if (!capturedPhoto) {
      alert('Please take a checkout selfie before clocking out.')
      return
    }

    setSubmitting(true)

    let finalAddress = detectedAddress
    if (!finalAddress && currentCoords) {
      finalAddress = await fetchAddressFromCoords(currentCoords.lat, currentCoords.lng)
    }

    const photoUrl = await uploadPhoto(capturedPhoto, 'out')
    const overtimeMins = computeOvertime()

    const { data, error } = await supabase
      .from('attendance')
      .update({
        clock_out_at: new Date().toISOString(),
        clock_out_lat: currentCoords?.lat || null,
        clock_out_lng: currentCoords?.lng || null,
        clock_out_accuracy: currentCoords?.accuracy || null,
        clock_out_address: finalAddress || 'Location logged without street details',
        clock_out_photo_url: photoUrl,
        overtime_minutes: overtimeMins,
        handover_notes: handoverNote.trim() || null,
        cash_drawer_balance: cashBalance.trim() || null,
      })
      .eq('id', todayRecord.id)
      .select()
      .single()

    setSubmitting(false)
    setShowHandoverModal(false)

    if (error) {
      alert('Failed to clock out: ' + error.message)
    } else if (data) {
      setTodayRecord(data as AttendanceRecord)
      setHistoryRecords((prev) => [
        data as AttendanceRecord,
        ...prev.filter((r) => r.id !== data.id),
      ])
      setCapturedPhoto(null)
      alert('Shift completed and handover note saved.')
    }
  }

  const formatTime = (ts: string | null) =>
    ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'

  const firstName = profile?.full_name?.split(' ')[0] || 'Associate'
  const storeDisplay = assignedStore?.name || 'Office / Headquarter'

  return (
    <main className="min-h-screen bg-[#F7F5F0] pb-32 md:pb-16 text-[#1A1A18]">
      <StaffNav userRole={profile?.role} />

      <div className="max-w-3xl mx-auto px-4 pt-6 md:pt-8 space-y-6">
        {/* Warm Boutique Header Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E2320] via-[#2A2E2B] to-[#1A1A18] text-white p-6 sm:p-7 shadow-lg border border-[#E3DDD1]">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-56 h-56 bg-[#C26D53]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-[#947352]/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] tracking-[0.3em] uppercase text-[#D8C7B5] font-mono">
                  TWILM STAFF OS
                </span>
                <span className="w-1 h-1 rounded-full bg-[#C26D53]" />
                <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/15">
                  {profile?.role || 'STAFF'}
                </span>
                {profile?.employee_code && (
                  <span className="text-[10px] uppercase font-mono text-[#D8C7B5]">
                    #{profile.employee_code}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-light tracking-tight mt-2 text-[#FAF7F2]">
                WELCOME, <span className="font-serif italic font-normal text-[#E8C5A8]">{firstName}</span>
              </h1>
              <p className="text-xs text-[#B3AEA6] mt-1">
                Record your attendance selfie for today&apos;s shift.
              </p>
            </div>

            {/* Time & Shift Pill */}
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/10 text-left sm:text-right min-w-[180px]">
              <div className="flex items-center sm:justify-end space-x-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C26D53] animate-ping" />
                <span className="text-[9px] uppercase tracking-widest text-[#D8C7B5] font-mono">
                  BALI WITA
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-mono font-light text-white tracking-tight block">
                {currentTimeStr || '00:00:00'}
              </span>
              <span className="text-[11px] font-mono text-[#C2B7A8] block mt-1">
                Shift: {scheduledStart} — {scheduledEnd}
              </span>
            </div>
          </div>
        </div>

        {/* Location & Assigned Outlet Card */}
        <div className="rounded-xl bg-white border border-[#E8E2D5] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#FBF0EC] border border-[#F2D7CE] flex items-center justify-center text-[#C26D53] text-sm shadow-xs">
              📍
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#8A857C] font-mono block">
                STORE ASSIGNMENT
              </span>
              <span className="font-medium text-[#1A1A18] text-sm tracking-tight">{storeDisplay}</span>
            </div>
          </div>

          <div className="sm:text-right max-w-md bg-[#FAF8F5] sm:bg-transparent p-2.5 sm:p-0 rounded-lg sm:rounded-none border sm:border-0 border-[#E8E2D5]">
            <span className="text-[10px] uppercase tracking-wider text-[#8A857C] font-mono block">
              DETECTED STREET ADDRESS
            </span>
            <span className="font-mono text-[11px] text-[#423E37] truncate block mt-0.5">
              {detectingLocation ? 'Resolving street address...' : detectedAddress || 'GPS locked'}
            </span>
          </div>
        </div>

        {/* Camera Terminal Container */}
        <div className="rounded-2xl bg-white border border-[#E8E2D5] p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col items-center justify-center space-y-5">
            {/* Viewfinder Frame with Terracotta Accents */}
            <div className="relative w-64 h-64 rounded-2xl bg-[#FAF8F5] border-2 border-dashed border-[#D6CEC0] flex items-center justify-center overflow-hidden shadow-inner group">
              {/* Boutique Viewfinder Reticles */}
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[#C26D53] pointer-events-none" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[#C26D53] pointer-events-none" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-[#C26D53] pointer-events-none" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-[#C26D53] pointer-events-none" />

              {cameraActive ? (
                <video ref={videoRef} playsInline autoPlay className="w-full h-full object-cover" />
              ) : capturedPhoto ? (
                <Image src={capturedPhoto} alt="Verification Selfie" fill className="object-cover" />
              ) : (
                <div className="text-center p-6 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[#FBF0EC] text-[#C26D53] mx-auto flex items-center justify-center text-lg border border-[#F2D7CE] shadow-xs">
                    ✦
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-[#8A857C] font-mono block">
                    CAMERA VERIFICATION
                  </span>
                  <p className="text-xs text-[#736E66] max-w-[180px] mx-auto leading-relaxed">
                    Take a clear selfie to mark your shift entry
                  </p>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />

            {/* Camera Controls */}
            <div className="flex items-center space-x-3">
              {!cameraActive && !capturedPhoto && !todayRecord?.clock_out_at && (
                <button
                  onClick={startCamera}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-full bg-[#1A1A18] text-white text-xs uppercase tracking-widest hover:bg-[#C26D53] disabled:opacity-30 transition-all duration-200 shadow-sm flex items-center space-x-2"
                >
                  <span>Start Camera</span>
                </button>
              )}

              {cameraActive && (
                <button
                  onClick={captureSnapshot}
                  className="px-7 py-2.5 rounded-full bg-[#C26D53] text-white text-xs uppercase tracking-widest hover:bg-[#AD5E46] transition-all duration-200 shadow-md animate-pulse"
                >
                  Snap Selfie
                </button>
              )}

              {capturedPhoto && !cameraActive && !todayRecord?.clock_out_at && (
                <button
                  onClick={retakePhoto}
                  className="px-4 py-2 rounded-full border border-[#D6CEC0] bg-[#FAF8F5] text-xs uppercase tracking-wider text-[#635E56] hover:text-[#1A1A18] hover:border-[#1A1A18] transition"
                >
                  Retake Photo
                </button>
              )}
            </div>
          </div>

          {/* Action Trigger */}
          <div className="border-t border-[#E8E2D5] pt-5 space-y-3">
            {!todayRecord?.clock_in_at ? (
              <button
                onClick={handleClockIn}
                disabled={submitting || !capturedPhoto}
                className="w-full py-4 rounded-xl bg-[#1A1A18] hover:bg-[#C26D53] disabled:bg-[#E8E2D5] disabled:text-[#A39E94] text-white text-xs uppercase tracking-[0.2em] font-medium transition-all duration-300 shadow-sm disabled:shadow-none"
              >
                {submitting ? 'Recording Presence...' : 'Verify & Clock In'}
              </button>
            ) : !todayRecord?.clock_out_at ? (
              <button
                onClick={() => {
                  if (!capturedPhoto) {
                    alert('Please take a checkout selfie before clocking out.')
                    return
                  }
                  setShowHandoverModal(true)
                }}
                disabled={submitting}
                className="w-full py-4 rounded-xl bg-[#2E473B] hover:bg-[#23382D] disabled:bg-[#E8E2D5] text-white text-xs uppercase tracking-[0.2em] font-medium transition-all duration-300 shadow-sm"
              >
                Proceed to Shift Handover & Clock Out
              </button>
            ) : (
              <div className="p-4 rounded-xl bg-[#EDF4F0] text-center border border-[#CFE2D7] text-xs">
                <span className="font-medium text-[#2E473B] uppercase tracking-wider text-[11px] block">
                  ✓ Shift Finished for Today
                </span>
                <p className="text-[#5B7869] text-[11px] font-mono mt-0.5">
                  Clock in: {formatTime(todayRecord.clock_in_at)} — Clock out:{' '}
                  {formatTime(todayRecord.clock_out_at)}
                </p>
              </div>
            )}

            {statusMessage && (
              <p className="text-[11px] text-center text-[#8A857C] font-mono">{statusMessage}</p>
            )}
          </div>
        </div>

        {/* My Attendance History Table */}
        <div id="history" className="rounded-2xl bg-white border border-[#E8E2D5] overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5 border-b border-[#E8E2D5] bg-[#FAF8F5] flex justify-between items-center">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-[#1A1A18]">
                My Shift Logbook
              </span>
              <p className="text-[11px] text-[#8A857C]">
                Your personal check-in history and punctuality badges.
              </p>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-[#EAE5DA] text-[#4A453E]">
              {historyRecords.length} Shifts Recorded
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1A1A18]">
              <thead className="bg-[#FAF8F5] text-[10px] uppercase tracking-wider text-[#8A857C] border-b border-[#E8E2D5]">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Clock In</th>
                  <th className="p-3.5">Punctuality</th>
                  <th className="p-3.5">Clock Out</th>
                  <th className="p-3.5">Hours</th>
                  <th className="p-3.5">Handover Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2D5]">
                {historyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-xs text-[#8A857C]">
                      No previous shifts recorded yet.
                    </td>
                  </tr>
                ) : (
                  historyRecords.map((r) => {
                    let totalHours = '--'
                    if (r.clock_in_at && r.clock_out_at) {
                      const diffMs =
                        new Date(r.clock_out_at).getTime() - new Date(r.clock_in_at).getTime()
                      const hrs = Math.floor(diffMs / (1000 * 60 * 60))
                      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                      totalHours = `${hrs}h ${mins}m`
                    }

                    return (
                      <tr key={r.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                        <td className="p-3.5 font-mono text-xs whitespace-nowrap text-[#4A453E]">{r.work_date}</td>
                        <td className="p-3.5 font-mono text-xs whitespace-nowrap font-medium">
                          {formatTime(r.clock_in_at)}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          {r.punctuality_status === 'late' ? (
                            <span className="inline-block text-[9px] uppercase px-2 py-0.5 rounded-md bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4] font-mono font-medium">
                              Late ({r.late_minutes || 0}m)
                            </span>
                          ) : r.clock_in_at ? (
                            <span className="inline-block text-[9px] uppercase px-2 py-0.5 rounded-md bg-[#EDF4F0] text-[#2E473B] border border-[#CFE2D7] font-mono font-medium">
                              On-Time
                            </span>
                          ) : (
                            <span className="text-[#A39E94]">--</span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-xs whitespace-nowrap">
                          {formatTime(r.clock_out_at)}
                        </td>
                        <td className="p-3.5 font-mono text-xs whitespace-nowrap">{totalHours}</td>
                        <td className="p-3.5 text-[11px] text-[#736E66] max-w-xs truncate">
                          {r.handover_notes || <span className="text-[#A39E94] italic">None</span>}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shift Handover Modal */}
        {showHandoverModal && (
          <div className="fixed inset-0 z-50 bg-[#1A1A18]/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-[#E8E2D5] max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-[#C26D53] font-mono block">
                  END OF SHIFT
                </span>
                <h2 className="text-xl font-light tracking-tight mt-0.5 text-[#1A1A18]">
                  Shift Handover <span className="font-serif italic font-normal text-[#947352]">Logbook</span>
                </h2>
                <p className="text-xs text-[#736E66] mt-1">
                  Leave brief notes for the next shift associate and note the cash balance.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#8A857C] font-mono block mb-1">
                    Store Handover Notes
                  </label>
                  <textarea
                    rows={3}
                    value={handoverNote}
                    onChange={(e) => setHandoverNote(e.target.value)}
                    placeholder="Customer reservations, fitting room checks, restock needed..."
                    className="w-full p-3 text-xs rounded-xl bg-[#FAF8F5] border border-[#E8E2D5] text-[#1A1A18] focus:outline-none focus:border-[#C26D53] resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#8A857C] font-mono block mb-1">
                    Closing Cash Drawer / Petty Cash (Optional)
                  </label>
                  <input
                    type="text"
                    value={cashBalance}
                    onChange={(e) => setCashBalance(e.target.value)}
                    placeholder="e.g. IDR 1.500.000 / Balanced"
                    className="w-full p-2.5 text-xs rounded-xl bg-[#FAF8F5] border border-[#E8E2D5] text-[#1A1A18] focus:outline-none focus:border-[#C26D53] font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E8E2D5]">
                <button
                  type="button"
                  onClick={() => setShowHandoverModal(false)}
                  className="px-4 py-2 text-xs uppercase tracking-wider text-[#736E66] hover:text-[#1A1A18] transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={submitClockOut}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-full bg-[#1A1A18] hover:bg-[#2E473B] text-white text-xs uppercase tracking-widest disabled:opacity-40 transition-colors shadow-sm"
                >
                  {submitting ? 'Submitting...' : 'Complete Clock Out'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}