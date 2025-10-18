import React, { useEffect, useState, useMemo } from 'react'
import { auth, googleProvider, facebookProvider, db } from './firebase'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore'

const sanitizeMessage = (text) => {
  const banned = ['سفك','سب','قلة ادب','حرام']
  let clean = text
  banned.forEach(word => {
    const re = new RegExp(word, 'gi')
    clean = clean.replace(re, '***')
  })
  return clean
}

export default function App(){
  const [user, setUser] = useState(null)
  const [mode, setMode] = useState(localStorage.getItem('theme') || 'light')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [targetFilter, setTargetFilter] = useState('all')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (u && u.email && u.email.endsWith('@yourcollege.edu')) setIsAdmin(true)
      else setIsAdmin(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => localStorage.setItem('theme', mode), [mode])

  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('created_at', 'desc'), limit(200))
    const unsub = onSnapshot(q, (snap) => {
      const arr = []
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }))
      setMessages(arr)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  return (
    <div className={mode === 'dark' ? 'theme-dark app-root' : 'theme-light app-root'}>
      <div style={{maxWidth:900, margin:'24px auto', padding:16}}>
        <Header user={user} mode={mode} setMode={setMode} onSignOut={() => signOut(auth)} />
        <main>
          <Hero />
          <div style={{display:'flex', gap:16, marginTop:16}}>
            <div style={{flex:1}}>
              {!user && <AuthPanel />}
              <ComposeBox user={user} />
              <div style={{marginTop:12}}>
                <FilterBar targetFilter={targetFilter} setTargetFilter={setTargetFilter} />
                <Feed messages={messages} filter={targetFilter} user={user} isAdmin={isAdmin} />
              </div>
            </div>
            <aside style={{width:300}}>
              <AboutCard />
              {isAdmin && <AdminPanel />}
            </aside>
          </div>
        </main>
      </div>
    </div>
  )
}

function Header({ user, mode, setMode, onSignOut }){
  return (
    <header style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
      <div>
        <h1 style={{margin:0}}>صارح طالب - سياحة رياضية</h1>
        <div style={{fontSize:12}}>شبكة رسائل مجهولة للدفعة</div>
      </div>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}>
          {mode === 'dark' ? 'Light' : 'Dark'}
        </button>
        {user ? (
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <div style={{fontSize:12}}>{user.email || user.displayName}</div>
            <button onClick={onSignOut}>خروج</button>
          </div>
        ) : null}
      </div>
    </header>
  )
}

function Hero(){ return (
  <section style={{marginTop:12}}>
    <div style={{padding:12, borderRadius:8}}>
      <strong>قواعد بسيطة</strong>
      <ul>
        <li>مجهولية الرسائل. لا اسماء.</li>
        <li>لا تنشر بيانات شخصية.</li>
        <li>ممنوع التهديد والسب.</li>
      </ul>
    </div>
  </section>
) }

function AuthPanel(){
  const signInGoogle = async () => { try { await signInWithPopup(auth, googleProvider) } catch(e){ alert('فشل') } }
  const signInFacebook = async () => { try { await signInWithPopup(auth, facebookProvider) } catch(e){ alert('فشل') } }
  return (
    <div style={{marginTop:12}}>
      <div style={{marginBottom:8}}>سجل دخولك علشان تستقبل رسائل</div>
      <div style={{display:'flex', gap:8}}>
        <button onClick={signInGoogle}>دخول بجوجل</button>
        <button onClick={signInFacebook}>دخول بفيسبوك</button>
      </div>
      <div style={{fontSize:12, marginTop:8}}>لو الخلفية تمنع الدخول جرب متصفح اخر او اضف مفاتيح OAuth.</div>
    </div>
  )
}

function ComposeBox({ user }){
  const [text, setText] = useState('')
  const [target, setTarget] = useState('general')
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!text.trim()) return alert('اكتب رسالة')
    setSending(true)
    try {
      const clean = sanitizeMessage(text)
      await addDoc(collection(db, 'messages'), { text: clean, target, created_at: serverTimestamp(), flags_count: 0 })
      setText('')
    } catch(e){ alert('فشل') }
    setSending(false)
  }

  return (
    <div style={{padding:12, borderRadius:8, marginBottom:8}}>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <select value={target} onChange={(e)=>setTarget(e.target.value)}>
          <option value="general">الدفعة عامة</option>
          <option value="psych">مادة: مبادئ علم النفس الرياضي</option>
          <option value="lecturer">للدكاترة</option>
        </select>
        <button onClick={()=>setText('')}>مسح</button>
      </div>
      <textarea value={text} onChange={(e)=>setText(e.target.value)} placeholder="اكتب رسالة مجهولة" style={{width:'100%', height:80, marginTop:8}} />
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8}}>
        <div style={{fontSize:12}}>ممنوع السب والتهديد. البلاغ يوصل للمشرفين.</div>
        <div><button onClick={send} disabled={sending}>{sending ? 'جاري الارسال' : 'ارسل'}</button></div>
      </div>
    </div>
  )
}

function FilterBar({ targetFilter, setTargetFilter }){
  return (
    <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8}}>
      <div>فرز:</div>
      <button onClick={() => setTargetFilter('all')}>الكل</button>
      <button onClick={() => setTargetFilter('general')}>دفعة</button>
      <button onClick={() => setTargetFilter('psych')}>علم النفس الرياضي</button>
      <button onClick={() => setTargetFilter('lecturer')}>للدكاترة</button>
    </div>
  )
}

function Feed({ messages, filter, user, isAdmin }){
  const filtered = useMemo(()=> filter === 'all' ? messages : messages.filter(m => m.target === filter || m.target === 'general'), [messages, filter])
  if (!messages.length) return <div>لا توجد رسائل حتى الآن</div>
  return (<div>{filtered.map(m => <MessageCard key={m.id} m={m} isAdmin={isAdmin} />)}</div>)
}

function MessageCard({ m, isAdmin }){
  const [reported, setReported] = useState(false)
  const report = async () => {
    if (reported) return
    try {
      await addDoc(collection(db, 'flags'), { message_id: m.id, reason: 'reported', created_at: serverTimestamp() })
      const docRef = doc(db, 'messages', m.id)
      await updateDoc(docRef, { flags_count: (m.flags_count || 0) + 1 })
      setReported(true)
      alert('تم الابلاغ')
    } catch(e){ alert('فشل') }
  }
  const remove = async () => {
    if (!isAdmin) return alert('مش مشرف')
    try { await deleteDoc(doc(db, 'messages', m.id)) } catch(e){ alert('فشل') }
  }
  return (
    <div style={{padding:12, borderRadius:8, marginBottom:8, background:'rgba(0,0,0,0.03)'}}>
      <div style={{fontSize:14, whiteSpace:'pre-wrap'}}>{m.text}</div>
      <div style={{display:'flex', justifyContent:'space-between', marginTop:8}}>
        <div style={{fontSize:12}}>{new Date(m.created_at?.toDate?.() || Date.now()).toLocaleString()}</div>
        <div style={{display:'flex', gap:8}}>
          <button onClick={report} disabled={reported}>{reported ? 'تم الابلاغ' : 'ابلاغ'}</button>
          {isAdmin ? <button onClick={remove}>حذف</button> : null}
        </div>
      </div>
    </div>
  )
}

function AboutCard(){ return (
  <div style={{padding:12, borderRadius:8, marginBottom:8}}>
    <div style={{fontWeight:700}}>عن صارح طالب</div>
    <div style={{fontSize:13, marginTop:8}}>شبكة رسائل مجهولة موجهة لدفعة سياحة رياضية.</div>
  </div>
) }

function AdminPanel(){ return (
  <div style={{padding:12, borderRadius:8}}>
    <div style={{fontWeight:700}}>لوحة المشرف</div>
    <div style={{fontSize:13, marginTop:8}}>قائمة بلاغات، حذف رسائل، حظر حسابات.</div>
  </div>
) }
