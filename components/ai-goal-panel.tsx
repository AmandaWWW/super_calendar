'use client'

import { useMemo, useState } from 'react'
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
      setError(fetchError instanceof Error ? fetchError.message : '生成失败，请重试。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">AI Planner</p>
          <h2 className="mt-2 text-lg font-semibold text-white">目标规划对话框</h2>
        </div>
        <span className="metric-pill">DeepSeek</span>
      </div>

      <div className="panel-body space-y-5">
        <div className="rounded-[26px] border border-white/10 bg-black/20 p-4 text-sm leading-7 text-muted">
          非规划类输入会被直接拦截，不计入轮次。若目标不清晰，AI 最多追问 2 次；第 3 次无论如何都会生成待确认任务。
        </div>

        <div className="space-y-3 rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="section-label">Chat Stream</p>
            <span className="hud-chip">已计轮次 {goalTurns} / 3</span>
          </div>
          <div className="max-h-72 space-y-3 overflow-auto pr-1">
            {chatHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-muted">
                先输入你的项目或学习目标，例如“3 天内做出一个可上线的 AI 日历 Demo”。
              </div>
            ) : (
              chatHistory.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-[22px] px-4 py-3 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'ml-10 border border-neon/20 bg-neon/10 text-white'
                      : 'mr-10 border border-white/10 bg-black/20 text-muted'
                  }`}
                >
                  <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-muted">
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

        <div className="flex items-center justify-between gap-4 rounded-[26px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-muted">
          <span>{statusText}</span>
          <span className="hud-chip">{aiStatus}</span>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </section>
  )
}
