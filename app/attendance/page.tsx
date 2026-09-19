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
  const [shiftName, setShiftName] = useState<string>('Morning Shift')
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('')

  const [cameraActive, setCameraActive] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [detectedAddress, setDetectedAddress] = useState<string>('')
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false)

  // Handover Modal
  const [showHandoverModal, setShowHandoverModal] = useState(false)
  const [handoverNote, setHandoverNote] = useState('')
  const [cashBalance, setCashBalance] = useState('')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('')

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

      const today = new Date().toISOString().split('T')[0]
      const { data: schData } = await supabase
        .from('schedules')
        .select('shift_start, shift_end, is_day_off, notes')
        .eq('user_id', session.user.id)
        .eq('shift_date', today)
        .maybeSingle()

      if (schData && isMounted && schData.shift_start && schData.shift_end) {
        setScheduledStart(schData.shift_start.slice(0, 5))
        setScheduledEnd(schData.shift_end.slice(0, 5))
        setShiftName(schData.notes || 'Scheduled Shift')
      } else if (isMounted) {
        const isOffice =
          !storeName ||
          storeName.includes('office') ||
          storeName.includes('hq') ||
          storeName.includes('headquarter')

        const dayOfWeek = new Date().getDay() // 0: Sun, 1: Mon, ..., 6: Sat

        if (isOffice) {
          if (dayOfWeek === 6) {
            // Sabtu: 08:00 - 13:00
            setScheduledStart('08:00')
            setScheduledEnd('13:00')
            setShiftName('Office Saturday')
          } else {
            // Senin - Jumat: 09:00 - 17:00
            setScheduledStart('09:00')
            setScheduledEnd('17:00')
            setShiftName('Office Weekday')
          }
        } else {
          // Boutiques: Batu Mejan, Nelayan, Bingin
          // Morning Shift (09:40 - 18:00) vs Afternoon Shift (11:40 - 20:00)
          const nowHour = new Date().getHours()
          if (nowHour >= 11) {
            setScheduledStart('11:40')
            setScheduledEnd('20:00')
            setShiftName('Afternoon Shift')
          } else {
            setScheduledStart('09:40')
            setScheduledEnd('18:00')
            setShiftName('Morning Shift')
          }
        }
      }

      const { data: attData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('work_date', today)
        .maybeSingle()

      if (attData && isMounted) {
        setTodayRecord(attData as AttendanceRecord)
      }

      const { data: historyData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', session.user.id)
        .order('work_date', { ascending: false })
        .limit(10)

      if (historyData && isMounted) {
        setHistoryRecords(historyData as AttendanceRecord[])
      }

      if (isMounted) setLoading(false)

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
            console.warn('GPS Notice:', err.message)
            if (isMounted) {
              setDetectedAddress('Location recorded without street address')
              setDetectingLocation(false)
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
      } else if (isMounted) {
        setDetectedAddress('Location not supported')
      }
    }

    initializeAttendance()

    return () => {
      isMounted = false
    }
  }, [router])

  const selectStoreShiftManually = (type: 'morning' | 'afternoon') => {
    if (type === 'morning') {
      setScheduledStart('09:40')
      setScheduledEnd('18:00')
      setShiftName('Morning Shift')
    } else {
      setScheduledStart('11:40')
      setScheduledEnd('20:00')
      setShiftName('Afternoon Shift')
    }
  }

  const startCamera = async () => {
    setCapturedPhoto(null)
    setCameraActive(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch {
      setStatusMessage('Camera permission denied.')
      setCameraActive(false)
    }
  }

  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = 400
    canvas.height = 400
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, 400, 400)
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

  const handleClockIn = async () => {
    if (!profile) return
    if (!capturedPhoto) {
      alert('Please snap a selfie first.')
      return
    }

    setSubmitting(true)
    setStatusMessage('Synchronizing presence...')

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
      alert('Error: ' + error.message)
    } else if (data) {
      setTodayRecord(data as AttendanceRecord)
      setHistoryRecords((prev) => [
        data as AttendanceRecord,
        ...prev.filter((r) => r.id !== data.id),
      ])
      setCapturedPhoto(null)
      alert(
        punctualityStatus === 'late'
          ? `Clocked in (LATE: ${lateMinutes}m). Shift was ${scheduledStart}.`
          : `Clocked in (ON-TIME). Have a wonderful shift!`
      )
    }
  }

  const submitClockOut = async () => {
    if (!profile || !todayRecord) return
    if (!capturedPhoto) {
      alert('Please take a checkout selfie first.')
      return
    }

    setSubmitting(true)

    let finalAddress = detectedAddress
    if (!finalAddress && currentCoords) {
      finalAddress = await fetchAddressFromCoords(currentCoords.lat, currentCoords.lng)
    }

    const photoUrl = await uploadPhoto(capturedPhoto, 'out')

    const { data, error } = await supabase
      .from('attendance')
      .update({
        clock_out_at: new Date().toISOString(),
        clock_out_lat: currentCoords?.lat || null,
        clock_out_lng: currentCoords?.lng || null,
        clock_out_accuracy: currentCoords?.accuracy || null,
        clock_out_address: finalAddress || 'Location logged without street details',
        clock_out_photo_url: photoUrl,
        handover_notes: handoverNote.trim() || null,
        cash_drawer_balance: cashBalance.trim() || null,
      })
      .eq('id', todayRecord.id)
      .select()
      .single()

    setSubmitting(false)
    setShowHandoverModal(false)

    if (error) {
      alert('Error: ' + error.message)
    } else if (data) {
      setTodayRecord(data as AttendanceRecord)
      setHistoryRecords((prev) => [
        data as AttendanceRecord,
        ...prev.filter((r) => r.id !== data.id),
      ])
      setCapturedPhoto(null)
      alert('Shift completed!')
    }
  }

  const formatTime = (ts: string | null) =>
    ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'

  const firstName = profile?.full_name?.split(' ')[0] || 'Associate'
  const storeNameLower = assignedStore?.name?.toLowerCase() || ''
  const isOfficeStaff =
    !storeNameLower ||
    storeNameLower.includes('office') ||
    storeNameLower.includes('hq') ||
    storeNameLower.includes('headquarter')

  return (
    <main className="min-h-screen bg-[#F7F5F0] pb-24 text-[#1A1A18] overflow-x-hidden">
      <StaffNav userRole={profile?.role} />

      <div className="w-full max-w-xl mx-auto px-3.5 sm:px-6 pt-4 sm:pt-6 space-y-4">
        {/* Mobile-Friendly Boutique Hero Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E2320] via-[#2A2E2B] to-[#1A1A18] text-white p-4 sm:p-6 shadow-md border border-[#E3DDD1]">
          <div className="relative z-10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[8px] sm:text-[9px] tracking-[0.25em] uppercase text-[#D8C7B5] font-mono">
                TWILM PRESENCE
              </span>
              <span className="text-[9px] font-mono text-[#D8C7B5] bg-white/10 px-2 py-0.5 rounded-full">
                {currentTimeStr || '00:00:00'} WITA
              </span>
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-light tracking-tight text-[#FAF7F2]">
                WELCOME, <span className="font-serif italic text-[#E8C5A8]">{firstName}</span>
              </h1>
              <p className="text-[11px] text-[#B3AEA6] mt-0.5 font-mono">
                {shiftName}: <span className="text-white font-medium">{scheduledStart} — {scheduledEnd}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Store & Shift Selector */}
        <div className="rounded-xl bg-white border border-[#E8E2D5] p-3.5 space-y-2.5 text-xs shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider text-[#8A857C] font-mono">
              LOCATION
            </span>
            <span className="font-medium text-[#1A1A18] text-xs truncate">
              {assignedStore?.name || 'Office / Headquarter'}
            </span>
          </div>

          {/* 2 Simple Shift Buttons for Store Associates */}
          {!isOfficeStaff && !todayRecord?.clock_in_at && (
            <div className="border-t border-[#E8E2D5]/60 pt-2 space-y-1">
              <span className="text-[9px] uppercase tracking-wider text-[#8A857C] font-mono block">
                CHOOSE STORE SHIFT:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => selectStoreShiftManually('morning')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-mono transition border ${
                    scheduledStart === '09:40'
                      ? 'bg-[#191C1A] text-white border-[#191C1A]'
                      : 'bg-[#FAF8F5] text-[#59544C] border-[#E8E2D5] hover:border-[#191C1A]'
                  }`}
                >
                  Morning (09:40 - 18:00)
                </button>
                <button
                  type="button"
                  onClick={() => selectStoreShiftManually('afternoon')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-mono transition border ${
                    scheduledStart === '11:40'
                      ? 'bg-[#191C1A] text-white border-[#191C1A]'
                      : 'bg-[#FAF8F5] text-[#59544C] border-[#E8E2D5] hover:border-[#191C1A]'
                  }`}
                >
                  Afternoon (11:40 - 20:00)
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-[#E8E2D5]/60 pt-2 flex items-start justify-between gap-2">
            <span className="text-[9px] uppercase tracking-wider text-[#8A857C] font-mono shrink-0">
              GPS ADDR
            </span>
            <span className="font-mono text-[10px] text-[#59544C] text-right line-clamp-2">
              {detectingLocation ? 'Locating...' : detectedAddress || 'GPS locked'}
            </span>
          </div>
        </div>

        {/* Camera Terminal */}
        <div className="rounded-2xl bg-white border border-[#E8E2D5] p-4 sm:p-6 space-y-4 shadow-sm">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="relative w-full max-w-[260px] h-[260px] rounded-2xl bg-[#FAF8F5] border-2 border-dashed border-[#D6CEC0] flex items-center justify-center overflow-hidden shadow-inner">
              <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-[#C26D53]" />
              <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-[#C26D53]" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-[#C26D53]" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-[#C26D53]" />

              {cameraActive ? (
                <video ref={videoRef} playsInline autoPlay className="w-full h-full object-cover" />
              ) : capturedPhoto ? (
                <Image src={capturedPhoto} alt="Verification" fill className="object-cover" />
              ) : (
                <div className="text-center p-4 space-y-1">
                  <div className="w-10 h-10 rounded-full bg-[#FBF0EC] text-[#C26D53] mx-auto flex items-center justify-center text-sm">
                    ✦
                  </div>
                  <span className="text-[9px] uppercase tracking-widest text-[#8A857C] font-mono block">
                    CAMERA VERIFICATION
                  </span>
                  <p className="text-[11px] text-[#736E66]">
                    Snap a selfie to record presence
                  </p>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex items-center space-x-2">
              {!cameraActive && !capturedPhoto && !todayRecord?.clock_out_at && (
                <button
                  onClick={startCamera}
                  disabled={loading}
                  className="px-5 py-2 rounded-full bg-[#1A1A18] text-white text-[11px] uppercase tracking-wider hover:bg-[#C26D53] transition shadow-xs"
                >
                  Start Camera
                </button>
              )}

              {cameraActive && (
                <button
                  onClick={captureSnapshot}
                  className="px-6 py-2 rounded-full bg-[#C26D53] text-white text-[11px] uppercase tracking-wider shadow-sm animate-pulse"
                >
                  Snap Selfie
                </button>
              )}

              {capturedPhoto && !cameraActive && !todayRecord?.clock_out_at && (
                <button
                  onClick={retakePhoto}
                  className="px-3.5 py-1.5 rounded-full border border-[#D6CEC0] bg-[#FAF8F5] text-[11px] text-[#635E56]"
                >
                  Retake Photo
                </button>
              )}
            </div>
          </div>

          <div className="pt-2">
            {!todayRecord?.clock_in_at ? (
              <button
                onClick={handleClockIn}
                disabled={submitting || !capturedPhoto}
                className="w-full py-3.5 rounded-xl bg-[#1A1A18] hover:bg-[#C26D53] disabled:bg-[#E8E2D5] disabled:text-[#A39E94] text-white text-xs uppercase tracking-[0.15em] font-medium transition shadow-xs"
              >
                {submitting ? 'Recording...' : `Verify & Clock In (${scheduledStart})`}
              </button>
            ) : !todayRecord?.clock_out_at ? (
              <button
                onClick={() => {
                  if (!capturedPhoto) {
                    alert('Please snap a checkout selfie first.')
                    return
                  }
                  setShowHandoverModal(true)
                }}
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-[#2E473B] hover:bg-[#23382D] text-white text-xs uppercase tracking-[0.15em] font-medium transition shadow-xs"
              >
                Shift Handover &amp; Clock Out
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-[#EDF4F0] text-center border border-[#CFE2D7] text-xs">
                <span className="font-medium text-[#2E473B] uppercase text-[10px] block">
                  ✓ Shift Finished
                </span>
                <p className="text-[#5B7869] text-[10px] font-mono mt-0.5">
                  In: {formatTime(todayRecord.clock_in_at)} • Out: {formatTime(todayRecord.clock_out_at)}
                </p>
              </div>
            )}

            {statusMessage && (
              <p className="text-[10px] text-center text-[#8A857C] font-mono mt-2">{statusMessage}</p>
            )}
          </div>
        </div>

        {/* History Table */}
        <div id="history" className="rounded-xl bg-white border border-[#E8E2D5] overflow-hidden shadow-xs">
          <div className="p-3 bg-[#FAF8F5] border-b border-[#E8E2D5] flex justify-between items-center">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#1A1A18]">
              Recent Logs
            </span>
            <span className="text-[10px] font-mono text-[#8A857C]">
              {historyRecords.length} Shifts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1A1A18]">
              <thead className="bg-[#FAF8F5] text-[9px] uppercase tracking-wider text-[#8A857C] border-b border-[#E8E2D5]">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">In</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2D5]">
                {historyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-xs text-[#8A857C]">
                      No shifts recorded yet.
                    </td>
                  </tr>
                ) : (
                  historyRecords.map((r) => (
                    <tr key={r.id}>
                      <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">{r.work_date}</td>
                      <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">{formatTime(r.clock_in_at)}</td>
                      <td className="p-2.5 whitespace-nowrap">
                        {r.punctuality_status === 'late' ? (
                          <span className="text-[8px] uppercase px-1.5 py-0.5 rounded bg-[#FDE8E8] text-[#9B1C1C] font-mono font-medium">
                            Late ({r.late_minutes || 0}m)
                          </span>
                        ) : (
                          <span className="text-[8px] uppercase px-1.5 py-0.5 rounded bg-[#EDF4F0] text-[#2E473B] font-mono font-medium">
                            On-Time
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">{formatTime(r.clock_out_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shift Handover Modal */}
        {showHandoverModal && (
          <div className="fixed inset-0 z-50 bg-[#1A1A18]/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-[#E8E2D5] max-w-sm w-full p-5 space-y-3 shadow-xl">
              <div>
                <span className="text-[9px] uppercase tracking-widest text-[#C26D53] font-mono block">
                  END OF SHIFT
                </span>
                <h2 className="text-lg font-light tracking-tight mt-0.5">
                  Shift Handover <span className="font-serif italic">Logbook</span>
                </h2>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[#8A857C] font-mono block mb-1">
                    Store Notes
                  </label>
                  <textarea
                    rows={2}
                    value={handoverNote}
                    onChange={(e) => setHandoverNote(e.target.value)}
                    placeholder="Customer reservations, restock needed..."
                    className="w-full p-2.5 text-xs rounded-xl bg-[#FAF8F5] border border-[#E8E2D5] text-[#1A1A18] focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[#8A857C] font-mono block mb-1">
                    Closing Cash (Optional)
                  </label>
                  <input
                    type="text"
                    value={cashBalance}
                    onChange={(e) => setCashBalance(e.target.value)}
                    placeholder="e.g. IDR 1.500.000"
                    className="w-full p-2 text-xs rounded-xl bg-[#FAF8F5] border border-[#E8E2D5] text-[#1A1A18] font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E8E2D5]">
                <button
                  type="button"
                  onClick={() => setShowHandoverModal(false)}
                  className="px-3 py-1.5 text-xs text-[#736E66]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={submitClockOut}
                  disabled={submitting}
                  className="px-4 py-2 rounded-full bg-[#1A1A18] text-white text-xs uppercase tracking-wider disabled:opacity-40"
                >
                  {submitting ? 'Saving...' : 'Complete Out'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}