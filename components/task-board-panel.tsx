'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { downloadTasksAsJson, downloadTasksAsMarkdown } from '@/lib/exporters'
import { requestPlanner } from '@/lib/planner-client'
import { useVibeStore } from '@/stores/use-vibe-store'

export function TaskBoardPanel() {
  const {
    proposedTasks,
    applyProposedTasks,
    isConflictModalOpen,
    conflicts,
    closeConflictModal,
    events,
    plannerForm,
    chatHistory,
    goalTurns,
    setProposedTasks,
    appendChatMessage,
    setGoalTurns,
    setAiStatus,
    loading,
    setLoading,
    setError,
    error,
  } = useVibeStore()
  const [isExportOpen, setIsExportOpen] = useState(false)

  const handleApply = () => {
    applyProposedTasks()
  }

  const handleForceInsert = () => {
    applyProposedTasks(true)
  }

  const handleReplan = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await requestPlanner({
        userInput: plannerForm.goal,
        plannerForm,
        chatHistory,
        goalTurns,
        forceGenerate: true,
        busySlots: events,
      })

      appendChatMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        countsTowardRound: false,
      })
      setGoalTurns(response.goalTurns)
      setAiStatus(response.nextAiStatus)
      setProposedTasks(response.tasks ?? [])
      closeConflictModal()
    } catch (replanError) {
      setError(replanError instanceof Error ? replanError.message : '重排失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel relative">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Task Board</p>
          <h2 className="mt-2 text-lg font-semibold text-white">任务看板</h2>
        </div>
        <span className="metric-pill">{proposedTasks.length} Pending</span>
      </div>

      <div className="panel-body space-y-6">
        <div className="rounded-[26px] border border-white/10 bg-black/20 p-4 text-sm leading-7 text-muted">
          AI 生成的结构化任务会先停留在这里，只有你点击“应用到日历”后才会进入周视图。若发现时间冲突，会先弹出精致的重排确认弹窗。
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="section-label">Proposed Tasks</p>
            <div className="relative flex flex-wrap justify-end gap-3">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setIsExportOpen((value) => !value)}
                disabled={!proposedTasks.length}
              >
                导出清单
              </button>
              <button className="primary-button" type="button" onClick={handleApply} disabled={!proposedTasks.length || loading}>
                应用到日历
              </button>

              {isExportOpen ? (
                <div className="absolute right-0 top-12 z-20 min-w-52 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,41,.98),rgba(8,11,20,.98))] p-3 shadow-glow">
                  <div className="space-y-2">
                    <button
                      className="ghost-button w-full justify-start text-left"
                      type="button"
                      onClick={() => {
                        downloadTasksAsMarkdown(proposedTasks)
                        setIsExportOpen(false)
                      }}
                    >
                      导出 Markdown
                    </button>
                    <button
                      className="ghost-button w-full justify-start text-left"
                      type="button"
                      onClick={() => {
                        downloadTasksAsJson(proposedTasks)
                        setIsExportOpen(false)
                      }}
                    >
                      导出 JSON
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {proposedTasks.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-muted">
              还没有待确认任务。先在上面的 AI 面板中发起规划。
            </div>
          ) : (
            <div className="space-y-3">
              {proposedTasks.map((task) => (
                <article key={task.id} className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-sm font-semibold text-white">{task.title}</h3>
                    <span className="hud-chip">{format(parseISO(task.startTime), 'MM.dd HH:mm')}</span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted">
                    {format(parseISO(task.startTime), 'yyyy.MM.dd HH:mm')} -&gt; {format(parseISO(task.endTime), 'HH:mm')}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted">{task.description}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>

      {isConflictModalOpen ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[30px] bg-[#040811]/80 p-6 backdrop-blur-xl">
          <div className="w-full max-w-md rounded-[30px] border border-neon/20 bg-[linear-gradient(180deg,rgba(20,25,43,.96),rgba(10,14,24,.98))] p-6 shadow-glow">
            <p className="eyebrow">Conflict Detection</p>
            <h3 className="mt-2 text-xl font-semibold text-white">发现时间冲突</h3>
            <p className="mt-3 text-sm leading-7 text-muted">
              检测到待应用任务与现有日程发生重叠。你可以让 AI 自动避开这些时段重新规划，或者直接强制插入。
            </p>

            <div className="mt-5 space-y-3 rounded-[24px] border border-white/10 bg-black/20 p-4">
              {conflicts.map((conflict) => (
                <div key={`${conflict.taskId}-${conflict.eventId}`} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-muted">
                  <div className="font-medium text-white">{conflict.taskTitle}</div>
                  <div className="mt-1">冲突对象：{conflict.eventTitle}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">
                    {format(parseISO(conflict.startTime), 'MM.dd HH:mm')} -&gt; {format(parseISO(conflict.endTime), 'HH:mm')}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button className="primary-button" type="button" onClick={handleReplan} disabled={loading}>
                让 AI 重排
              </button>
              <button className="ghost-button" type="button" onClick={handleForceInsert}>
                强制覆盖插入
              </button>
              <button className="ghost-button" type="button" onClick={closeConflictModal}>
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
