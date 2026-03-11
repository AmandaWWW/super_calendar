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
    setProposedTasks,
  } = useVibeStore()
  const [draft, setDraft] = useState(plannerForm.goal)

  const statusText = useMemo(() => {
    if (loading) return 'AI 正在生成任务草案'
    if (aiStatus === 'generating') return 'AI 已返回一组待确认任务'
    return '输入目标后直接由模型生成结构化日程草案'
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
      })

      appendChatMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
      })
      setAiStatus('generating')
      setProposedTasks(response.tasks)
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
        {chatHistory.length > 0 ? (
          <div className="space-y-3 rounded-[26px] border border-white/80 bg-white/90 p-4 shadow-2xl shadow-slate-200/60">
            <div className="flex items-center justify-between gap-3">
              <p className="section-label">Chat Stream</p>
              <span className="hud-chip">{chatHistory.length} 条记录</span>
            </div>
            <div className="max-h-72 space-y-3 overflow-auto pr-1">
              {chatHistory.map((message) => (
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
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="section-label">Prompt Input</p>
          <textarea
            className="input-shell min-h-32 resize-none"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="描述你的目标、周期、频率和限制条件，例如：8天学游泳、每周4次训练、6周备考等。"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="primary-button" type="button" onClick={handleGenerate} disabled={loading}>
            {loading ? '处理中...' : '开始规划'}
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
          <div className="flex items-center gap-2">
            <span className="hud-chip">{aiStatus === 'generating' ? '已生成草案' : loading ? '生成中' : '准备中'}</span>
          </div>
        </div>

        {error ? <p className="text-sm text-rose-500">{error}</p> : null}
      </div>
    </section>
  )
}
