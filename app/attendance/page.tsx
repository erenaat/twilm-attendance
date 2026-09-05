'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function AttendancePage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [photoData, setPhotoData] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [todayRecord, setTodayRecord] = useState<any>(null)
  const [user, setUser] = useState<any>(null)

  // 1. Check user session and load today's attendance record
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)

      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('work_date', today)
        .maybeSingle()

      if (data) {
        setTodayRecord(data)
      }
    }
    init()
  }, [router])

  // 2. Start front-facing camera
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
    } catch (err) {
      alert('Camera access denied. Camera is required for attendance.')
    }
  }

  // 3. Take selfie snapshot and compress via HTML Canvas
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

  // 4. Capture GPS position
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

  // 5. Reverse geocode coordinates to readable address using OpenStreetMap
  const fetchAddress = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      )
      if (!res.ok) return 'Location captured'
      const data = await res.json()
      
      const addr = data.address || {}
      // Build a clean, readable short location (e.g., "Jl. Sunset Road, Kerobokan Kelod, Badung")
      const parts = [
        addr.road || addr.pedestrian || addr.building,
        addr.village || addr.suburb || addr.neighbourhood,
        addr.city || addr.town || addr.county || addr.state,
      ].filter(Boolean)

      return parts.length > 0 ? parts.join(', ') : data.display_name || 'Location captured'
    } catch {
      return 'Location captured'
    }
  }

  // Helper to convert base64 image into a Blob file
  const base64ToBlob = (base64: string) => {
    const arr = base64.split(',')
    const mime = arr[0].match(/:(.*?);/)![1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new Blob([u8arr], { type: mime })
  }

  // 6. Submit Clock In / Out
  const handleAttendance = async (type: 'clock_in' | 'clock_out') => {
    if (!photoData) {
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

      const { data: { publicUrl } } = supabase.storage
        .from('selfies')
        .getPublicUrl(fileName)

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
            status: 'incomplete',
          })
          .select()
          .single()

        if (error) throw error
        setTodayRecord(data)
        alert('Clock-in successful!')
      } else {
        const { data, error } = await supabase
          .from('attendance')
          .update({
            clock_out_at: now,
            clock_out_lat: latitude,
            clock_out_lng: longitude,
            clock_out_accuracy: accuracy,
            clock_out_photo_url: publicUrl,
            clock_out_address: address,
            status: 'present',
          })
          .eq('id', todayRecord.id)
          .select()
          .single()

        if (error) throw error
        setTodayRecord(data)
        alert('Clock-out successful!')
      }

      setPhotoData(null)
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Location or upload failed.'))
    } finally {
      setLoading(false)
      setStatusMessage('')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow p-5 space-y-5">
        <div className="flex justify-between items-center border-b pb-3">
          <h1 className="text-lg font-bold text-gray-800">TWILM Attendance</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-xs text-blue-600 hover:underline"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Current Day Status */}
        <div className="bg-gray-50 p-3 rounded-lg text-xs space-y-1 text-gray-600">
          <p>
            <strong>Clock In:</strong>{' '}
            {todayRecord?.clock_in_at
              ? new Date(todayRecord.clock_in_at).toLocaleTimeString()
              : 'Not yet'}
          </p>
          <p>
            <strong>Clock Out:</strong>{' '}
            {todayRecord?.clock_out_at
              ? new Date(todayRecord.clock_out_at).toLocaleTimeString()
              : 'Not yet'}
          </p>
        </div>

        {/* Camera / Preview Area */}
        <div className="relative aspect-[3/4] bg-black rounded-lg overflow-hidden flex items-center justify-center">
          {photoData ? (
            <img src={photoData} alt="Selfie preview" className="w-full h-full object-cover" />
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
              className="absolute bg-white text-gray-800 px-4 py-2 rounded-md font-medium text-xs shadow hover:bg-gray-100"
            >
              Open Camera
            </button>
          )}
        </div>

        {/* Snapshot / Retake Controls */}
        <div className="flex gap-2">
          {stream && (
            <button
              onClick={takeSnapshot}
              className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              Take Selfie
            </button>
          )}

          {photoData && (
            <button
              onClick={() => {
                setPhotoData(null)
                startCamera()
              }}
              className="w-full py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold hover:bg-gray-300"
            >
              Retake Selfie
            </button>
          )}
        </div>

        {statusMessage && (
          <p className="text-center text-xs text-blue-600 animate-pulse">{statusMessage}</p>
        )}

        {/* Action Buttons */}
        <div className="pt-2">
          {!todayRecord?.clock_in_at ? (
            <button
              onClick={() => handleAttendance('clock_in')}
              disabled={loading || !photoData}
              className="w-full py-3 bg-green-600 disabled:bg-gray-300 text-white font-bold rounded-lg shadow hover:bg-green-700 transition"
            >
              {loading ? 'Processing...' : 'Clock In'}
            </button>
          ) : !todayRecord?.clock_out_at ? (
            <button
              onClick={() => handleAttendance('clock_out')}
              disabled={loading || !photoData}
              className="w-full py-3 bg-red-600 disabled:bg-gray-300 text-white font-bold rounded-lg shadow hover:bg-red-700 transition"
            >
              {loading ? 'Processing...' : 'Clock Out'}
            </button>
          ) : (
            <div className="text-center text-sm font-semibold text-green-700 bg-green-50 py-3 rounded-lg">
              ✓ Attendance completed for today
            </div>
          )}
        </div>
      </div>
    </main>
  )
}