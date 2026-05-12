import { useState, useEffect } from 'react'
import { API_URL } from '../api'

export default function VocabModal({ onClose }) {
  const [cards, setCards] = useState([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/api/vocab`)
      .then(r => r.json())
      .then(data => { setCards(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const current = cards[index]

  const prev = () => { setFlipped(false); setIndex(i => i - 1) }
  const next = () => { setFlipped(false); setIndex(i => i + 1) }

  const removeCard = async () => {
    await fetch(`${API_URL}/api/vocab/${current.id}`, { method: 'DELETE' }).catch(() => {})
    const updated = cards.filter((_, i) => i !== index)
    setCards(updated)
    setIndex(i => Math.min(i, updated.length - 1))
    setFlipped(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal vocab-modal">
        <div className="modal-header">
          <h2>Vocab Flashcards</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="vocab-body">
          {loading ? (
            <p className="vocab-empty">Loading…</p>
          ) : cards.length === 0 ? (
            <p className="vocab-empty">No words saved yet. Start a conversation to build your vocab list.</p>
          ) : (
            <>
              <p className="vocab-progress">{index + 1} / {cards.length}</p>

              <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(f => !f)}>
                <div className="flashcard-inner">
                  <div className="flashcard-front">
                    <span className="fc-zh">{current.word}</span>
                    <span className="fc-hint">tap to reveal</span>
                  </div>
                  <div className="flashcard-back">
                    <span className="fc-zh">{current.word}</span>
                    <span className="fc-py">{current.pinyin}</span>
                    <span className="fc-en">{current.meaning}</span>
                  </div>
                </div>
              </div>

              <div className="vocab-controls">
                <button className="vocab-nav" onClick={prev} disabled={index === 0}>←</button>
                <button className="vocab-delete" onClick={removeCard}>Remove</button>
                <button className="vocab-nav" onClick={next} disabled={index === cards.length - 1}>→</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
