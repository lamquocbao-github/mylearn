import { useState, useCallback } from 'react'
import ChatMode from './components/ChatMode'
import TalkMode from './components/TalkMode'
import LearningPanel from './components/LearningPanel'
import ReviewModal from './components/ReviewModal'
import VocabModal from './components/VocabModal'
import { API_URL } from './api'
import './App.css'

const SCENARIOS = [
  { id: 'free', label: 'Free Talk' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'travel', label: 'Travel' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'workplace', label: 'Workplace' },
  { id: 'social', label: 'Social' },
  { id: 'emergency', label: 'Emergency' },
]

// HSK references use the original 6-level standard (pre-2021), which is still the
// most widely recognised by learners. HSK 5-6 are grouped as "Advanced" because
// both represent high-proficiency conversation — the distinction (newspapers vs.
// near-native comprehension) doesn't meaningfully change spoken interaction style.
const DIFFICULTIES = [
  { id: 'beginner',     label: 'Beginner',     ref: 'HSK 1–2', tip: 'Basic greetings, numbers, everyday needs' },
  { id: 'elementary',   label: 'Elementary',   ref: 'HSK 3',   tip: 'Daily conversations, common situations' },
  { id: 'intermediate', label: 'Intermediate', ref: 'HSK 4',   tip: 'Wide topics, complex grammar' },
  { id: 'advanced',     label: 'Advanced',     ref: 'HSK 5–6', tip: 'Near-native, idioms, nuanced discussion' },
]

const EMPTY_LEARNING = { topic: null, vocab: [], goodUsage: [], corrections: [] }

export default function App() {
  const [mode, setMode] = useState('chat') // 'chat' | 'talk'
  const [scenario, setScenario] = useState('free')
  const [difficulty, setDifficulty] = useState('beginner')
  const [messages, setMessages] = useState([])
  const [learning, setLearning] = useState(EMPTY_LEARNING)
  const [active, setActive] = useState(false) // conversation started
  const [showReview, setShowReview] = useState(false)
  const [showVocab, setShowVocab] = useState(false)

  // Called by ChatMode/TalkMode after each AI response
  const onAIResponse = useCallback((data) => {
    setActive(true)
    setLearning((prev) => ({
      topic: data.topic || prev.topic,
      vocab: mergeUnique(prev.vocab, data.new_words || [], 'word'),
      goodUsage: [...prev.goodUsage, ...(data.good_usage || [])],
      corrections: [...prev.corrections, ...(data.corrections || [])],
    }))
  }, [])

  const endConversation = () => {
    // Persist session summary to backend (fire-and-forget)
    const userMessages = messages.filter((m) => m.role === 'user').length
    if (userMessages > 0) {
      fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario,
          mode,
          message_count: userMessages,
          corrections_count: learning.corrections.length,
          good_usage_count: learning.goodUsage.length,
        }),
      }).catch(() => {})
    }
    setShowReview(true)
  }

  const resetConversation = () => {
    setMessages([])
    setLearning(EMPTY_LEARNING)
    setActive(false)
    setShowReview(false)
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-brand">
          <span className="nav-logo">🀄</span>
          <span className="nav-title">MyLearn</span>
        </div>

        <div className="nav-center">
          <div className="mode-toggle">
            <button
              className={`mode-btn ${mode === 'chat' ? 'active' : ''}`}
              onClick={() => setMode('chat')}
            >
              💬 Chat
            </button>
            <button
              className={`mode-btn ${mode === 'talk' ? 'active' : ''}`}
              onClick={() => setMode('talk')}
            >
              🎤 Talk
            </button>
          </div>
        </div>

        <div className="nav-right">
          <select
            className="nav-select"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            title={DIFFICULTIES.find(d => d.id === difficulty)?.tip}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d.id} value={d.id}>{d.label} ({d.ref})</option>
            ))}
          </select>
          <select
            className="nav-select"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <button className="vocab-btn" onClick={() => setShowVocab(true)}>
            Flashcards
          </button>
          {active && (
            <button className="end-btn" onClick={endConversation}>
              End &amp; Review
            </button>
          )}
        </div>
      </nav>

      <div className="panels">
        <div className="left-panel">
          {mode === 'chat' ? (
            <ChatMode
              scenario={scenario}
              difficulty={difficulty}
              messages={messages}
              setMessages={setMessages}
              onAIResponse={onAIResponse}
            />
          ) : (
            <TalkMode
              scenario={scenario}
              difficulty={difficulty}
              messages={messages}
              setMessages={setMessages}
              onAIResponse={onAIResponse}
            />
          )}
        </div>

        <div className="right-panel">
          <LearningPanel learning={learning} active={active} />
        </div>
      </div>

      {showVocab && <VocabModal onClose={() => setShowVocab(false)} />}

      {showReview && (
        <ReviewModal
          learning={learning}
          messages={messages}
          onClose={() => setShowReview(false)}
          onReset={resetConversation}
        />
      )}
    </div>
  )
}

function mergeUnique(existing, incoming, key) {
  const seen = new Set(existing.map((x) => x[key]))
  return [...existing, ...incoming.filter((x) => !seen.has(x[key]))]
}
