'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import StaffNav from '../components/StaffNav'

interface TaskItem {
  id: string
  title: string
  description: string | null
  due_date: string | null
  priority: 'low' | 'normal' | 'high'
  status: 'pending' | 'completed'
  completed_at: string | null
}

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [userRole, setUserRole] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending')

  useEffect(() => {
    const loadTasks = async () => {
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

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .or(`assigned_to.eq.${session.user.id},assigned_to.is.null`)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching tasks:', error)
      } else if (data) {
        setTasks(data)
      }

      setLoading(false)
    }

    loadTasks()
  }, [router])

  const toggleTaskStatus = async (task: TaskItem) => {
    const nextStatus = task.status === 'pending' ? 'completed' : 'pending'
    const completedAt = nextStatus === 'completed' ? new Date().toISOString() : null

    // Optimistic UI update
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
      // Revert if error
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      )
    }
  }

  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const totalCount = tasks.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const filteredTasks = tasks.filter((t) =>
    activeTab === 'pending' ? t.status === 'pending' : t.status === 'completed'
  )

  return (
    <main className="min-h-screen bg-[#fbfbf9] pb-24 sm:pb-12 text-[#171716]">
      <StaffNav userRole={userRole} />

      <div className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
        <div className="border-b border-[#eaeae5] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] tracking-[0.25em] uppercase text-[#73726c] font-mono">
              STAFF OS / OPERATIONS
            </span>
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight mt-1">
              STORE <span className="font-serif italic font-normal">TASKS</span>
            </h1>
          </div>

          <div className="flex border border-[#eaeae5] bg-white p-0.5 text-xs">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-1.5 uppercase tracking-wider transition-colors ${
                activeTab === 'pending'
                  ? 'bg-[#171716] text-white font-medium'
                  : 'text-[#73726c] hover:text-black'
              }`}
            >
              Pending ({tasks.filter((t) => t.status === 'pending').length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-1.5 uppercase tracking-wider transition-colors ${
                activeTab === 'completed'
                  ? 'bg-[#171716] text-white font-medium'
                  : 'text-[#73726c] hover:text-black'
              }`}
            >
              Completed ({completedCount})
            </button>
          </div>
        </div>

        {/* Daily Completion Progress Bar */}
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

        {/* Task List */}
        <div className="bg-white border border-[#eaeae5] divide-y divide-[#eaeae5]">
          {loading ? (
            <p className="p-8 text-center text-xs text-[#73726c] animate-pulse">
              Loading store task list...
            </p>
          ) : filteredTasks.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#73726c]">
              {activeTab === 'pending'
                ? 'All tasks completed for today.'
                : 'No completed tasks recorded yet.'}
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => toggleTaskStatus(task)}
                className="p-4 sm:p-5 flex items-start space-x-4 hover:bg-[#fbfbf9] cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={task.status === 'completed'}
                  onChange={() => {}} // Handled by outer container click
                  className="mt-0.5 w-4 h-4 rounded-none border-[#eaeae5] text-black accent-black cursor-pointer"
                />

                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3
                      className={`text-sm font-medium ${
                        task.status === 'completed'
                          ? 'line-through text-[#73726c]'
                          : 'text-[#171716]'
                      }`}
                    >
                      {task.title}
                    </h3>

                    {task.priority === 'high' && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 bg-rose-50 text-rose-800 border border-rose-200">
                        Priority
                      </span>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-[11px] text-[#73726c] mt-0.5">{task.description}</p>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono text-[#73726c] tracking-wider uppercase block">
                    {task.status === 'completed' ? 'DONE' : 'OPEN'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}