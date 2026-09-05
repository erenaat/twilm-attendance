'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import StaffNav from '../components/StaffNav'

interface Store {
  id: string
  name: string
}

interface TaskItem {
  id: string
  title: string
  description: string | null
  due_date: string | null
  priority: 'low' | 'normal' | 'high'
  status: 'pending' | 'completed'
  completed_at: string | null
  store_id: string | null
  stores?: Store | null
}

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [userRole, setUserRole] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending')

  // Admin Controls
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPriority, setNewPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [newStoreId, setNewStoreId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadTasks = async () => {
    setLoading(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.push('/login')
      return
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', session.user.id)
      .maybeSingle()

    const isAdmin = prof?.role === 'admin'
    if (prof) {
      setUserRole(prof.role)
      if (prof.store_id && isAdmin) {
        setSelectedStoreFilter(prof.store_id)
      }
    }

    // Load Stores for Admin
    if (isAdmin) {
      const { data: storeData } = await supabase
        .from('stores')
        .select('id, name')
        .order('name')
      if (storeData) {
        setStores(storeData)
        if (!newStoreId && storeData.length > 0) {
          setNewStoreId(prof?.store_id || storeData[0].id)
        }
      }
    }

    // Query Tasks
    let query = supabase
      .from('tasks')
      .select('*, stores(id, name)')
      .order('created_at', { ascending: false })

    if (!isAdmin) {
      query = query.or(`assigned_to.eq.${session.user.id},assigned_to.is.null`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching tasks:', error)
    } else if (data) {
      setTasks(data as unknown as TaskItem[])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadTasks()
  }, [router])

  // Toggle status for both Staff and Admin
  const toggleTaskStatus = async (task: TaskItem) => {
    const nextStatus = task.status === 'pending' ? 'completed' : 'pending'
    const completedAt = nextStatus === 'completed' ? new Date().toISOString() : null

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: nextStatus, completed_at: completedAt } : t
      )
    )

    const { error } = await supabase
      .from('tasks')
      .update({
        status: nextStatus,
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id)

    if (error) {
      alert('Failed to update task: ' + error.message)
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      )
    }
  }

  // Admin: Create new task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle) return

    setSubmitting(true)
    const targetStore = newStoreId || (stores[0]?.id ?? null)

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: newTitle,
        description: newDesc,
        priority: newPriority,
        store_id: targetStore,
        status: 'pending',
      })
      .select('*, stores(id, name)')
      .single()

    setSubmitting(false)

    if (error) {
      alert('Gagal membuat tugas: ' + error.message)
    } else if (data) {
      setTasks((prev) => [data as unknown as TaskItem, ...prev])
      setShowAddForm(false)
      setNewTitle('')
      setNewDesc('')
      alert('Tugas toko berhasil dibuat.')
    }
  }

  // Admin: Delete task
  const handleDeleteTask = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Hapus tugas ini?')) return

    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== id))
    }
  }

  // Filter tasks by store
  const storeFilteredTasks = useMemo(() => {
    if (userRole !== 'admin' || selectedStoreFilter === 'all') {
      return tasks
    }
    return tasks.filter((t) => t.store_id === selectedStoreFilter)
  }, [tasks, selectedStoreFilter, userRole])

  const completedCount = storeFilteredTasks.filter((t) => t.status === 'completed').length
  const totalCount = storeFilteredTasks.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const filteredTasks = storeFilteredTasks.filter((t) =>
    activeTab === 'pending' ? t.status === 'pending' : t.status === 'completed'
  )

  return (
    <main className="min-h-screen bg-[#fbfbf9] pb-24 sm:pb-12 text-[#171716]">
      <StaffNav userRole={userRole} />

      <div className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
        {/* Header Strip */}
        <div className="border-b border-[#eaeae5] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] tracking-[0.25em] uppercase text-[#73726c] font-mono">
              STAFF OS / OPERATIONS
            </span>
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight mt-1">
              STORE <span className="font-serif italic font-normal">TASKS</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {userRole === 'admin' && (
              <>
                <div className="flex items-center space-x-1.5 bg-white border border-[#eaeae5] px-2.5 py-1.5 text-xs">
                  <span className="text-[10px] uppercase text-[#73726c]">Store:</span>
                  <select
                    value={selectedStoreFilter}
                    onChange={(e) => setSelectedStoreFilter(e.target.value)}
                    className="bg-transparent text-[#171716] font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Stores</option>
                    {stores.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-3.5 py-1.5 bg-[#171716] text-white text-xs uppercase tracking-wider hover:bg-neutral-800 transition"
                >
                  {showAddForm ? 'Close' : '+ Create Task'}
                </button>
              </>
            )}

            {/* Tab Selector */}
            <div className="flex border border-[#eaeae5] bg-white p-0.5 text-xs">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1 uppercase tracking-wider transition-colors ${
                  activeTab === 'pending'
                    ? 'bg-[#171716] text-white font-medium'
                    : 'text-[#73726c] hover:text-black'
                }`}
              >
                Pending ({storeFilteredTasks.filter((t) => t.status === 'pending').length})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-3 py-1 uppercase tracking-wider transition-colors ${
                  activeTab === 'completed'
                    ? 'bg-[#171716] text-white font-medium'
                    : 'text-[#73726c] hover:text-black'
                }`}
              >
                Completed ({completedCount})
              </button>
            </div>
          </div>
        </div>

        {/* Admin Create Task Form */}
        {userRole === 'admin' && showAddForm && (
          <form
            onSubmit={handleCreateTask}
            className="bg-white border border-[#eaeae5] p-5 space-y-4 shadow-sm"
          >
            <div>
              <span className="text-xs uppercase tracking-wider text-[#73726c] block">
                Add Store Operational Task
              </span>
              <p className="text-[11px] text-[#73726c]">
                Buat tugas dan SOP rutin untuk staf di lokasi toko tertentu.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#73726c] block mb-1">
                  Judul Tugas
                </label>
                <input
                  type="text"
                  placeholder="Misal: Visual Merchandising Check / Folding Restock"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                    Lokasi Toko
                  </label>
                  <select
                    value={newStoreId}
                    onChange={(e) => setNewStoreId(e.target.value)}
                    className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none"
                  >
                    {stores.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] tracking-wider uppercase text-[#73726c] block mb-1">
                    Prioritas
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as 'low' | 'normal' | 'high')}
                    className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#73726c] block mb-1">
                  Deskripsi / Petunjuk Pengerjaan
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan langkah pengerjaan..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full p-2.5 text-xs bg-[#fbfbf9] border border-[#eaeae5] text-[#171716] focus:outline-none resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-[#171716] hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs uppercase tracking-widest transition"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Tugas'}
            </button>
          </form>
        )}

        {/* Progress Bar */}
        <div className="bg-white border border-[#eaeae5] p-5 space-y-3">
          <div className="flex justify-between items-baseline text-xs">
            <span className="text-[10px] tracking-widest uppercase text-[#73726c]">
              TODAY&apos;S COMPLETION PROGRESS
            </span>
            <span className="font-mono text-sm font-medium">
              {completedCount} of {totalCount} completed ({progressPercent}%)
            </span>
          </div>

          <div className="w-full bg-[#fbfbf9] h-2 border border-[#eaeae5] overflow-hidden">
            <div
              className="bg-[#171716] h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Tasks List */}
        <div className="bg-white border border-[#eaeae5] divide-y divide-[#eaeae5]">
          {loading ? (
            <p className="p-8 text-center text-xs text-[#73726c] animate-pulse">
              Loading store task list...
            </p>
          ) : filteredTasks.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#73726c]">
              {activeTab === 'pending'
                ? 'All tasks completed for this store.'
                : 'No completed tasks recorded yet.'}
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => toggleTaskStatus(task)}
                className="p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-[#fbfbf9] cursor-pointer transition-colors"
              >
                <div className="flex items-start space-x-3.5 flex-1">
                  <input
                    type="checkbox"
                    checked={task.status === 'completed'}
                    onChange={() => {}}
                    className="mt-0.5 w-4 h-4 rounded-none border-[#eaeae5] accent-black cursor-pointer"
                  />

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={`text-sm font-medium ${
                          task.status === 'completed'
                            ? 'line-through text-[#73726c]'
                            : 'text-[#171716]'
                        }`}
                      >
                        {task.title}
                      </h3>

                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-neutral-100 border border-[#eaeae5] font-mono">
                        {task.stores?.name || 'All Stores'}
                      </span>

                      {task.priority === 'high' && (
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-rose-50 text-rose-800 border border-rose-200">
                          Priority
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-[11px] text-[#73726c] mt-0.5">{task.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-[10px] font-mono text-[#73726c] tracking-wider uppercase">
                    {task.status === 'completed' ? 'DONE' : 'OPEN'}
                  </span>

                  {userRole === 'admin' && (
                    <button
                      onClick={(e) => handleDeleteTask(e, task.id)}
                      className="text-[11px] text-rose-600 hover:text-rose-900 border border-rose-200 px-2 py-0.5 transition"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}