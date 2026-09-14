export type MessageRole = 'user' | 'assistant';

export type OrderItem = {
  id: string;
  title: string;
  author: string;
  price: number;
  coverUrl: string;
  returnable: boolean;
};

export type Order = {
  id: string;
  email: string;
  status: 'processing' | 'in_transit' | 'delivered';
  statusLabel: string;
  placedAt: string;
  eta?: string;
  deliveredAt?: string;
  carrier?: string;
  trackingSuffix?: string;
  items: OrderItem[];
};

export type ReturnRecord = {
  id: string;
  orderId: string;
  itemId: string;
  reason: string;
  amount: number;
  status: 'approved';
};

export type OrderCard = {
  kind: 'order';
  order: Order;
};

export type ReturnCard = {
  kind: 'return_proposal' | 'return_confirmation';
  orderId: string;
  item: OrderItem;
  reason: string;
  amount: number;
  returnId?: string;
};

export type ContentCard = OrderCard | ReturnCard;

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  card?: ContentCard;
};

export type SessionState = {
  intent?: 'order_status' | 'return_request' | 'policy_question' | 'human_support';
  verifiedEmail?: string;
  activeOrderId?: string;
  selectedItemId?: string;
  returnReason?: string;
  awaiting?: 'identity' | 'item' | 'reason' | 'confirmation';
  returnRecords: ReturnRecord[];
  attempts: number;
};

export type TraceEvent = {
  id: string;
  category: 'intent' | 'memory' | 'tool' | 'guardrail' | 'response';
  title: string;
  summary: string;
  detail?: string;
  status: 'complete' | 'waiting' | 'blocked';
};

export type ChatRequest = {
  message: string;
  state: SessionState;
  mode?: 'demo' | 'live';
  history?: Array<Pick<ChatMessage, 'role' | 'content'>>;
};

export type ChatResponse = {
  message: ChatMessage;
  state: SessionState;
  trace: TraceEvent[];
  engine: 'deterministic' | 'openai';
};
