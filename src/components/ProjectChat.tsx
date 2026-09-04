import { useEffect, useRef, useState } from 'react'
import { Card, Chip, H3 } from './ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { notifyNewMessage } from './NotificationCenter'

interface Message { id: string; order_id: string; sender_user_id: string; sender_role: 'CUSTOMER' | 'CEO'; message: string; created_at: string; read_at: string | null; deleted_at: string | null }

export function ProjectChat({ orderId, isCeo = false, projectName = 'Project' }: { orderId: string; isCeo?: boolean; projectName?: string }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    const { data, error: queryError } = await supabase.from('order_messages').select('*').eq('order_id', orderId).is('deleted_at', null).order('created_at', { ascending: true }).limit(100)
    if (queryError) setError(queryError.message)
    else setMessages((data ?? []) as Message[])
    await supabase.rpc('mark_order_messages_read', { p_order_id: orderId })
  }

  useEffect(() => {
    load()
    const channel = supabase.channel(`order-chat-${orderId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_messages', filter: `order_id=eq.${orderId}` }, (payload) => {
        const message = payload.new as Message
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
        if (message.sender_user_id !== user?.id) {
          notifyNewMessage(`New message regarding ${projectName}`, message.message.slice(0, 160))
          supabase.rpc('mark_order_messages_read', { p_order_id: orderId })
        }
      })
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'))
    return () => { supabase.removeChannel(channel) }
  }, [orderId, user?.id])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!user || !text || sending) return
    setSending(true)
    setError(null)
    const senderRole = isCeo ? 'CEO' : 'CUSTOMER'
    const { data, error: sendError } = await supabase.from('order_messages').insert({ order_id: orderId, sender_user_id: user.id, sender_role: senderRole, message: text }).select().single()
    if (sendError) setError('Message failed to send. Please try again.')
    else if (data) { setMessages((current) => [...current, data as Message]); setDraft('') }
    setSending(false)
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3"><div><H3>Project chat</H3><p className="mt-1 text-xs text-muted">{projectName} · Private conversation with MAI Corp</p></div><Chip tone={connected ? 'ok' : 'warn'}>{connected ? 'Connected' : 'Reconnecting…'}</Chip></div>
      <div className="mt-5 max-h-[30rem] min-h-48 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-black/10 p-4">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">No messages yet. Send a message to MAI Corp about your project.</p>}
        {messages.map((item) => <div key={item.id} className={`flex ${item.sender_user_id === user?.id ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${item.sender_user_id === user?.id ? 'bg-primary/20 text-hi' : 'bg-white/10 text-hi/90'}`}><div className="whitespace-pre-wrap">{item.message}</div><div className="mt-1 text-[10px] text-muted">{item.sender_user_id === user?.id ? 'You' : item.sender_role === 'CEO' ? 'MAI Corp' : 'Customer'} · {new Date(item.created_at).toLocaleString()}</div></div></div>)}
        <div ref={endRef} />
      </div>
      {error && <p className="mt-3 text-sm text-err">{error}</p>}
      <form onSubmit={send} className="mt-4 flex gap-2"><label className="sr-only" htmlFor={`message-${orderId}`}>Message</label><textarea id={`message-${orderId}`} className="input min-h-11 resize-y" rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type a message…" disabled={!user || sending} /><button className="btn-primary self-end" type="submit" disabled={!user || !draft.trim() || sending}>{sending ? 'Sending…' : 'Send'}</button></form>
    </Card>
  )
}
