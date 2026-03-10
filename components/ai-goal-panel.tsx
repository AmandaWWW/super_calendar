'use client'

import { useMemo, useState } from 'react'
import { getErrorMessage } from '@/lib/errors'
import { requestPlanner } from '@/lib/planner-client'
import { useVibeStore } from '@/stores/use-vibe-store'

export function AiGoalPanel() {
  const {
    plannerForm,
    setPlannerField,
    setLoading,
    loading,
    setError,
    error,
    aiStatus,
    setAiStatus,
    chatHistory,
    appendChatMessage,
    setGoalTurns,
    goalTurns,
    setProposedTasks,
  } = useVibeStore()
  const [draft, setDraft] = useState(plannerForm.goal)

  const statusText = useMemo(() => {
    if (loading) return 'AI 正在处理你的输入'
    if (aiStatus === 'clarifying') return 'AI 正在等待你的补充信息'
    if (aiStatus === 'generating') return 'AI 已生成待确认任务'
    return '最多 3 轮输入；第 3 次会强制输出一份默认合理计划'
  }, [aiStatus, loading])

  const handleGenerate = async () => {
    const userInput = draft.trim()
    if (!userInput) return

    setLoading(true)
    setError('')
    setAiStatus('analyzing')

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: userInput,
      countsTowardRound: true,
    }

    appendChatMessage(userMessage)
    setPlannerField('goal', userInput)

    try {
      const response = await requestPlanner({
        userInput,
        plannerForm: {
          ...plannerForm,
          goal: userInput,
        },
        chatHistory,
        goalTurns,
      })

      appendChatMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        countsTowardRound: false,
      })
      setGoalTurns(response.goalTurns)
      setAiStatus(response.nextAiStatus)

      if (response.tasks) {
        setProposedTasks(response.tasks)
      }

      setDraft('')
    } catch (fetchError) {
      setAiStatus('idle')
      setError(getErrorMessage(fetchError, '生成失败，请重试。'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">AI Planner</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-800">目标规划对话框</h2>
        </div>
        <span className="metric-pill">DeepSeek</span>
      </div>

      <div className="panel-body space-y-5">
        <div className="rounded-[26px] border border-white/80 bg-white/90 p-4 text-sm leading-7 text-slate-500 shadow-2xl shadow-slate-200/60">
          在这里输入你的项目、学习目标或交付截止时间。AI 会先帮你澄清重点，再生成一组待确认任务；
          你审核后再决定是否放进日历。
        </div>

        <div className="space-y-3 rounded-[26px] border border-white/80 bg-white/90 p-4 shadow-2xl shadow-slate-200/60">
          <div className="flex items-center justify-between gap-3">
            <p className="section-label">Chat Stream</p>
            <span className="hud-chip">已计轮次 {goalTurns} / 3</span>
          </div>
          <div className="max-h-72 space-y-3 overflow-auto pr-1">
            {chatHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">
                先输入你的项目或学习目标，例如“3 天内做出一个可上线的 AI 日历 Demo”。
              </div>
            ) : (
              chatHistory.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-[22px] px-4 py-3 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'ml-10 border border-sky-100 bg-sky-100/80 text-sky-700'
                      : 'mr-10 border border-purple-100 bg-purple-100/80 text-purple-700'
                  }`}
                >
                  <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                    {message.role === 'user' ? 'You' : 'AI'}
                  </div>
                  {message.content}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3">
          <p className="section-label">Prompt Input</p>
          <textarea
            className="input-shell min-h-32 resize-none"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="描述你的项目目标、完成期限、希望投入的节奏。"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="input-shell"
            type="date"
            value={plannerForm.startDate}
            onChange={(event) => setPlannerField('startDate', event.target.value)}
          />
          <input
            className="input-shell"
            type="date"
            value={plannerForm.endDate}
            onChange={(event) => setPlannerField('endDate', event.target.value)}
          />
          <input
            className="input-shell"
            type="number"
            min={1}
            max={80}
            value={plannerForm.weeklyHours}
            onChange={(event) => setPlannerField('weeklyHours', Number(event.target.value))}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="primary-button" type="button" onClick={handleGenerate} disabled={loading}>
            {loading ? '处理中...' : aiStatus === 'clarifying' ? '提交补充信息' : '开始规划'}
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              setDraft('')
              setError('')
            }}
          >
            清空输入框
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-[26px] border border-white/80 bg-white/90 px-4 py-3 text-sm text-slate-500 shadow-2xl shadow-slate-200/60">
          <span>{statusText}</span>
          <span className="hud-chip">{aiStatus === 'clarifying' ? '需要补充信息' : aiStatus === 'generating' ? '已生成草案' : '准备中'}</span>
        </div>

        {error ? <p className="text-sm text-rose-500">{error}</p> : null}
      </div>
    </section>
  )
}
