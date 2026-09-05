'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import StaffNav from '../components/StaffNav'

interface Store {
  id: string
  name: string
}

interface AnnouncementItem {
  id: string
  title: string
  content: string
  is_pinned: boolean
  priority: 'normal' | 'urgent'
  created_at: string
  stores?: Store | null
}

export default function AnnouncementsPage() {
  const router = useRouter()
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [userRole, setUserRole] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  // Publishing form state for Admin
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedStore, setSelectedStore] = useState<string>('')
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
  const [isPinned, setIsPinned] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, stores(id, name)')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching announcements:', error)
    } else if (data) {
      setAnnouncements(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()

      if (prof) setUserRole(prof.role)

      const { data: storeList } = await supabase
        .from('stores')
        .select('id, name')
        .order('name')

      if (storeList) setStores(storeList)

      await loadAnnouncements()
    }

    init()
  }, [router])

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !content) return

    setSubmitting(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const { error } = await supabase.from('announcements').insert({
      title,
      content,
      store_id: selectedStore ? selectedStore : null,
      author_id: session?.user.id,
      priority,
      is_pinned: isPinned,
    })

    setSubmitting(false)

    if (error) {
      alert('Failed to publish: ' + error.message)
    } else {
      setTitle('')
      setContent('')
      setSelectedStore('')
      setIsPinned(false)
      setPriority('normal')
      setShowPublishModal(false)
      loadAnnouncements()
    }
  }

  return (
    <main className="min-h-screen bg-[#fbfbf9] pb-24 sm:pb-12 text-[#171716]">
      <StaffNav userRole={userRole} />

      <div className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
        <div className="border-b border-[#eaeae5] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] tracking-[0.25em] uppercase text-[#73726c] font-mono">
              STAFF OS / COMMUNICATIONS
            </span>
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight mt-1">
              STORE <span className="font-serif italic font-normal">BROADCASTS</span>
            </h1>
          </div>

          {userRole === 'admin' && (
            <button
              onClick={() => setShowPublishModal(!showPublishModal)}
              className="px-4 py-2 bg-[#171716] text-white text-xs uppercase tracking-widest hover:bg-neutral-800 transition"
            >
              {showPublishModal ? 'Close Form' : '+ New Broadcast'}
            </button>
          )}
        </div>

        {/* Admin Composer Panel */}
        {showPublishModal && (
          <form
            onSubmit={handlePublish}
            className="bg-white border border-[#eaeae5] p-6 space-y-4 shadow-sm"
          >
            <div>
              <span className="text-xs uppercase tracking-wider text-[#73726c] block">
                Publish Internal Broadcast
              </span>
              <p className="text-[11px] text-[#73726c] mt-0.5">
                Dispatch company memos, collection launches, or urgent store updates.
              </p>
            </div>

            <div>
              <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                Announcement Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Stock Arrival Notice"
                className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none focus:border-black"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                  Target Store
                </label>
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none focus:border-black"
                >
                  <option value="">All TWILM Stores</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'normal' | 'urgent')}
                  className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none focus:border-black"
                >
                  <option value="normal">Standard</option>
                  <option value="urgent">Urgent Action</option>
                </select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center space-x-2 text-xs text-[#73726c] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="accent-black"
                  />
                  <span>Pin to top</span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                Content Details
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={4}
                placeholder="Compose message..."
                className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none focus:border-black resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-[#171716] text-white text-xs uppercase tracking-widest hover:bg-neutral-800 disabled:bg-neutral-300 transition"
            >
              {submitting ? 'Publishing...' : 'Broadcast to Team'}
            </button>
          </form>
        )}

        {/* Announcements Stream */}
        {loading ? (
          <p className="p-8 text-center text-xs text-[#73726c] animate-pulse">
            Loading team broadcasts...
          </p>
        ) : announcements.length === 0 ? (
          <div className="bg-white border border-[#eaeae5] p-8 text-center text-xs text-[#73726c]">
            No announcements published yet.
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((item) => (
              <article
                key={item.id}
                className={`bg-white border ${
                  item.priority === 'urgent' ? 'border-amber-300' : 'border-[#eaeae5]'
                } p-6 space-y-3 relative`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eaeae5] pb-3">
                  <div className="flex items-center space-x-2">
                    {item.is_pinned && (
                      <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 bg-neutral-100 text-[#171716] font-mono">
                        PINNED
                      </span>
                    )}
                    {item.priority === 'urgent' && (
                      <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 font-mono">
                        URGENT
                      </span>
                    )}
                    <span className="text-[10px] tracking-wider uppercase px-2 py-0.5 bg-[#fbfbf9] text-[#73726c] border border-[#eaeae5]">
                      {item.stores?.name || 'All Boutiques'}
                    </span>
                  </div>

                  <time className="text-[11px] font-mono text-[#73726c]">
                    {new Intl.DateTimeFormat('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }).format(new Date(item.created_at))}
                  </time>
                </div>

                <h2 className="text-base font-medium tracking-tight text-[#171716]">
                  {item.title}
                </h2>

                <p className="text-xs text-[#73726c] leading-relaxed whitespace-pre-line">
                  {item.content}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}