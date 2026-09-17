'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import StaffNav from '../components/StaffNav'

interface TaskItem {
  id: string
  title: string
  description: string | null
  store_id: string | null
  priority: 'low' | 'normal' | 'high'
  status: 'pending' | 'completed'
  created_at: string
}

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [userRole, setUserRole] = useState<string>('staff')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadTasksData = async () => {
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

      if (prof && isMounted) {
        setUserRole(prof.role || 'staff')
      }

      const { data: tData } = await supabase
        .from('tasks')
        .select('*')
        .order('status', { ascending: false })
        .order('created_at', { ascending: false })

      if (tData && isMounted) {
        setTasks(tData)
      }

      if (isMounted) {
        setLoading(false)
      }
    }

    loadTasksData()

    return () => {
      isMounted = false
    }
  }, [router])

  const toggleTask = async (task: TaskItem) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed'
    const { error } = await supabase
      .from('tasks')
      .update({ status: nextStatus })
      .eq('id', task.id)

    if (!error) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
      )
    }
  }

  const pendingCount = tasks.filter((t) => t.status === 'pending').length
  const completedCount = tasks.filter((t) => t.status === 'completed').length

  return (
    <main className="min-h-screen bg-[#FAF8F5] pb-32 md:pb-16 text-[#191C1A]">
      <StaffNav userRole={userRole} />

      <div className="max-w-4xl mx-auto px-4 pt-6 md:pt-8 space-y-6">
        {/* Editorial Header */}
        <div className="relative rounded-2xl bg-gradient-to-br from-[#2E473B] to-[#1E2E26] text-white p-6 sm:p-7 border border-[#CFE2D7] shadow-md overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#C26D53]/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-[10px] tracking-[0.3em] uppercase text-[#D8C7B5] font-mono">
                STORE OPERATIONS
              </span>
              <h1 className="text-2xl sm:text-3xl font-light tracking-tight mt-1 text-[#FAF7F2]">
                STORE <span className="font-serif italic font-normal text-[#E8C5A8]">RITUALS</span>
              </h1>
              <p className="text-xs text-[#B5AEA4] mt-1">
                Inspect daily retail procedures, fitting rooms, and merchandising displays.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full bg-white/10 text-white font-mono text-xs border border-white/15">
                {pendingCount} Pending
              </span>
              <span className="px-3 py-1 rounded-full bg-[#FAF0E6] text-[#2E473B] font-mono text-xs">
                {completedCount} Done
              </span>
            </div>
          </div>
        </div>

        {/* Task Checklist Cards */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs text-[#8A857C]">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="rounded-2xl bg-white border border-[#E8E2D5] p-10 text-center text-xs text-[#8A857C]">
              No store tasks logged for today.
            </div>
          ) : (
            tasks.map((task) => {
              const isCompleted = task.status === 'completed'
              return (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task)}
                  className={`rounded-xl border p-4 sm:p-5 flex items-start justify-between gap-4 cursor-pointer transition-all ${
                    isCompleted
                      ? 'bg-[#FAF8F5] border-[#E8E2D5] opacity-60'
                      : 'bg-white border-[#E8E2D5] hover:border-[#2E473B] shadow-xs'
                  }`}
                >
                  <div className="flex items-start space-x-3.5">
                    <button
                      type="button"
                      className={`w-5 h-5 mt-0.5 rounded-md flex items-center justify-center text-xs transition-colors ${
                        isCompleted
                          ? 'bg-[#2E473B] text-white'
                          : 'border-2 border-[#D6CEC0] hover:border-[#2E473B]'
                      }`}
                    >
                      {isCompleted && '✓'}
                    </button>

                    <div>
                      <span
                        className={`text-sm font-medium ${
                          isCompleted ? 'line-through text-[#8A857C]' : 'text-[#191C1A]'
                        }`}
                      >
                        {task.title}
                      </span>
                      {task.description && (
                        <p className="text-xs text-[#736E66] mt-0.5 leading-relaxed">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-full whitespace-nowrap ${
                      task.priority === 'high'
                        ? 'bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4]'
                        : task.priority === 'normal'
                        ? 'bg-[#F2EFE8] text-[#635E56]'
                        : 'bg-[#EDF4F0] text-[#2E473B]'
                    }`}
                  >
                    {task.priority}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </main>
  )
}