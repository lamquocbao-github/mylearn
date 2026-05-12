export default function LearningPanel({ learning, active }) {
  const { topic, vocab, goodUsage, corrections } = learning

  return (
    <div className="lp">
      <div className="lp-header">
        <span className="lp-title">Learning Panel</span>
        {active && <span className="lp-live">● LIVE</span>}
      </div>

      {/* Topic */}
      <section className="lp-section">
        <h4 className="lp-section-title">📍 Topic</h4>
        {topic ? (
          <p className="lp-topic">{topic}</p>
        ) : (
          <p className="lp-empty">Detected as you speak…</p>
        )}
      </section>

      {/* Vocabulary */}
      <section className="lp-section">
        <h4 className="lp-section-title">
          📚 Vocabulary
          {vocab.length > 0 && <span className="lp-count">{vocab.length}</span>}
        </h4>
        {vocab.length === 0 ? (
          <p className="lp-empty">New words will appear here</p>
        ) : (
          <div className="lp-vocab-list">
            {vocab.map((w, i) => (
              <div key={i} className="lp-word">
                <span className="lp-word-zh">{w.word}</span>
                <span className="lp-word-py">{w.pinyin}</span>
                <span className="lp-word-en">{w.meaning}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Good usage */}
      <section className="lp-section">
        <h4 className="lp-section-title">
          ✅ Good Usage
          {goodUsage.length > 0 && <span className="lp-count lp-count-green">{goodUsage.length}</span>}
        </h4>
        {goodUsage.length === 0 ? (
          <p className="lp-empty">Your strengths will show here</p>
        ) : (
          <ul className="lp-good-list">
            {goodUsage.map((g, i) => (
              <li key={i} className="lp-good-item">{g}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Corrections */}
      <section className="lp-section">
        <h4 className="lp-section-title">
          🔧 Fix These
          {corrections.length > 0 && <span className="lp-count lp-count-red">{corrections.length}</span>}
        </h4>
        {corrections.length === 0 ? (
          <p className="lp-empty">Grammar &amp; tone corrections will appear here</p>
        ) : (
          <div className="lp-corrections">
            {corrections.map((c, i) => (
              <div key={i} className="lp-correction">
                <div className="lp-correction-diff">
                  <span className="lp-wrong">{c.original}</span>
                  <span className="lp-arrow">→</span>
                  <span className="lp-right">{c.corrected}</span>
                </div>
                <p className="lp-exp">{c.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
