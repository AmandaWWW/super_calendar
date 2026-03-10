'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { getErrorMessage } from '@/lib/errors'
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
    removeProposedTask,
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
      })
      setGoalTurns(response.goalTurns)
      setAiStatus(response.nextAiStatus)
      setProposedTasks(response.tasks ?? [])
      closeConflictModal()
    } catch (replanError) {
      setError(getErrorMessage(replanError, '重排失败，请稍后重试。'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel relative">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Task Board</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-800">任务看板</h2>
        </div>
        <span className="metric-pill">{proposedTasks.length} Pending</span>
      </div>

      <div className="panel-body space-y-6">
        <div className="rounded-[26px] border border-white/80 bg-white/90 p-4 text-sm leading-7 text-slate-500 shadow-2xl shadow-slate-200/60">
          这里先展示 AI 生成的待确认任务。你可以先删掉不想要的条目、导出清单，再决定是否整体应用到日历。
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
                <div className="absolute right-0 top-12 z-20 min-w-52 rounded-[24px] border border-white/80 bg-white/95 p-3 shadow-2xl shadow-slate-200/60 backdrop-blur-md">
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
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
              还没有待确认任务。先在上面的 AI 面板中发起规划。
            </div>
          ) : (
            <div className="space-y-3">
              {proposedTasks.map((task, index) => (
                <article
                  key={task.id}
                  className={`rounded-[24px] border p-4 shadow-[0_16px_34px_rgba(148,163,184,0.14)] ${
                    index % 3 === 0
                      ? 'border-purple-100 bg-purple-100/80'
                      : index % 3 === 1
                        ? 'border-sky-100 bg-sky-100/80'
                        : 'border-teal-100 bg-teal-100/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3
                        className={`text-sm font-semibold ${
                          index % 3 === 0 ? 'text-purple-700' : index % 3 === 1 ? 'text-sky-700' : 'text-teal-700'
                        }`}
                      >
                        {task.title}
                      </h3>
                      <span className="mt-2 inline-flex rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs text-slate-500">
                        {format(parseISO(task.startTime), 'MM.dd HH:mm')}
                      </span>
                    </div>
                    <button
                      className="ghost-button border-rose-100 px-3 py-1.5 text-xs text-rose-500 hover:bg-rose-50"
                      type="button"
                      onClick={() => removeProposedTask(task.id)}
                    >
                      删除
                    </button>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                    {format(parseISO(task.startTime), 'yyyy.MM.dd HH:mm')} -&gt; {format(parseISO(task.endTime), 'HH:mm')}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{task.description}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        {error ? <p className="text-sm text-rose-500">{error}</p> : null}
      </div>

      {isConflictModalOpen ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[30px] bg-white/40 p-6 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[30px] border border-white/80 bg-white/95 p-6 shadow-2xl shadow-slate-200/60">
            <p className="eyebrow">Conflict Detection</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-800">发现时间冲突</h3>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              检测到待应用任务与现有日程发生重叠。你可以让 AI 自动避开这些时段重新规划，或者直接强制插入。
            </p>

            <div className="mt-5 space-y-3 rounded-[24px] border border-slate-100 bg-slate-50/80 p-4">
              {conflicts.map((conflict) => (
                <div key={`${conflict.taskId}-${conflict.eventId}`} className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm text-slate-500">
                  <div className="font-medium text-slate-800">{conflict.taskTitle}</div>
                  <div className="mt-1">冲突对象：{conflict.eventTitle}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
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
