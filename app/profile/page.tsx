'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../lib/supabase'
import StaffNav from '../components/StaffNav'

interface Store {
  id: string
  name: string
  code: string | null
  address: string | null
}

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  role: string | null
  employee_code: string | null
  phone: string | null
  created_at: string
  stores?: Store | null
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*, stores(*)')
        .eq('id', session.user.id)
        .maybeSingle()

      if (error) {
        console.error('Error fetching profile:', error)
      } else if (data) {
        setProfile(data)
        setFullName(data.full_name || '')
        setPhone(data.phone || '')
      }
      setLoading(false)
    }

    loadProfile()
  }, [router])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setSaving(true)
    setSuccessMessage('')

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    setSaving(false)

    if (error) {
      alert('Failed to update profile: ' + error.message)
    } else {
      setSuccessMessage('Profile updated successfully.')
      setTimeout(() => setSuccessMessage(''), 3000)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#fbfbf9] flex items-center justify-center">
        <p className="text-xs uppercase tracking-widest text-[#73726c] animate-pulse">
          Loading Staff Profile...
        </p>
      </main>
    )
  }

  const joinDate = profile?.created_at
    ? new Intl.DateTimeFormat('en-GB', {
        month: 'long',
        year: 'numeric',
      }).format(new Date(profile.created_at))
    : 'Recent'

  return (
    <main className="min-h-screen bg-[#fbfbf9] pb-24 sm:pb-12 text-[#171716]">
      <StaffNav userRole={profile?.role || undefined} />

      <div className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
        {/* Section Header */}
        <div className="border-b border-[#eaeae5] pb-4">
          <span className="text-[10px] tracking-[0.25em] uppercase text-[#73726c] font-mono">
            STAFF OS / IDENTITY
          </span>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight mt-1">
            STAFF <span className="font-serif italic font-normal">PROFILE</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Digital ID Badge Card */}
          <div className="bg-white border border-[#eaeae5] p-6 space-y-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="relative w-20 h-20 rounded-full overflow-hidden bg-neutral-100 border border-[#eaeae5]">
                {profile?.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt="Staff Avatar"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl font-serif text-[#73726c]">
                    {profile?.full_name?.charAt(0) || 'T'}
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-base font-medium tracking-tight">
                  {profile?.full_name || 'TWILM Staff'}
                </h2>
                <span className="text-[10px] tracking-widest uppercase text-[#73726c] block mt-0.5">
                  {profile?.role === 'admin' ? 'Store Director / Admin' : 'Store Associate'}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#eaeae5] space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-[#73726c]">Employee Code:</span>
                <span className="font-mono">{profile?.employee_code || 'TW-STAFF'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#73726c]">Home Store:</span>
                <span className="font-medium">{profile?.stores?.name || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#73726c]">Member Since:</span>
                <span>{joinDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#73726c]">Status:</span>
                <span className="text-emerald-700 uppercase text-[10px] tracking-wider font-semibold">
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* Edit Details Form */}
          <div className="md:col-span-2 bg-white border border-[#eaeae5] p-6 space-y-6">
            <div>
              <span className="text-xs uppercase tracking-wider text-[#73726c]">
                Contact Information
              </span>
              <p className="text-[11px] text-[#73726c] mt-0.5">
                Update your preferred name and personal contact phone number.
              </p>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                  Email Address (Google Identity)
                </label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="w-full p-2.5 text-xs bg-neutral-100 border border-[#eaeae5] text-[#73726c] cursor-not-allowed"
                />
                <span className="text-[10px] text-[#73726c] mt-1 block">
                  Managed by your Google Authentication login.
                </span>
              </div>

              <div>
                <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                  WhatsApp / Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  placeholder="+62 812 ..."
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none focus:border-black font-mono"
                />
              </div>

              {successMessage && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5">
                  ✓ {successMessage}
                </p>
              )}

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 bg-[#171716] hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs uppercase tracking-widest transition"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}