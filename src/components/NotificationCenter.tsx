import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export function NotificationCenter() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [muted, setMuted] = useState(() => localStorage.getItem('mai-notification-muted') === 'true')

  const load = async () => {
    if (!user) return
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
    setItems(data ?? [])
  }

  useEffect(() => {
    if (!user) return
    load()
    const channel = supabase.channel(`notifications-${user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
      setItems((current) => [payload.new, ...current].slice(0, 20))
    }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  if (!user) return null
  const unread = items.filter((item) => !item.read_at).length
  const toggleMute = () => { const next = !muted; setMuted(next); localStorage.setItem('mai-notification-muted', String(next)) }
  const openNotification = async (item: any) => {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id).eq('user_id', user.id)
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry))
    setOpen(false)
    if (item.order_id) navigate(user.role === 'CEO' ? `/ceo/orders/${item.order_id}` : `/account/orders/${item.order_id}`)
  }

  return (
    <div className="relative">
      <button className="relative btn-ghost px-2.5" onClick={() => setOpen((value) => !value)} aria-label="Open notifications" aria-expanded={open}><Bell size={16} />{unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] text-white">{unread > 9 ? '9+' : unread}</span>}</button>
      {open && <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line/60 bg-bg p-3 shadow-2xl"><div className="flex items-center justify-between border-b border-white/10 pb-2"><div className="text-sm font-semibold">Notifications</div><button className="text-muted hover:text-hi" onClick={toggleMute} aria-label={muted ? 'Unmute notifications' : 'Mute notifications'}>{muted ? <BellOff size={15} /> : <Bell size={15} />}</button></div><div className="max-h-80 overflow-y-auto">{items.length === 0 ? <p className="py-6 text-center text-xs text-muted">No notifications yet.</p> : items.map((item) => <button key={item.id} className={`block w-full border-b border-white/5 px-2 py-3 text-left text-xs ${item.read_at ? 'text-muted' : 'text-hi'}`} onClick={() => openNotification(item)}><div className="font-medium">{item.title}</div><div className="mt-1 line-clamp-2">{item.body}</div><div className="mt-1 text-[10px] text-muted">{new Date(item.created_at).toLocaleString()}</div></button>)}</div></div>}
    </div>
  )
}

export function notificationSoundEnabled() {
  return localStorage.getItem('mai-notification-muted') !== 'true'
}

export function notifyNewMessage(title: string, body: string) {
  if (!notificationSoundEnabled()) return
  try {
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 740
    gain.gain.setValueAtTime(0.04, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.12)
  } catch { /* Browser audio may require prior interaction. */ }
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(title, { body })
}
