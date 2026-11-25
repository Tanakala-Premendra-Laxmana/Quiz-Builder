import { useEffect, useMemo, useState } from 'react'

const USERS_KEY = 'qb_users'
const QUIZZES_KEY = 'qb_quizzes'
const ATTEMPTS_KEY = 'qb_attempts'
const SESSION_KEY = 'qb_current_user'

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback }
  catch { return fallback }
}
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value))
const makeId = () => Math.random().toString(36).slice(2, 8).toUpperCase()

function App() {
  const [users, setUsers] = useState(() => read(USERS_KEY, []))
  const [quizzes, setQuizzes] = useState(() => read(QUIZZES_KEY, []))
  const [attempts, setAttempts] = useState(() => read(ATTEMPTS_KEY, []))
  const [currentUser, setCurrentUser] = useState(() => read(SESSION_KEY, null))
  const [authMode, setAuthMode] = useState('login')
  const [page, setPage] = useState('dashboard')
  const [notice, setNotice] = useState('')
  const [editingQuiz, setEditingQuiz] = useState(null)
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [joinCode, setJoinCode] = useState('')
  const [auth, setAuth] = useState({ name: '', email: '', password: '', role: 'user' })

  useEffect(() => write(USERS_KEY, users), [users])
  useEffect(() => write(QUIZZES_KEY, quizzes), [quizzes])
  useEffect(() => write(ATTEMPTS_KEY, attempts), [attempts])
  useEffect(() => write(SESSION_KEY, currentUser), [currentUser])

  const myQuizzes = useMemo(
    () => quizzes.filter(q => q.createdBy === currentUser?.email), [quizzes, currentUser]
  )
  const myAttempts = useMemo(
    () => attempts.filter(a => a.userEmail === currentUser?.email), [attempts, currentUser]
  )

  function show(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3000)
  }

  function submitAuth(e) {
    e.preventDefault()
    const email = auth.email.trim().toLowerCase()

    if (!email || !auth.password || (authMode === 'signup' && !auth.name.trim())) {
      show('Please fill in all required fields.')
      return
    }

    if (authMode === 'signup') {
      if (users.some(u => u.email === email)) {
        return show('An account with this email already exists.')
      }

      const user = {
        name: auth.name.trim(),
        email,
        password: auth.password,
        role: auth.role
      }

      setUsers(prev => [...prev, user])
      setCurrentUser({
        name: user.name,
        email: user.email,
        role: user.role
      })
      setPage('dashboard')
      show('Account created successfully!')
    } else {
      const user = users.find(
        u => u.email === email && u.password === auth.password
      )

      if (!user) return show('Incorrect email or password.')

      setCurrentUser({
        name: user.name,
        email: user.email,
        role: user.role
      })
      setPage('dashboard')
      show('Welcome back!')
    }
  }

  function logout() {
    setCurrentUser(null)
    setActiveQuiz(null)
    setEditingQuiz(null)
    setPage('dashboard')
  }

  function startNewQuiz() {
    setEditingQuiz({
      id: makeId(),
      title: '',
      description: '',
      code: makeId(),
      createdBy: currentUser.email,
      questions: []
    })
    setPage('create')
  }

  function saveQuiz() {
    if (!editingQuiz.title.trim()) return show('Enter a quiz title.')
    if (!editingQuiz.questions.length) return show('Add at least one question.')

    if (editingQuiz.questions.some(q => !q.text.trim())) {
      return show('Every question needs question text.')
    }

    if (editingQuiz.questions.some(
      q => (q.type === 'mcq' || q.type === 'tf') &&
      !q.options?.some(o => o.trim())
    )) {
      return show('Please fill in all answer options.')
    }

    setQuizzes(prev => {
      const exists = prev.some(q => q.id === editingQuiz.id)

      return exists
        ? prev.map(q => q.id === editingQuiz.id ? editingQuiz : q)
        : [...prev, editingQuiz]
    })

    setEditingQuiz(null)
    setPage('quizzes')
    show('Quiz saved successfully!')
  }

  function addQuestion(type) {
    const options = type === 'mcq'
      ? ['', '', '', '']
      : type === 'tf' ? ['True', 'False'] : []

    setEditingQuiz(q => ({
      ...q,
      questions: [...q.questions, {
        id: makeId(),
        type,
        text: '',
        options,
        correctAnswer: type === 'tf'
          ? 'True'
          : type === 'mcq' ? '0' : ''
      }]
    }))
  }

  function updateQuestion(id, patch) {
    setEditingQuiz(q => ({
      ...q,
      questions: q.questions.map(question =>
        question.id === id
          ? { ...question, ...patch }
          : question
      )
    }))
  }

  function joinQuiz(code) {
    const quiz = quizzes.find(
      q => q.code.toLowerCase() === code.trim().toLowerCase()
    )

    if (!quiz) return show('No quiz found with that code.')

    if (quiz.createdBy === currentUser.email) {
      return show('Open this quiz from your Admin dashboard to preview it.')
    }

    setActiveQuiz({
      ...quiz,
      questions: [...quiz.questions].sort(() => Math.random() - 0.5)
    })
    setAnswers({})
    setPage('take')
  }

  function submitQuiz() {
    const total = activeQuiz.questions.filter(q => q.type !== 'open').length
    let score = 0

    const responseDetails = activeQuiz.questions.map(q => {
      const answer = answers[q.id] ?? ''
      const correct = q.type !== 'open' &&
        String(answer) === String(q.correctAnswer)

      if (correct) score++

      return {
        question: q.text,
        type: q.type,
        answer,
        correctAnswer: q.correctAnswer,
        correct
      }
    })

    const attempt = {
      id: makeId(),
      quizId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      quizCode: activeQuiz.code,
      userName: currentUser.name,
      userEmail: currentUser.email,
      score,
      total,
      responses: responseDetails,
      date: new Date().toLocaleString()
    }

    setAttempts(prev => [...prev, attempt])
    setActiveQuiz(null)
    setPage('results')
    setNotice(
      `Quiz submitted! Your score is ${score}/${total}. Open-ended answers are recorded for review.`
    )
  }

  function deleteQuiz(id) {
    if (!window.confirm('Delete this quiz and its reports?')) return

    setQuizzes(prev => prev.filter(q => q.id !== id))
    setAttempts(prev => prev.filter(a => a.quizId !== id))
    show('Quiz deleted.')
  }

  if (!currentUser) {
    return <div className="auth-shell">
      <div className="auth-card">
        <div className="brand-mark">Q</div>
        <p className="eyebrow">LEARN • PLAY • GROW</p>

        <h1>
          {authMode === 'login'
            ? 'Welcome back'
            : 'Create your account'}
        </h1>

        <p className="muted">
          Sign in to create quizzes or participate in them.
        </p>

        <form onSubmit={submitAuth} className="form-stack">
          {authMode === 'signup' && <>
            <label>
              Full name
              <input
                value={auth.name}
                onChange={e => setAuth({ ...auth, name: e.target.value })}
                placeholder="Enter your name"
              />
            </label>

            <label>
              Choose module
              <select
                value={auth.role}
                onChange={e => setAuth({ ...auth, role: e.target.value })}
              >
                <option value="user">User / Participant</option>
                <option value="admin">Admin / Quiz Creator</option>
              </select>
            </label>
          </>}

          <label>
            Email address
            <input
              type="email"
              value={auth.email}
              onChange={e => setAuth({ ...auth, email: e.target.value })}
              placeholder="name@example.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={auth.password}
              onChange={e => setAuth({ ...auth, password: e.target.value })}
              placeholder="Enter password"
            />
          </label>

          <button className="primary full">
            {authMode === 'login' ? 'Login' : 'Sign up'}
          </button>
        </form>

        <p className="switch-auth">
          {authMode === 'login'
            ? "Don't have an account?"
            : 'Already have an account?'}

          <button
            className="text-button"
            onClick={() => setAuthMode(
              authMode === 'login' ? 'signup' : 'login'
            )}
          >
            {authMode === 'login' ? 'Create account' : 'Login'}
          </button>
        </p>

        <p className="small muted">
          Demo project • Account data is stored in this browser.
        </p>
      </div>

      {notice && <div className="toast">{notice}</div>}
    </div>
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark small-mark">Q</span>
        <span>QuizBuilder</span>
      </div>

      <div className="role-chip">
        {currentUser.role === 'admin' ? 'ADMIN MODULE' : 'USER MODULE'}
      </div>

      <nav>
        <button
          className={page === 'dashboard' ? 'nav active' : 'nav'}
          onClick={() => setPage('dashboard')}
        >
          ▦ <span>Dashboard</span>
        </button>

        {currentUser.role === 'admin' ? <>
          <button
            className={page === 'quizzes' ? 'nav active' : 'nav'}
            onClick={() => setPage('quizzes')}
          >
            ▤ <span>My Quizzes</span>
          </button>

          <button
            className={page === 'reports' ? 'nav active' : 'nav'}
            onClick={() => setPage('reports')}
          >
            ▥ <span>Reports</span>
          </button>
        </> : <>
          <button
            className={page === 'join' ? 'nav active' : 'nav'}
            onClick={() => setPage('join')}
          >
            ＋ <span>Join Quiz</span>
          </button>

          <button
            className={page === 'results' ? 'nav active' : 'nav'}
            onClick={() => setPage('results')}
          >
            ◷ <span>My Results</span>
          </button>
        </>}
      </nav>

      <div className="sidebar-bottom">
        <div className="avatar">
          {currentUser.name[0]?.toUpperCase()}
        </div>

        <div className="user-mini">
          <strong>{currentUser.name}</strong>
          <span>{currentUser.email}</span>
        </div>

        <button className="logout" title="Logout" onClick={logout}>
          ↪
        </button>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div>
          <span className="muted small">WORKSPACE /</span>
          <strong>
            {page === 'create'
              ? 'Create Quiz'
              : page.charAt(0).toUpperCase() + page.slice(1)}
          </strong>
        </div>

        <div className="top-user">
          <span className="online-dot"></span>
          {currentUser.role === 'admin' ? 'Administrator' : 'Participant'}
        </div>
      </header>

      {page === 'dashboard' && <section className="content">
        <div className="welcome-row">
          <div>
            <p className="eyebrow">YOUR LEARNING SPACE</p>
            <h1>Hello, {currentUser.name.split(' ')[0]} 👋</h1>
            <p className="muted">
              {currentUser.role === 'admin'
                ? 'Create engaging quizzes and track participant performance.'
                : 'Discover quizzes, test your knowledge and track your progress.'}
            </p>
          </div>

          {currentUser.role === 'admin' &&
            <button className="primary" onClick={startNewQuiz}>
              ＋ Create quiz
            </button>}
        </div>

        {currentUser.role === 'admin' ? <>
          <div className="stats-grid">
            <Stat label="Quizzes created" value={myQuizzes.length} icon="▤" />
            <Stat
              label="Total attempts"
              value={attempts.filter(
                a => myQuizzes.some(q => q.id === a.quizId)
              ).length}
              icon="◷"
            />
            <Stat
              label="Questions created"
              value={myQuizzes.reduce(
                (n, q) => n + q.questions.length, 0
              )}
              icon="？"
            />
          </div>

          <div className="section-heading">
            <div>
              <h2>Recent quizzes</h2>
              <p className="muted">Manage your created quizzes</p>
            </div>
            <button className="secondary" onClick={() => setPage('quizzes')}>
              View all
            </button>
          </div>

          <QuizGrid
            quizzes={myQuizzes.slice(-3).reverse()}
            onDelete={deleteQuiz}
            onEdit={q => {
              setEditingQuiz(q)
              setPage('create')
            }}
            onReports={() => setPage('reports')}
          />
        </> : <>
          <div className="stats-grid">
            <Stat
              label="Available quizzes"
              value={quizzes.filter(
                q => q.createdBy !== currentUser.email
              ).length}
              icon="▤"
            />
            <Stat
              label="Quizzes attempted"
              value={myAttempts.length}
              icon="◷"
            />
            <Stat
              label="Correct answers"
              value={myAttempts.reduce((n, a) => n + a.score, 0)}
              icon="✓"
            />
          </div>

          <div className="join-banner">
            <div>
              <p className="eyebrow light">READY FOR A CHALLENGE?</p>
              <h2>Test what you know.</h2>
              <p>Enter a quiz code shared by your quiz creator.</p>
            </div>
            <button
              className="white-button"
              onClick={() => setPage('join')}
            >
              Join a quiz →
            </button>
          </div>

          <div className="section-heading">
            <div>
              <h2>Available quizzes</h2>
              <p className="muted">Choose a quiz to get started</p>
            </div>
          </div>

          <QuizGrid
            quizzes={quizzes.filter(
              q => q.createdBy !== currentUser.email
            )}
            onJoin={joinQuiz}
          />
        </>}
      </section>}

      {page === 'create' &&
        currentUser.role === 'admin' &&
        editingQuiz && <section className="content">

        <div className="welcome-row">
          <div>
            <p className="eyebrow">ADMIN MODULE</p>
            <h1>Create your quiz</h1>
            <p className="muted">
              Add a title, select question types and set correct answers.
            </p>
          </div>

          <button
            className="secondary"
            onClick={() => {
              setEditingQuiz(null)
              setPage('quizzes')
            }}
          >
            Cancel
          </button>
        </div>

        <div className="panel form-stack">
          <label>
            Quiz title
            <input
              value={editingQuiz.title}
              onChange={e => setEditingQuiz({
                ...editingQuiz,
                title: e.target.value
              })}
              placeholder="e.g. Java Fundamentals"
            />
          </label>

          <label>
            Description
            <textarea
              value={editingQuiz.description}
              onChange={e => setEditingQuiz({
                ...editingQuiz,
                description: e.target.value
              })}
              placeholder="What is this quiz about?"
              rows="2"
            />
          </label>

          <div className="code-line">
            <span>
              <strong>Quiz access code:</strong> {editingQuiz.code}
            </span>
            <span className="muted small">
              Share this code with participants
            </span>
          </div>
        </div>

        <div className="section-heading">
          <div>
            <h2>Questions ({editingQuiz.questions.length})</h2>
            <p className="muted">Choose a question type to add</p>
          </div>
        </div>

        <div className="type-buttons">
          <button className="secondary" onClick={() => addQuestion('mcq')}>
            ＋ Multiple choice
          </button>
          <button className="secondary" onClick={() => addQuestion('tf')}>
            ＋ True / False
          </button>
          <button className="secondary" onClick={() => addQuestion('open')}>
            ＋ Open-ended
          </button>
        </div>

        {editingQuiz.questions.map((q, i) =>
          <div className="panel question-editor" key={q.id}>
            <div className="question-top">
              <strong>Question {i + 1}</strong>

              <span className="type-tag">
                {q.type === 'mcq'
                  ? 'MULTIPLE CHOICE'
                  : q.type === 'tf' ? 'TRUE / FALSE' : 'OPEN-ENDED'}
              </span>

              <button
                className="icon-button danger-text"
                onClick={() => setEditingQuiz({
                  ...editingQuiz,
                  questions: editingQuiz.questions.filter(
                    x => x.id !== q.id
                  )
                })}
              >
                ✕
              </button>
            </div>

            <label>
              Question text
              <input
                value={q.text}
                onChange={e => updateQuestion(q.id, {
                  text: e.target.value
                })}
                placeholder="Enter your question"
              />
            </label>

            {(q.type === 'mcq' || q.type === 'tf') &&
              <div className="options-editor">
                <span className="label-title">
                  Answer options — select the correct answer
                </span>

                {q.options.map((option, oi) =>
                  <div className="option-row" key={oi}>
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      checked={
                        String(q.correctAnswer) ===
                        String(q.type === 'mcq' ? oi : option)
                      }
                      onChange={() => updateQuestion(q.id, {
                        correctAnswer: q.type === 'mcq'
                          ? String(oi)
                          : option
                      })}
                    />

                    <input
                      value={option}
                      disabled={q.type === 'tf'}
                      onChange={e => updateQuestion(q.id, {
                        options: q.options.map((o, index) =>
                          index === oi ? e.target.value : o
                        )
                      })}
                    />
                  </div>
                )}
              </div>}

            {q.type === 'open' &&
              <p className="muted small">
                Participants will type a response. Review these answers manually in Reports.
              </p>}
          </div>
        )}

        <div className="save-row">
          <button className="primary" onClick={saveQuiz}>
            Save quiz
          </button>
        </div>
      </section>}

      {page === 'quizzes' && currentUser.role === 'admin' &&
        <section className="content">
          <div className="welcome-row">
            <div>
              <h1>My Quizzes</h1>
              <p className="muted">Create, edit and manage your quizzes.</p>
            </div>
            <button className="primary" onClick={startNewQuiz}>
              ＋ Create quiz
            </button>
          </div>

          <QuizGrid
            quizzes={myQuizzes}
            onDelete={deleteQuiz}
            onEdit={q => {
              setEditingQuiz(q)
              setPage('create')
            }}
            onReports={() => setPage('reports')}
          />
        </section>}

      {page === 'reports' && currentUser.role === 'admin' &&
        <section className="content">
          <div className="welcome-row">
            <div>
              <h1>Quiz Reports</h1>
              <p className="muted">
                Review participant attempts and scores.
              </p>
            </div>
          </div>

          <div className="panel table-panel">
            {attempts.filter(
              a => myQuizzes.some(q => q.id === a.quizId)
            ).length === 0
              ? <Empty
                  title="No attempts yet"
                  text="Participant results will appear here after they submit a quiz."
                />
              : <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Participant</th>
                        <th>Quiz</th>
                        <th>Score</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attempts.filter(
                        a => myQuizzes.some(q => q.id === a.quizId)
                      ).slice().reverse().map(a =>
                        <tr key={a.id}>
                          <td>
                            <strong>{a.userName}</strong>
                            <small>{a.userEmail}</small>
                          </td>
                          <td>{a.quizTitle}</td>
                          <td>
                            <span className="score-pill">
                              {a.score}/{a.total}
                            </span>
                          </td>
                          <td>{a.date}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>}
          </div>

          {attempts.filter(
            a => myQuizzes.some(q => q.id === a.quizId)
          ).slice().reverse().map(a =>
            <div className="panel response-panel" key={a.id}>
              <h3>{a.quizTitle} — {a.userName}</h3>

              {a.responses.map((r, i) =>
                <div className="response-item" key={i}>
                  <strong>{i + 1}. {r.question}</strong>
                  <p className="muted">
                    Answer: {r.answer || 'No answer'} {' '}
                    {r.type === 'open'
                      ? '• Manual review required'
                      : r.correct
                        ? '• Correct'
                        : `• Correct answer: ${
                            r.type === 'mcq'
                              ? 'Option ' + (Number(r.correctAnswer) + 1)
                              : r.correctAnswer
                          }`}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>}

      {page === 'join' && currentUser.role === 'user' &&
        <section className="content narrow">
          <p className="eyebrow">PARTICIPANT MODULE</p>
          <h1>Join a quiz</h1>
          <p className="muted">
            Enter the access code provided by your quiz creator.
          </p>

          <div className="panel join-form">
            <label>
              Quiz access code
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3"
              />
            </label>

            <button
              className="primary full"
              onClick={() => joinQuiz(joinCode)}
            >
              Find quiz →
            </button>
          </div>

          <h2 className="subheading">Available quizzes</h2>

          <QuizGrid
            quizzes={quizzes.filter(
              q => q.createdBy !== currentUser.email
            )}
            onJoin={joinQuiz}
          />
        </section>}

      {page === 'take' && activeQuiz &&
        <section className="content narrow">
          <div className="quiz-heading">
            <p className="eyebrow">
              QUIZ IN PROGRESS • CODE {activeQuiz.code}
            </p>
            <h1>{activeQuiz.title}</h1>
            <p className="muted">{activeQuiz.description}</p>
            <span className="type-tag">
              {activeQuiz.questions.length} QUESTIONS
            </span>
          </div>

          {activeQuiz.questions.map((q, i) =>
            <div className="panel take-question" key={q.id}>
              <p className="question-number">
                QUESTION {i + 1} OF {activeQuiz.questions.length}
              </p>

              <h3>{q.text}</h3>

              {q.type === 'open'
                ? <textarea
                    rows="4"
                    placeholder="Type your answer..."
                    value={answers[q.id] ?? ''}
                    onChange={e => setAnswers({
                      ...answers,
                      [q.id]: e.target.value
                    })}
                  />
                : q.options.map((option, oi) =>
                    <label className="answer-option" key={oi}>
                      <input
                        type="radio"
                        name={q.id}
                        checked={
                          String(answers[q.id] ?? '') ===
                          String(q.type === 'mcq' ? oi : option)
                        }
                        onChange={() => setAnswers({
                          ...answers,
                          [q.id]: q.type === 'mcq'
                            ? String(oi)
                            : option
                        })}
                      />
                      {option}
                    </label>
                  )}
            </div>
          )}

          <button className="primary full" onClick={submitQuiz}>
            Submit quiz
          </button>
        </section>}

      {page === 'results' && currentUser.role === 'user' &&
        <section className="content">
          <div className="welcome-row">
            <div>
              <h1>My Results</h1>
              <p className="muted">
                Your quiz attempts and performance.
              </p>
            </div>
            <button className="primary" onClick={() => setPage('join')}>
              ＋ Join quiz
            </button>
          </div>

          {myAttempts.length === 0
            ? <div className="panel">
                <Empty
                  title="No results yet"
                  text="Join a quiz to see your scores here."
                />
              </div>
            : <div className="stats-grid">
                <Stat
                  label="Quizzes attempted"
                  value={myAttempts.length}
                  icon="◷"
                />
                <Stat
                  label="Correct answers"
                  value={myAttempts.reduce((n, a) => n + a.score, 0)}
                  icon="✓"
                />
                <Stat
                  label="Average score"
                  value={`${Math.round(
                    myAttempts.reduce(
                      (n, a) => n + (a.total ? a.score / a.total : 0), 0
                    ) / myAttempts.length * 100
                  )}%`}
                  icon="％"
                />
              </div>}

          {myAttempts.slice().reverse().map(a =>
            <div className="panel result-card" key={a.id}>
              <div>
                <h3>{a.quizTitle}</h3>
                <p className="muted small">{a.date}</p>
              </div>
              <div className="result-score">
                {a.score}<span>/{a.total}</span>
              </div>
            </div>
          )}
        </section>}
    </main>

    {notice && <div className="toast">{notice}</div>}
  </div>
}

function Stat({ label, value, icon }) {
  return <div className="stat-card">
    <div className="stat-icon">{icon}</div>
    <div>
      <p className="muted">{label}</p>
      <strong>{value}</strong>
    </div>
  </div>
}

function Empty({ title, text }) {
  return <div className="empty">
    <div className="empty-icon">▤</div>
    <h3>{title}</h3>
    <p className="muted">{text}</p>
  </div>
}

function QuizGrid({ quizzes, onDelete, onEdit, onReports, onJoin }) {
  if (!quizzes.length) {
    return <div className="panel">
      <Empty
        title="Nothing here yet"
        text="Your quizzes will appear here when they are created."
      />
    </div>
  }

  return <div className="quiz-grid">
    {quizzes.map(q =>
      <article className="quiz-card" key={q.id}>
        <div className="quiz-card-top">
          <span className="quiz-icon">Q</span>
          <span className="type-tag">
            {q.questions.length} QUESTIONS
          </span>
        </div>

        <h3>{q.title}</h3>

        <p className="muted description">
          {q.description || 'No description added.'}
        </p>

        <div className="quiz-meta">
          <span>⌁ Code: <strong>{q.code}</strong></span>
          <span>◷ {q.questions.length} questions</span>
        </div>

        {onJoin
          ? <button
              className="primary full"
              onClick={() => onJoin(q.code)}
            >
              Join quiz →
            </button>
          : <div className="card-actions">
              {onEdit &&
                <button className="secondary" onClick={() => onEdit(q)}>
                  Edit
                </button>}

              {onReports &&
                <button className="secondary" onClick={onReports}>
                  Reports
                </button>}

              {onDelete &&
                <button
                  className="icon-button danger-text"
                  onClick={() => onDelete(q.id)}
                >
                  Delete
                </button>}
            </div>}
      </article>
    )}
  </div>
}

export default App