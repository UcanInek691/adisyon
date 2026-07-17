// Backend yanit sekilleri (Faz-1 kullanilan alt kume).
export interface Hall {
  id: string;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface Table {
  id: string;
  hallId: string;
  name: string;
  status: string; // empty | occupied | ...
  seats?: number;
  isActive?: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  productNameSnapshot: string;
  quantity: number; // milis
  lineTotal: number; // kurus
  status: string; // pending | sent | ...
}

export interface Discount {
  id: string;
  type: string; // percent | amount
  value: number; // percent: yuzde; amount: kurus
  amount: number; // hesaplanmis indirim (kurus)
  reason?: string | null;
}

export interface Order {
  id: string;
  orderNo: string;
  tableId: string | null;
  status: string; // open | held | completed | cancelled
  grandTotal: number; // kurus
  subtotal: number;
  discountTotal: number;
  items: OrderItem[];
  discounts?: Discount[];
}

export interface Payment {
  id: string;
  amount: number; // kurus (+/-; iade negatif)
  method: string; // cash | card | transfer | qr | debt
}

export interface CashTransaction {
  id: string;
  type: string; // opening | sale | refund | payout | income | expense | adjustment | closing
  amount: number; // kurus (+/-)
  method: string;
  note?: string | null;
  createdAt: string;
}

export interface CashSession {
  id: string;
  openingFloat: number; // kurus
  status: string; // open | closed
  businessDay: string;
  openedAt: string;
  transactions: CashTransaction[];
  countedAmount?: number; // kapanista
  expectedAmount?: number;
  difference?: number; // sayilan - beklenen
}

export interface DebtTransaction {
  id: string;
  type: string; // debt_add | payment
  amount: number; // kurus (+borc, -tahsilat)
  note?: string | null;
  occurredAt: string;
}

export interface DebtAccount {
  id: string;
  balance: number; // kurus (guncel borc)
  transactions?: DebtTransaction[];
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
  debtAccount?: DebtAccount | null;
}

export interface Category {
  id: string;
  name: string;
  sortOrder?: number;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  salePrice: number; // kurus
  unitId?: string;
  taxId?: string;
  isActive?: boolean;
  isFavorite?: boolean;
}

export interface Unit {
  id: string;
  name: string;
  abbreviation?: string | null;
}

export interface Tax {
  id: string;
  name: string;
  ratePermille: number; // binde: %10 -> 100
  isDefault?: boolean;
}
