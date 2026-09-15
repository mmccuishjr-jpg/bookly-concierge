'use client';

import { useEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import {
  AlertTriangle, ArrowRight, ArrowUp, BookHeart, BookOpen, Check,
  CircleDot, Clock3, Code2, Database, ExternalLink, LockKeyhole, MessageSquareWarning,
  LogOut, Mail, PackageCheck, RefreshCcw, ShieldCheck, ShoppingCart, Sparkles, Truck, UserRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import type { ChatMessage, ChatResponse, ContentCard, SessionState, TraceEvent } from '@/lib/bookly/types';

const AIRTABLE_CASES_URL = 'https://airtable.com/app4MC2VM6q6uHQC1/tbl2N4FWOeF7WrXX7';
const initialMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Welcome back, Mara. I can help with your orders and Bookly policies — or use your reading profile to find your next great book. What are you in the mood for?',
};
const initialState: SessionState = { returnRecords: [], attempts: 0, customerId: 'CUS-0001', customerName: 'Mara Finch', dataSource: 'airtable' };
const starters = [
  { icon: BookHeart, label: 'Find my next book', prompt: 'Can you recommend a book for me?' },
  { icon: PackageCheck, label: 'Check latest order', prompt: 'Where is my latest order?' },
  { icon: MessageSquareWarning, label: 'Report a problem', prompt: 'I need to report a problem.' },
];
function currency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function BookPlaceholder({ compact = false }: { compact?: boolean }) {
  return <div className={`grid flex-none place-items-center rounded-md bg-[#e8e1d5] text-[#8f7d68] shadow-sm ${compact ? 'h-14 w-10' : 'h-28 w-20'}`}><BookOpen className={compact ? 'size-4' : 'size-6'} /></div>;
}

function OrderCard({ card }: { card: Extract<ContentCard, { kind: 'order' }> }) {
  const { order } = card;
  const currentStep = order.status === 'processing' ? 1 : order.status === 'in_transit' ? 2 : 3;
  return <div className="result-card mt-3" aria-label={`Order ${order.id} details`}>
    <div className="flex items-center justify-between gap-4 border-b border-border/70 px-4 py-3.5"><div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Order {order.id}</p><p className="mt-1 text-sm font-semibold">{order.statusLabel}</p></div><Badge className="rounded-full bg-[#e8f3e9] px-2.5 text-[#2f6a3c] hover:bg-[#e8f3e9]"><Truck className="size-3" /> {order.status === 'delivered' ? 'Delivered' : 'On schedule'}</Badge></div>
    <div className="p-4"><div className="mb-5 grid grid-cols-3 gap-2" aria-label="Order progress">{['Ordered', 'In transit', 'Delivered'].map((label, index) => <div key={label}><span className={`block h-1 rounded-full ${index < currentStep ? 'bg-primary' : 'bg-[#e5ded2]'}`} /><span className={`mt-1.5 block text-[10px] font-semibold ${index < currentStep ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span></div>)}</div>
      {(order.eta || order.deliveredAt) && <div className="flex items-start justify-between gap-4 rounded-xl bg-[#f6f2eb] px-3.5 py-3"><div className="flex items-start gap-2.5"><Clock3 className="mt-0.5 size-4 text-primary" /><div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{order.status === 'delivered' ? 'Delivered' : 'Expected delivery'}</p><p className="mt-1 text-sm font-semibold">{order.eta ?? order.deliveredAt}</p></div></div>{order.carrier && <span className="text-right text-[11px] text-muted-foreground">{order.carrier}</span>}</div>}
      <div className="mt-3 space-y-2">{order.items.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border/65 bg-white p-2.5"><BookPlaceholder compact /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{item.title}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.author}</p></div><span className="text-xs font-semibold">{currency(item.price)}</span></div>)}</div>
    </div>
  </div>;
}

function RecommendationCard({ card, cartIds, onAddToCart }: { card: Extract<ContentCard, { kind: 'recommendations' }>; cartIds: string[]; onAddToCart: (id: string) => void }) {
  const [expandedId, setExpandedId] = useState<string>();
  return <div className="mt-3 space-y-2.5" aria-label="Personalized book recommendations">{card.recommendations.map((book, index) => {
    const expanded = expandedId === book.id;
    const added = cartIds.includes(book.id);
    return <article key={book.id} className="result-card overflow-hidden p-4"><div className="flex gap-3.5"><BookPlaceholder /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Match {index + 1}</p><button type="button" onClick={() => setExpandedId(expanded ? undefined : book.id)} className="mt-1 text-left font-heading text-lg font-semibold leading-5 underline-offset-4 hover:text-primary hover:underline" aria-expanded={expanded}>{book.title}</button><p className="mt-1 text-xs text-muted-foreground">{book.author}</p></div><span className="text-sm font-semibold">{currency(book.price)}</span></div><div className="mt-2 flex flex-wrap gap-1.5">{book.genres.slice(0, 3).map((genre) => <Badge key={genre} variant="secondary" className="rounded-full text-[10px]">{genre}</Badge>)}<Badge className="rounded-full bg-emerald-50 text-[10px] text-emerald-700 hover:bg-emerald-50">In stock</Badge></div><p className="mt-3 text-xs leading-5 text-[#514a42]"><strong>Why it fits:</strong> {book.reasoning || book.pitch || book.description}</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setExpandedId(expanded ? undefined : book.id)} aria-expanded={expanded}>{expanded ? 'Hide details' : 'View details'}</Button><Button type="button" size="sm" className={`rounded-full ${added ? 'bg-emerald-700 hover:bg-emerald-700' : ''}`} onClick={() => onAddToCart(book.id)} disabled={added}>{added ? <><Check className="size-3.5" /> Added</> : <><ShoppingCart className="size-3.5" /> Add to cart</>}</Button></div></div></div>
      {expanded && <div className="mt-4 border-t border-border/70 pt-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">About this book</p><p className="mt-2 text-xs leading-5 text-[#514a42]">{book.description || book.pitch || 'No additional description is available.'}</p>{book.moods.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Mood</span>{book.moods.map((mood) => <Badge key={mood} variant="outline" className="rounded-full text-[10px]">{mood}</Badge>)}</div>}<p className="mt-3 font-mono text-[10px] text-muted-foreground">Catalog ID · {book.productId}</p></div>}
    </article>;
  })}</div>;
}

function SupportCaseCard({ card, onAction }: { card: Extract<ContentCard, { kind: 'case_proposal' | 'case_confirmation' }>; onAction: (message: string) => void }) {
  const confirmed = card.kind === 'case_confirmation';
  return <div className="result-card mt-3 p-4"><div className="flex gap-3"><div className={`grid size-9 flex-none place-items-center rounded-full ${confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-[#f4e7df] text-primary'}`}>{confirmed ? <Check className="size-4" /> : <MessageSquareWarning className="size-4" />}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{confirmed ? 'Support case created' : 'Review before submitting'}</p><p className="mt-2 rounded-xl bg-[#f7f3ed] p-3 text-xs leading-5 text-[#514a42]">{card.summary}</p>{confirmed && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">Written to Airtable</p><p className="mt-1 font-mono text-xs font-semibold">{card.caseId}</p><a href={AIRTABLE_CASES_URL} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline underline-offset-2">Open Support Cases <ExternalLink className="size-3" /></a></div>}{!confirmed && <div className="mt-3 flex gap-2"><Button onClick={() => onAction('Yes, submit the complaint.')} size="sm" className="rounded-full px-3.5">Create support case</Button><Button onClick={() => onAction('No, cancel it.')} size="sm" variant="outline" className="rounded-full px-3.5">Cancel</Button></div>}</div></div></div>;
}

function ResultCard({ card, onAction, cartIds, onAddToCart }: { card: ContentCard; onAction: (message: string) => void; cartIds: string[]; onAddToCart: (id: string) => void }) {
  if (card.kind === 'order') return <OrderCard card={card} />;
  if (card.kind === 'recommendations') return <RecommendationCard card={card} cartIds={cartIds} onAddToCart={onAddToCart} />;
  if (card.kind === 'case_proposal' || card.kind === 'case_confirmation') return <SupportCaseCard card={card} onAction={onAction} />;
  return null;
}

type AopStepStatus = 'complete' | 'active' | 'pending' | 'blocked';
type AopStep = { label: string; detail: string; status: AopStepStatus };

function hasTrace(trace: TraceEvent[], title: string, status?: TraceEvent['status']) {
  return trace.some((event) => event.title === title && (!status || event.status === status));
}

function buildAopView(trace: TraceEvent[], state: SessionState, busy: boolean) {
  const pending = (label: string, detail: string): AopStep => ({ label, detail, status: 'pending' });
  const complete = (label: string, detail: string): AopStep => ({ label, detail, status: 'complete' });
  const active = (label: string, detail: string): AopStep => ({ label, detail, status: busy ? 'active' : 'active' });
  const blocked = (label: string, detail: string): AopStep => ({ label, detail, status: 'blocked' });

  if (!state.intent) {
    return {
      name: 'Awaiting procedure',
      entry: 'No customer intent has matched an entry condition yet.',
      status: busy ? 'Evaluating' : 'Listening',
      tools: [] as string[],
      steps: [
        complete('Customer context resolved', `${state.customerName || 'Signed-in customer'} is scoped to ${state.customerId || 'the active session'}`),
        active('Evaluate entry conditions', 'Listen for a supported customer request'),
        pending('Select an AOP', 'Choose the procedure that matches the customer’s intent'),
        pending('Follow the procedure', 'Clarify, retrieve data, or act only as the selected AOP allows'),
      ],
    };
  }

  if (state.intent === 'recommendation') {
    const awaitingPreference = state.awaiting === 'recommendation_preferences';
    const retrievalBlocked = hasTrace(trace, 'get_recommendations', 'blocked');
    const retrievalComplete = hasTrace(trace, 'get_recommendations', 'complete');
    return {
      name: 'Personalized book discovery',
      entry: 'Customer asks Bookly to recommend or find a book.',
      status: awaitingPreference ? 'Waiting for preference' : retrievalBlocked ? 'Stopped safely' : retrievalComplete ? 'Complete' : 'Running',
      tools: ['get_customer_profile', 'get_recommendations'],
      steps: [
        complete('Customer context resolved', `${state.customerName || 'Signed-in customer'} loaded from Airtable`),
        complete('Entry condition matched', 'Recommendation intent detected from the customer message'),
        complete('AOP selected', 'Personalized book discovery procedure is active'),
        awaitingPreference ? active('Clarify current preference', 'Ask for a genre or mood, or permission to use reading history') : complete('Preference established', 'Use the customer’s stated preference or approved reading context'),
        awaitingPreference ? pending('Apply eligibility guardrails', 'Require approved, display-eligible, in-stock recommendations') : complete('Eligibility guardrails passed', 'Filter for approved, display-eligible, in-stock matches'),
        awaitingPreference ? pending('Retrieve eligible matches', 'Call get_recommendations with customer-scoped context') : retrievalBlocked ? blocked('Recommendation tool stopped', 'No eligible match passed every required check') : complete('Eligible matches retrieved', 'Read customer-scoped recommendations from Airtable'),
        awaitingPreference || retrievalBlocked ? pending('Return grounded response', 'Present only results returned by the approved tool') : complete('Grounded response returned', 'Show eligible matches with details and a session cart action'),
      ],
    };
  }

  if (state.intent === 'support_case' || state.intent === 'human_support') {
    const collecting = state.awaiting === 'complaint_details';
    const confirming = state.awaiting === 'complaint_confirmation';
    const created = hasTrace(trace, 'create_support_case', 'complete');
    const writeBlocked = trace.some((event) => event.category === 'guardrail' && event.status === 'blocked');
    return {
      name: 'Support case creation',
      entry: 'Customer reports a problem or requests a specialist.',
      status: collecting ? 'Collecting details' : confirming ? 'Awaiting confirmation' : created ? 'Complete' : writeBlocked ? 'Stopped safely' : 'Running',
      tools: ['create_support_case'],
      steps: [
        complete('Customer context resolved', `${state.customerName || 'Signed-in customer'} linked to the active session`),
        complete('Entry condition matched', 'Complaint or human-support intent detected'),
        complete('AOP selected', 'Support case creation procedure is active'),
        collecting ? active('Collect case details', 'Ask what happened and what resolution the customer wants') : complete('Case details captured', 'Store a concise complaint draft in session memory'),
        collecting ? pending('Validate action guardrails', 'Check customer scope, write preconditions, and idempotency') : complete('Action guardrails validated', 'Prepare a customer-scoped, idempotent write'),
        collecting ? pending('Request confirmation', 'Show the draft before any durable action') : confirming ? active('Await explicit confirmation', 'Do not write until the customer clearly approves') : complete('Customer confirmation received', 'The customer explicitly authorized case creation'),
        collecting || confirming ? pending('Create Support Case', 'Call create_support_case only after confirmation') : writeBlocked ? blocked('Write stopped safely', 'A guardrail prevented an unsafe or incomplete action') : complete('Support Case created', 'Write the linked record to Airtable'),
        created ? complete('Return Case ID', 'Confirm the durable result without promising a refund') : pending('Return verified result', 'Report success only after Airtable confirms the write'),
      ],
    };
  }

  if (state.intent === 'order_status') {
    const found = hasTrace(trace, 'get_recent_orders', 'complete');
    return {
      name: 'Order status',
      entry: 'Customer asks about an order, package, or delivery.',
      status: found ? 'Complete' : 'Running',
      tools: ['get_recent_orders'],
      steps: [
        complete('Customer context resolved', 'Load the signed-in customer from Airtable'),
        complete('Entry condition matched', 'Order-status intent detected'),
        complete('AOP selected', 'Order status procedure is active'),
        found ? complete('Order retrieved', 'Read the most recent matching order from Airtable') : active('Retrieve order', 'Call get_recent_orders with customer-scoped context'),
        found ? complete('Grounded response returned', 'Report only the status returned by Airtable') : pending('Return grounded response', 'Do not guess when no trusted record is available'),
      ],
    };
  }

  const policyFound = hasTrace(trace, 'get_policy', 'complete');
  return {
    name: 'Policy answer',
    entry: 'Customer asks about an approved Bookly policy.',
    status: policyFound ? 'Complete' : 'Running',
    tools: ['get_policy'],
    steps: [
      complete('Customer context resolved', 'Load the signed-in customer from Airtable'),
      complete('Entry condition matched', 'Policy intent detected'),
      complete('AOP selected', 'Approved policy answer procedure is active'),
      policyFound ? complete('Approved policy retrieved', 'Read the matching active policy from Airtable') : active('Retrieve approved policy', 'Search the connected policy source'),
      policyFound ? complete('Grounded response returned', 'Answer from the approved policy record') : pending('Return grounded response', 'Escalate rather than invent missing policy'),
    ],
  };
}

function AopExecution({ trace, state, busy }: { trace: TraceEvent[]; state: SessionState; busy: boolean }) {
  const aop = buildAopView(trace, state, busy);
  const statusTone = aop.status === 'Stopped safely' ? 'text-red-300 border-red-400/20 bg-red-400/10' : aop.status === 'Complete' ? 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10' : 'text-amber-200 border-amber-300/20 bg-amber-300/10';
  return <aside className="inspector-shell lg:min-h-[calc(100vh-122px)]" aria-label="AOP execution"><div className="flex items-start justify-between border-b border-white/10 px-5 py-5"><div><p className="eyebrow-dark">Evaluator view</p><h2 className="mt-1 font-heading text-lg font-semibold tracking-tight">AOP Execution</h2></div><span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusTone}`}><span className={`size-1.5 rounded-full ${busy ? 'animate-pulse' : ''} ${aop.status === 'Stopped safely' ? 'bg-red-300' : aop.status === 'Complete' ? 'bg-emerald-300' : 'bg-amber-200'}`} /> {busy ? 'Running' : aop.status}</span></div><div className="inspector-scroll px-5 py-5">
    <section className="aop-summary"><div className="flex items-center gap-2"><Sparkles className="size-3.5 text-amber-200" /><p className="eyebrow-dark">Active procedure</p></div><h3 className="mt-2 text-sm font-semibold text-[#f3f4ef]">{aop.name}</h3><p className="mt-2 text-[11px] leading-[1.55] text-[#a6ada6]"><strong className="font-semibold text-[#d7dcd6]">Entry condition:</strong> {aop.entry}</p></section>
    <section className="mt-5"><div className="mb-3 flex items-center justify-between"><p className="eyebrow-dark">Procedure progress</p><span className="text-[9px] uppercase tracking-[0.11em] text-[#737b73]">Ordered execution</span></div><ol className="aop-timeline">{aop.steps.map((step, index) => <li key={`${aop.name}-${step.label}`} className={`aop-step aop-${step.status}`}><span className="aop-marker" aria-label={`${step.status}: step ${index + 1}`}>{step.status === 'complete' ? <Check className="size-3.5" /> : step.status === 'blocked' ? <AlertTriangle className="size-3.5" /> : step.status === 'active' ? <CircleDot className="size-3.5" /> : index + 1}</span><div><p>{step.label}</p><small>{step.detail}</small></div></li>)}</ol></section>
    <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-center justify-between"><p className="eyebrow-dark">Procedure controls</p><ShieldCheck className="size-3.5 text-[#869087]" /></div><dl className="mt-3 space-y-2.5 text-[11px]"><div className="flex items-start justify-between gap-3"><dt className="text-[#858e86]">Customer scope</dt><dd className="text-right font-mono text-[#d8ddd7]">{state.customerId || 'Pending'}</dd></div><div className="flex items-start justify-between gap-3"><dt className="text-[#858e86]">System of record</dt><dd className="text-right font-mono text-[#d8ddd7]">Airtable</dd></div><div><dt className="text-[#858e86]">Referenced tools</dt><dd className="mt-2 flex flex-wrap gap-1.5">{aop.tools.length ? aop.tools.map((tool) => <code key={tool} className="rounded-md bg-black/20 px-2 py-1 text-[9px] text-[#cbd2cb]">{tool}</code>) : <span className="text-[10px] text-[#7f8880]">Selected after an AOP matches</span>}</dd></div></dl></section>
    <p className="mt-4 flex items-start gap-2 text-[10px] leading-4 text-[#818a82]"><LockKeyhole className="mt-0.5 size-3 flex-none" /> The AOP guides the procedure. Server-side tools establish truth and control durable actions.</p>
  </div></aside>;
}

function WelcomeExperience({ onContinue }: { onContinue: (identifier: string) => Promise<void> }) {
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identifier.trim() || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await onContinue(identifier);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : 'Demo access is temporarily unavailable.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="welcome-page min-h-screen bg-background text-foreground">
    <header className="relative z-10 mx-auto flex h-20 max-w-[1180px] items-center justify-between px-5 sm:px-8">
      <div className="flex items-center gap-2.5"><span className="brand-mark"><BookOpen aria-hidden="true" /></span><span className="font-heading text-2xl font-semibold tracking-[-0.035em]">Bookly</span></div>
      <Badge variant="outline" className="rounded-full border-[#d7cfc2] bg-white/50 px-3 py-1.5 text-[11px] font-semibold text-[#625d55]"><ShieldCheck className="size-3.5 text-emerald-700" /> Demo access</Badge>
    </header>
    <section className="relative z-10 mx-auto grid min-h-[calc(100vh-128px)] max-w-[1180px] items-center gap-12 px-5 pb-16 pt-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_440px]">
      <div className="max-w-[610px]">
        <p className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><Sparkles className="size-4" /> Your personal bookstore concierge</p>
        <h1 className="font-heading text-5xl font-semibold leading-[.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">Welcome to<br />Bookly.</h1>
        <p className="mt-6 max-w-[540px] text-lg leading-8 text-[#625d55]">Find your next great read, track an order, or get help when something goes wrong—all in one conversation.</p>
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-[#514a42]"><span className="flex items-center gap-2"><Check className="size-4 text-emerald-700" /> Personalized discovery</span><span className="flex items-center gap-2"><Check className="size-4 text-emerald-700" /> Live Airtable data</span><span className="flex items-center gap-2"><Check className="size-4 text-emerald-700" /> Confirmed support actions</span></div>
      </div>
      <div className="welcome-card rounded-[28px] border border-[#d9d0c3] bg-[#fffdfa]/95 p-6 shadow-[0_28px_80px_rgba(64,47,28,.13)] sm:p-8">
        <div className="grid size-12 place-items-center rounded-2xl bg-[#f4e7df] text-primary"><UserRound className="size-5" /></div>
        <h2 className="mt-6 font-heading text-[28px] font-semibold tracking-[-0.035em]">Continue to your account</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Enter the full name or email associated with the demo customer.</p>
        <form onSubmit={submit} className="mt-6">
          <label htmlFor="demo-identifier" className="text-xs font-bold uppercase tracking-[0.1em] text-[#514a42]">Full name or email</label>
          <div className="relative mt-2"><Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="demo-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" disabled={busy} aria-invalid={Boolean(error)} aria-describedby={error ? 'demo-error demo-hint' : 'demo-hint'} placeholder="Enter your full name or email" className="h-13 rounded-2xl border-[#d8d0c4] bg-white pl-11 pr-4 text-[15px] shadow-sm focus-visible:border-primary/60" /></div>
          {error && <p id="demo-error" role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-medium leading-5 text-red-700"><AlertTriangle className="mt-0.5 size-3.5 flex-none" /> {error}</p>}
          <Button type="submit" disabled={busy || !identifier.trim()} className="mt-4 h-12 w-full rounded-2xl text-sm font-semibold shadow-[0_9px_24px_rgba(191,74,47,.18)]">{busy ? 'Verifying…' : <>Continue to Bookly <ArrowRight className="size-4" /></>}</Button>
        </form>
        <div id="demo-hint" className="mt-5 rounded-2xl border border-[#e2d9cc] bg-[#f6f1e9] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Interview demo</p><p className="mt-1 text-sm text-[#514a42]">Use <button type="button" onClick={() => setIdentifier('Mara Finch')} className="font-semibold text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-primary">Mara Finch</button> to enter the experience.</p></div>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[10px] text-muted-foreground"><LockKeyhole className="size-3" /> Synthetic customer data · No real account access</p>
      </div>
    </section>
  </main>;
}

export function SupportExperience() {
  const [signedIn, setSignedIn] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [session, setSession] = useState<SessionState>(initialState);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [cartIds, setCartIds] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const hasConversation = messages.length > 1;
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, busy]);

  async function sendMessage(raw: string) {
    const content = raw.trim();
    if (!content || busy) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content };
    const prior = messages.map(({ role, content: messageContent }) => ({ role, content: messageContent }));
    setMessages((current) => [...current, userMessage]); setInput(''); setBusy(true); setError(undefined);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: content, state: session, mode: 'demo', history: prior }) });
      const result = await response.json() as ChatResponse | { error?: string };
      if (!response.ok || !('message' in result)) throw new Error('error' in result ? result.error : undefined);
      setSession(result.state); setTrace(result.trace); setMessages((current) => [...current, result.message]);
    } catch (caught) { setError(caught instanceof Error && caught.message ? caught.message : 'The agent hit a connection problem. Nothing was submitted.'); } finally { setBusy(false); }
  }

  function submit(event: SyntheticEvent<HTMLFormElement>) { event.preventDefault(); void sendMessage(input); }
  function addToCart(id: string) { setCartIds((current) => current.includes(id) ? current : [...current, id]); }
  function reset() { setMessages([initialMessage]); setSession(initialState); setTrace([]); setInput(''); setError(undefined); setCartIds([]); }

  async function verifyDemoCustomer(identifier: string) {
    const response = await fetch('/api/demo-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier }) });
    const result = await response.json() as { customer?: { id: string; name: string }; error?: string };
    if (!response.ok || !result.customer) throw new Error(result.error || 'Demo access is temporarily unavailable.');
    reset();
    setSession((current) => ({ ...current, customerId: result.customer?.id, customerName: result.customer?.name }));
    setSignedIn(true);
  }

  function signOut() {
    reset();
    setSignedIn(false);
  }

  if (!signedIn) return <WelcomeExperience onContinue={verifyDemoCustomer} />;

  return <main className="min-h-screen bg-background text-foreground"><header className="border-b border-border/80 bg-background/95 backdrop-blur"><div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8"><div className="flex items-center gap-2.5"><span className="brand-mark"><BookOpen aria-hidden="true" /></span><span className="font-heading text-xl font-semibold tracking-[-0.03em]">Bookly</span></div><nav className="hidden items-center gap-7 text-sm text-muted-foreground sm:flex" aria-label="Primary navigation"><a href="#support" className="text-foreground">Concierge</a><span>My orders</span><button onClick={signOut} className="flex items-center gap-1.5 text-foreground hover:text-primary" type="button" title="Sign out of demo"><span className="size-2 rounded-full bg-emerald-500" /> Mara Finch <LogOut className="size-3.5" /></button></nav><div className="flex items-center gap-2"><span className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-white/60 px-3 text-xs font-semibold" aria-live="polite"><ShoppingCart className="size-3.5" /> Cart {cartIds.length}</span><Button onClick={reset} variant="outline" size="sm" className="rounded-full bg-white/50"><RefreshCcw className="size-3.5" /> <span className="hidden sm:inline">Reset demo</span></Button><Button onClick={signOut} variant="ghost" size="icon-sm" className="rounded-full sm:hidden" aria-label="Sign out of demo"><LogOut className="size-3.5" /></Button></div></div></header>
    <section id="support" className="mx-auto grid max-w-[1440px] gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-7"><article className="support-shell flex min-h-[calc(100vh-122px)] flex-col overflow-hidden"><div className="border-b border-border/75 px-5 py-4 sm:px-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="mb-1 flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.12)]" /><span className="text-xs font-medium text-muted-foreground">Signed in as Mara · Live Airtable data</span></div><h1 className="font-heading text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">Bookly Concierge</h1></div><Badge variant="secondary" className="h-7 gap-1.5 rounded-full bg-[#f1eee7] px-3 text-[#625d55]"><Sparkles className="size-3.5" /> Support + discovery</Badge></div></div>
      <div className="chat-scroll flex-1 px-5 py-6 sm:px-8" aria-live="polite"><div className="mx-auto w-full max-w-[760px] space-y-6">{messages.map((message) => <div key={message.id} className={`flex gap-3.5 ${message.role === 'user' ? 'justify-end' : ''}`}>{message.role === 'assistant' && <div className="assistant-avatar"><BookOpen className="size-4" /></div>}<div className={`${message.role === 'user' ? 'max-w-[78%]' : 'max-w-[650px]'} min-w-0`}><p className={`mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground ${message.role === 'user' ? 'text-right' : ''}`}>{message.role === 'assistant' ? 'Bookly' : 'You'}</p><div className={message.role === 'assistant' ? 'assistant-bubble' : 'user-bubble'}><p className="whitespace-pre-wrap text-[15px] leading-6">{message.content}</p></div>{message.card && <ResultCard card={message.card} onAction={sendMessage} cartIds={cartIds} onAddToCart={addToCart} />}</div>{message.role === 'user' && <div className="user-avatar"><UserRound className="size-4" /></div>}</div>)}{busy && <div className="flex gap-3.5"><div className="assistant-avatar"><BookOpen className="size-4" /></div><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Bookly</p><div className="assistant-bubble flex h-12 items-center gap-1.5"><span className="typing-dot" /><span className="typing-dot [animation-delay:120ms]" /><span className="typing-dot [animation-delay:240ms]" /></div></div></div>}<div ref={endRef} /></div></div>
      <div className="border-t border-border/70 bg-[#fcfaf6]/95 px-5 py-4 sm:px-8"><div className="mx-auto w-full max-w-[760px]">{!hasConversation && <div className="mb-3 grid gap-2 sm:grid-cols-3" aria-label="Suggested questions">{starters.map(({ icon: Icon, label, prompt }) => <button key={label} onClick={() => void sendMessage(prompt)} className="starter-card" type="button"><Icon className="size-4 text-primary" /><span>{label}</span></button>)}</div>}{error && <div role="alert" className="mb-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700"><AlertTriangle className="size-4" /> {error}</div>}<form onSubmit={submit}><InputGroup className="h-14 rounded-2xl border-[#d8d2c7] bg-white pl-2 shadow-[0_8px_28px_rgba(46,39,29,.07)] focus-within:border-primary/50"><InputGroupInput value={input} onChange={(event) => setInput(event.target.value)} disabled={busy} aria-label="Message Bookly" placeholder="Ask about a book, order, or problem…" className="h-full text-[15px]" autoComplete="off" /><InputGroupAddon align="inline-end" className="pr-2"><InputGroupButton disabled={busy || !input.trim()} aria-label="Send message" type="submit" size="icon-sm" className="size-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"><ArrowUp className="size-4" /></InputGroupButton></InputGroupAddon></InputGroup></form><div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground"><p className="flex items-center gap-1.5"><ShieldCheck className="size-3" /> Writes require confirmation and are idempotent.</p><p className="font-mono">Demo customer · CUS-0001</p></div></div></div>
    </article><AopExecution trace={trace} state={session} busy={busy} /></section><footer className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 pb-7 text-[11px] text-muted-foreground sm:px-8"><p>Bookly is fictional. All customer and commerce data is synthetic.</p><p className="flex items-center gap-3"><span className="flex items-center gap-1"><Code2 className="size-3" /> TypeScript</span><span className="flex items-center gap-1"><Database className="size-3" /> Airtable system of record</span><span className="flex items-center gap-1"><ShieldCheck className="size-3" /> Server-side tools</span></p></footer></main>;
}
