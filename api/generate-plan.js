function extractJson(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (_e) {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch (_e2) {
        return null
      }
    }
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.BAILIAN_API_KEY
  const model = process.env.BAILIAN_MODEL || 'deepseek-v3.1'

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing BAILIAN_API_KEY' })
  }

  const { goal, startDate, endDate, weeklyHours, lunarContext } = req.body || {}
  if (!goal || !startDate || !endDate || !weeklyHours) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const systemPrompt = [
    '你是项目计划助手。',
    '请把用户目标转成可执行计划，并结合给定的农历信息。',
    '必须仅输出JSON，不要markdown，不要解释文字。',
    'JSON结构如下：',
    '{"summary":"string","stages":[{"title":"string","start":"YYYY-MM-DD","end":"YYYY-MM-DD","hours":number,"note":"string"}],"daily":[{"date":"YYYY-MM-DD","lunar":"string","tip":"string"}]}',
    '要求：stages固定3个；daily最多14个。',
  ].join('\n')

  const userPrompt = {
    goal,
    startDate,
    endDate,
    weeklyHours,
    lunarContext,
  }

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPrompt) },
        ],
      }),
    })

    if (!response.ok) {
      const details = await response.text()
      return res.status(502).json({ error: 'Bailian API error', details })
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content || ''
    const plan = extractJson(content)

    if (!plan || !Array.isArray(plan.stages) || !Array.isArray(plan.daily) || !plan.summary) {
      return res.status(502).json({ error: 'Invalid AI response format', raw: content })
    }

    return res.status(200).json({ plan })
  } catch (error) {
    return res.status(500).json({ error: 'Server error', details: String(error) })
  }
}
