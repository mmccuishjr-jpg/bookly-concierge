'use client';

import { useEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import Image from 'next/image';
import {
  AlertTriangle, ArrowUp, BookOpen, Bot, Check, ChevronDown, CircleDot,
  Clock3, Code2, Database, LockKeyhole, PackageCheck, RefreshCcw,
  RotateCcw, ShieldCheck, Sparkles, Truck, UserRound, Wrench,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import type { ChatMessage, ChatResponse, ContentCard, SessionState, TraceEvent } from '@/lib/bookly/types';

const initialMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hi Michael — I can help track an order, start a return, or answer a question about Bookly policies. What can I help you with today?',
};
const initialState: SessionState = { returnRecords: [], attempts: 0 };
const starters = [
  { icon: PackageCheck, label: 'Track an order', prompt: 'Where is my order?' },
  { icon: RotateCcw, label: 'Start a return', prompt: 'I want to return a book.' },
  { icon: Clock3, label: 'Shipping questions', prompt: 'How long does standard shipping take?' },
];
const traceIcons: Record<TraceEvent['category'], typeof CircleDot> = {
  intent: Sparkles, memory: Database, tool: Wrench, guardrail: ShieldCheck, response: Bot,
};

function currency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function OrderCard({ card }: { card: Extract<ContentCard, { kind: 'order' }> }) {
  const { order } = card;
  const currentStep = order.status === 'processing' ? 1 : order.status === 'in_transit' ? 2 : 3;
  return (
    <div className="result-card mt-3" aria-label={`Order ${order.id} details`}>
      <div className="flex items-center justify-between gap-4 border-b border-border/70 px-4 py-3.5">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Order {order.id}</p><p className="mt-1 text-sm font-semibold">{order.statusLabel}</p></div>
        <Badge className="rounded-full bg-[#e8f3e9] px-2.5 text-[#2f6a3c] hover:bg-[#e8f3e9]"><Truck className="size-3" /> {order.status === 'delivered' ? 'Delivered' : 'On schedule'}</Badge>
      </div>
      <div className="p-4">
        <div className="mb-5 grid grid-cols-3 gap-2" aria-label="Order progress">
          {['Ordered', 'In transit', 'Delivered'].map((label, index) => (
            <div key={label}><span className={`block h-1 rounded-full ${index < currentStep ? 'bg-primary' : 'bg-[#e5ded2]'}`} /><span className={`mt-1.5 block text-[10px] font-semibold ${index < currentStep ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span></div>
          ))}
        </div>
        <div className="flex items-start justify-between gap-4 rounded-xl bg-[#f6f2eb] px-3.5 py-3">
          <div className="flex items-start gap-2.5"><Clock3 className="mt-0.5 size-4 text-primary" /><div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{order.status === 'delivered' ? 'Delivered' : 'Expected delivery'}</p><p className="mt-1 text-sm font-semibold">{order.eta ?? order.deliveredAt}</p></div></div>
          <span className="text-right text-[11px] text-muted-foreground">{order.carrier}<br />•••• {order.trackingSuffix}</span>
        </div>
        <div className="mt-3 space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border/65 bg-white p-2.5">
              <Image src={item.coverUrl} alt={`Cover of ${item.title}`} width={40} height={56} className="h-14 w-10 rounded-[4px] bg-[#e8e1d5] object-cover shadow-sm" />
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{item.title}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.author}</p></div>
              <span className="text-xs font-semibold">{currency(item.price)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReturnCard({ card, onAction }: { card: Extract<ContentCard, { kind: 'return_proposal' | 'return_confirmation' }>; onAction: (message: string) => void }) {
  const confirmed = card.kind === 'return_confirmation';
  return (
    <div className="result-card mt-3">
      <div className="flex gap-3 p-4">
        <div className={`grid size-9 flex-none place-items-center rounded-full ${confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-[#f4e7df] text-primary'}`}>{confirmed ? <Check className="size-4" /> : <RotateCcw className="size-4" />}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{confirmed ? 'Return approved' : 'Review your return'}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{card.item.title} · {card.orderId}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[#f7f3ed] p-3 text-xs">
            <div><dt className="text-muted-foreground">Reason</dt><dd className="mt-1 font-semibold">{card.reason}</dd></div>
            <div><dt className="text-muted-foreground">Refund</dt><dd className="mt-1 font-semibold">{currency(card.amount)}</dd></div>
            {card.returnId && <div className="col-span-2 border-t border-border/70 pt-2"><dt className="text-muted-foreground">Return ID</dt><dd className="mt-1 font-mono font-semibold">{card.returnId}</dd></div>}
          </dl>
          {!confirmed && <div className="mt-3 flex gap-2"><Button onClick={() => onAction('Yes, confirm the return.')} size="sm" className="rounded-full px-3.5">Confirm return</Button><Button onClick={() => onAction('No, cancel it.')} size="sm" variant="outline" className="rounded-full px-3.5">Cancel</Button></div>}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ card, onAction }: { card: ContentCard; onAction: (message: string) => void }) {
  if (card.kind === 'order') return <OrderCard card={card} />;
  return <ReturnCard card={card} onAction={onAction} />;
}

function Inspector({ trace, state, busy }: { trace: TraceEvent[]; state: SessionState; busy: boolean }) {
  const memory = [
    state.verifiedEmail ? { label: 'Customer', value: state.verifiedEmail.replace(/(^.).*(@.*$)/, '$1••••$2') } : null,
    state.activeOrderId ? { label: 'Active order', value: state.activeOrderId } : null,
    state.selectedItemId ? { label: 'Selected item', value: state.selectedItemId } : null,
    state.returnReason ? { label: 'Return reason', value: state.returnReason } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <aside className="inspector-shell lg:min-h-[calc(100vh-122px)]" aria-label="Agent inspector">
      <div className="flex items-start justify-between border-b border-white/10 px-5 py-5">
        <div><p className="eyebrow-dark">Evaluator view</p><h2 className="mt-1 font-heading text-lg font-semibold tracking-tight">Agent Inspector</h2></div>
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300"><span className={`size-1.5 rounded-full bg-emerald-300 ${busy ? 'animate-pulse' : ''}`} /> {busy ? 'Working' : 'Ready'}</span>
      </div>
      <div className="inspector-scroll space-y-5 px-5 py-5">
        {trace.length === 0 ? (
          <><p className="text-sm leading-6 text-[#a9ada8]">Start a conversation to see intent, memory, tool calls, and guardrail decisions as they happen.</p><div className="trace-card"><div className="trace-step"><span>1</span><p><strong>Understand</strong><small>Classify intent and required context</small></p></div><div className="trace-step"><span>2</span><p><strong>Ground</strong><small>Use approved policies and order data</small></p></div><div className="trace-step"><span>3</span><p><strong>Act</strong><small>Execute explicit, permissioned tools</small></p></div></div></>
        ) : (
          <div><p className="eyebrow-dark mb-3">Latest agent turn</p><div className="space-y-2.5">
            {trace.map((event, index) => { const Icon = traceIcons[event.category]; return (
              <div key={event.id} className={`event-card event-${event.status}`}><div className="event-icon"><Icon className="size-3.5" /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-[#f1f3ee]">{event.title}</p><span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#747d75]">0{index + 1}</span></div><p className="mt-1 text-[11px] leading-[1.55] text-[#a6ada6]">{event.summary}</p>{event.detail && <code className="mt-2 block overflow-x-auto rounded-lg bg-black/20 px-2.5 py-2 text-[9px] leading-4 text-[#b8c0b8]">{event.detail}</code>}</div></div>
            ); })}
          </div></div>
        )}
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex items-center justify-between"><p className="eyebrow-dark">Session memory</p><LockKeyhole className="size-3.5 text-[#737b73]" /></div>
          {memory.length ? <dl className="mt-3 space-y-2.5">{memory.map((item) => <div key={item.label} className="flex items-center justify-between gap-3 text-[11px]"><dt className="text-[#858e86]">{item.label}</dt><dd className="font-mono text-[#d8ddd7]">{item.value}</dd></div>)}</dl> : <p className="mt-2 text-[11px] leading-5 text-[#858e86]">No private context stored. Memory is scoped to this browser session.</p>}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="eyebrow-dark">Architecture thesis</p><blockquote className="mt-2 text-[13px] leading-6 text-[#e6e8e3]">AI interprets the conversation. Deterministic tools establish truth and take action.</blockquote></div>
      </div>
    </aside>
  );
}

export function SupportExperience() {
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [session, setSession] = useState<SessionState>(initialState);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);
  const hasConversation = messages.length > 1;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, busy]);

  async function sendMessage(raw: string) {
    const content = raw.trim();
    if (!content || busy) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content };
    const prior = messages.map(({ role, content: messageContent }) => ({ role, content: messageContent }));
    setMessages((current) => [...current, userMessage]);
    setInput(''); setBusy(true); setError(undefined);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: content, state: session, mode: 'demo', history: prior }) });
      if (!response.ok) throw new Error('The support agent did not respond.');
      const result = await response.json() as ChatResponse;
      setSession(result.state); setTrace(result.trace); setMessages((current) => [...current, result.message]);
    } catch { setError('The agent hit a connection problem. Your request was not submitted.'); }
    finally { setBusy(false); }
  }

  function submit(event: SyntheticEvent<HTMLFormElement>) { event.preventDefault(); void sendMessage(input); }
  function reset() { setMessages([initialMessage]); setSession(initialState); setTrace([]); setInput(''); setError(undefined); }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/95 backdrop-blur"><div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-2.5"><span className="brand-mark"><BookOpen aria-hidden="true" /></span><span className="font-heading text-xl font-semibold tracking-[-0.03em]">Bookly</span></div>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground sm:flex" aria-label="Primary navigation"><a href="#support" className="text-foreground">Support</a><span>My orders</span><button className="flex items-center gap-1 transition-colors hover:text-foreground" type="button">Michael <ChevronDown className="size-3.5" /></button></nav>
        <Button onClick={reset} variant="outline" size="sm" className="rounded-full bg-white/50"><RefreshCcw className="size-3.5" /> Reset demo</Button>
      </div></header>

      <section id="support" className="mx-auto grid max-w-[1440px] gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-7">
        <article className="support-shell flex min-h-[calc(100vh-122px)] flex-col overflow-hidden">
          <div className="border-b border-border/75 px-5 py-4 sm:px-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="mb-1 flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.12)]" /><span className="text-xs font-medium text-muted-foreground">Online now</span></div><h1 className="font-heading text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">Bookly Support</h1></div><Badge variant="secondary" className="h-7 gap-1.5 rounded-full bg-[#f1eee7] px-3 text-[#625d55]"><Sparkles className="size-3.5" /> AI concierge</Badge></div></div>
          <div className="chat-scroll flex-1 px-5 py-6 sm:px-8" aria-live="polite"><div className="mx-auto w-full max-w-[760px] space-y-6">
            {messages.map((message) => <div key={message.id} className={`flex gap-3.5 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' && <div className="assistant-avatar"><BookOpen className="size-4" /></div>}
              <div className={`${message.role === 'user' ? 'max-w-[78%]' : 'max-w-[650px]'} min-w-0`}><p className={`mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground ${message.role === 'user' ? 'text-right' : ''}`}>{message.role === 'assistant' ? 'Bookly' : 'You'}</p><div className={message.role === 'assistant' ? 'assistant-bubble' : 'user-bubble'}><p className="whitespace-pre-wrap text-[15px] leading-6">{message.content}</p></div>{message.card && <ResultCard card={message.card} onAction={sendMessage} />}</div>
              {message.role === 'user' && <div className="user-avatar"><UserRound className="size-4" /></div>}
            </div>)}
            {busy && <div className="flex gap-3.5"><div className="assistant-avatar"><BookOpen className="size-4" /></div><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Bookly</p><div className="assistant-bubble flex h-12 items-center gap-1.5"><span className="typing-dot" /><span className="typing-dot [animation-delay:120ms]" /><span className="typing-dot [animation-delay:240ms]" /></div></div></div>}
            <div ref={endRef} />
          </div></div>
          <div className="border-t border-border/70 bg-[#fcfaf6]/95 px-5 py-4 sm:px-8"><div className="mx-auto w-full max-w-[760px]">
            {!hasConversation && <div className="mb-3 grid gap-2 sm:grid-cols-3" aria-label="Suggested questions">{starters.map(({ icon: Icon, label, prompt }) => <button key={label} onClick={() => void sendMessage(prompt)} className="starter-card" type="button"><Icon className="size-4 text-primary" /><span>{label}</span></button>)}</div>}
            {error && <div role="alert" className="mb-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700"><AlertTriangle className="size-4" /> {error}</div>}
            <form onSubmit={submit}><InputGroup className="h-14 rounded-2xl border-[#d8d2c7] bg-white pl-2 shadow-[0_8px_28px_rgba(46,39,29,.07)] focus-within:border-primary/50"><InputGroupInput value={input} onChange={(event) => setInput(event.target.value)} disabled={busy} aria-label="Message Bookly Support" placeholder="Ask Bookly Support…" className="h-full text-[15px]" autoComplete="off" /><InputGroupAddon align="inline-end" className="pr-2"><InputGroupButton disabled={busy || !input.trim()} aria-label="Send message" type="submit" size="icon-sm" className="size-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"><ArrowUp className="size-4" /></InputGroupButton></InputGroupAddon></InputGroup></form>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground"><p className="flex items-center gap-1.5"><ShieldCheck className="size-3" /> Identity is verified before order data is disclosed.</p><p className="font-mono">Try: B-1042 · michael@example.com</p></div>
          </div></div>
        </article>
        <Inspector trace={trace} state={session} busy={busy} />
      </section>
      <footer className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 pb-7 text-[11px] text-muted-foreground sm:px-8"><p>Bookly is fictional. All customer and order data is synthetic.</p><p className="flex items-center gap-3"><span className="flex items-center gap-1"><Code2 className="size-3" /> TypeScript</span><span className="flex items-center gap-1"><Database className="size-3" /> Mock tools</span><span className="flex items-center gap-1"><ShieldCheck className="size-3" /> Guardrailed actions</span></p></footer>
    </main>
  );
}
