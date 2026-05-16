export default function ReviewModal({ learning, messages, onClose, onReset }) {
  const { topic, vocab, goodUsage, corrections } = learning
  const userMessages = messages.filter((m) => m.role === 'user').length

  const downloadReview = () => {
    const date = new Date().toLocaleString()
    const lines = []

    lines.push(`# MyLearn — Session Review`)
    lines.push(`**Date:** ${date}`)
    if (topic) lines.push(`**Topic:** ${topic}`)
    lines.push(`**Messages:** ${userMessages} · **New Words:** ${vocab.length} · **Good Phrases:** ${goodUsage.length} · **Corrections:** ${corrections.length}`)
    lines.push('')

    if (vocab.length > 0) {
      lines.push(`## Vocabulary Learned`)
      vocab.forEach((w) => lines.push(`- **${w.word}** ${w.pinyin} — ${w.meaning}`))
      lines.push('')
    }

    if (goodUsage.length > 0) {
      lines.push(`## What You Did Well`)
      goodUsage.forEach((g) => lines.push(`- ${g}`))
      lines.push('')
    }

    if (corrections.length > 0) {
      lines.push(`## Corrections to Remember`)
      corrections.forEach((c) => lines.push(`- ~~${c.original}~~ → **${c.corrected}** — ${c.explanation}`))
      lines.push('')
    }

    if (messages.length > 0) {
      lines.push(`## Conversation`)
      messages.forEach((m) => {
        const speaker = m.role === 'user' ? 'You' : 'Baobei'
        lines.push(`**${speaker}:** ${m.content}`)
        if (m.role === 'assistant' && m.pinyin) lines.push(`*${m.pinyin}*`)
        if (m.role === 'assistant' && m.translation) lines.push(`> ${m.translation}`)
        lines.push('')
      })
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mylearn-review-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2>Session Review</h2>
            {topic && <p className="modal-topic">Topic: {topic}</p>}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Stats row */}
        <div className="modal-stats">
          <div className="modal-stat">
            <span className="modal-stat-n">{userMessages}</span>
            <span className="modal-stat-l">Messages</span>
          </div>
          <div className="modal-stat">
            <span className="modal-stat-n">{vocab.length}</span>
            <span className="modal-stat-l">New Words</span>
          </div>
          <div className="modal-stat">
            <span className="modal-stat-n" style={{ color: '#16a34a' }}>{goodUsage.length}</span>
            <span className="modal-stat-l">Good Phrases</span>
          </div>
          <div className="modal-stat">
            <span className="modal-stat-n" style={{ color: corrections.length > 0 ? '#dc2626' : '#16a34a' }}>
              {corrections.length}
            </span>
            <span className="modal-stat-l">Corrections</span>
          </div>
        </div>

        <div className="modal-body">
          {/* Vocabulary */}
          {vocab.length > 0 && (
            <section className="modal-section">
              <h3>📚 Vocabulary Learned</h3>
              <div className="modal-vocab-grid">
                {vocab.map((w, i) => (
                  <div key={i} className="modal-word">
                    <span className="modal-word-zh">{w.word}</span>
                    <span className="modal-word-py">{w.pinyin}</span>
                    <span className="modal-word-en">{w.meaning}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Good usage */}
          {goodUsage.length > 0 && (
            <section className="modal-section">
              <h3>✅ What You Did Well</h3>
              <ul className="modal-good-list">
                {goodUsage.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </section>
          )}

          {/* Corrections */}
          {corrections.length > 0 && (
            <section className="modal-section">
              <h3>🔧 Corrections to Remember</h3>
              {corrections.map((c, i) => (
                <div key={i} className="modal-correction">
                  <div className="modal-diff">
                    <span className="lp-wrong">{c.original}</span>
                    <span className="lp-arrow">→</span>
                    <span className="lp-right">{c.corrected}</span>
                  </div>
                  <p className="lp-exp">{c.explanation}</p>
                </div>
              ))}
            </section>
          )}

          {vocab.length === 0 && goodUsage.length === 0 && corrections.length === 0 && (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
              Start a conversation to see your learning summary here.
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button className="modal-btn-secondary" onClick={onClose}>Keep Talking</button>
          <button className="modal-btn-download" onClick={downloadReview}>Download Review</button>
          <button className="modal-btn-primary" onClick={onReset}>New Conversation</button>
        </div>
      </div>
    </div>
  )
}
