export type MessageRole = 'user' | 'assistant';

export type OrderItem = {
  id: string;
  title: string;
  author: string;
  price: number;
  coverUrl?: string;
  returnable: boolean;
};

export type CustomerProfile = {
  recordId: string;
  id: string;
  name: string;
  email: string;
  favoriteGenres: string[];
  readingProfile: string;
  summary: string;
  recommendationGate: string;
  orderRecordIds: string[];
};

export type Recommendation = {
  id: string;
  productId: string;
  title: string;
  author: string;
  genres: string[];
  moods: string[];
  description: string;
  pitch: string;
  price: number;
  stock: number;
  reasoning: string;
  confidence: number;
  rank: number;
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

export type RecommendationCard = {
  kind: 'recommendations';
  preference: string;
  recommendations: Recommendation[];
};

export type SupportCaseCard = {
  kind: 'case_proposal' | 'case_confirmation';
  summary: string;
  caseId?: string;
  airtableRecordId?: string;
};

export type ContentCard = OrderCard | ReturnCard | RecommendationCard | SupportCaseCard;

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  card?: ContentCard;
};

export type SessionState = {
  intent?: 'order_status' | 'return_request' | 'policy_question' | 'human_support' | 'recommendation' | 'support_case';
  customerId?: string;
  customerName?: string;
  dataSource?: 'airtable';
  verifiedEmail?: string;
  activeOrderId?: string;
  activeOrderRecordId?: string;
  selectedItemId?: string;
  returnReason?: string;
  pendingComplaint?: string;
  complaintIdempotencyKey?: string;
  awaiting?: 'identity' | 'item' | 'reason' | 'confirmation' | 'recommendation_preferences' | 'complaint_details' | 'complaint_confirmation';
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
  engine: 'deterministic' | 'openai' | 'airtable';
};
