import type { Order } from './types.ts';

export const orders: Order[] = [
  {
    id: 'B-1042',
    email: 'michael@example.com',
    status: 'in_transit',
    statusLabel: 'In transit',
    placedAt: 'September 8',
    eta: 'Tuesday, September 15 · 2–6 PM',
    carrier: 'UPS',
    trackingSuffix: '4821',
    items: [
      {
        id: 'BK-201',
        title: 'The Left Hand of Darkness',
        author: 'Ursula K. Le Guin',
        price: 16.99,
        coverUrl: '/covers/left-hand-of-darkness.jpg',
        returnable: true,
      },
      {
        id: 'BK-202',
        title: 'Tomorrow, and Tomorrow, and Tomorrow',
        author: 'Gabrielle Zevin',
        price: 18.0,
        coverUrl: '/covers/tomorrow.jpg',
        returnable: true,
      },
    ],
  },
  {
    id: 'B-2088',
    email: 'michael@example.com',
    status: 'delivered',
    statusLabel: 'Delivered',
    placedAt: 'August 31',
    deliveredAt: 'September 5 · Front door',
    carrier: 'USPS',
    trackingSuffix: '1904',
    items: [
      {
        id: 'BK-301',
        title: 'The Creative Act',
        author: 'Rick Rubin',
        price: 24.99,
        coverUrl: '/covers/creative-act.jpg',
        returnable: true,
      },
    ],
  },
  {
    id: 'B-3001',
    email: 'reader@example.com',
    status: 'delivered',
    statusLabel: 'Delivered',
    placedAt: 'July 2',
    deliveredAt: 'July 8 · Mailroom',
    carrier: 'UPS',
    trackingSuffix: '7710',
    items: [
      {
        id: 'BK-401',
        title: 'Pachinko',
        author: 'Min Jin Lee',
        price: 17.99,
        coverUrl: '/covers/pachinko.jpg',
        returnable: false,
      },
    ],
  },
];

export const policies = {
  shipping:
    'Standard shipping arrives in 3–5 business days. Expedited shipping arrives in 1–2 business days. Tracking becomes available after the order leaves our warehouse.',
  returns:
    'Most books may be returned within 30 days of delivery in their original condition. Damaged or incorrect items qualify for a prepaid return label. Final-sale items are not eligible.',
  password:
    'Password reset links expire after 30 minutes. For security, Bookly never asks customers to share a password or one-time code with support.',
};
