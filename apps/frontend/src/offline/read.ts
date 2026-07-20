// Offline okuma: API'yi dene, kopukse son snapshot cache'inden dondur. OFFLINE_DESIGN.md §4.3, §7.2
import { api } from '../lib/api';
import { cachedSnapshot } from './engine';
import type { Category, Hall, Order, Product, Table } from '../lib/types';

interface Snapshot {
  halls: Hall[];
  tables: Table[];
  orders: Order[];
  categories: Category[];
  products: Product[];
}

async function snap(): Promise<Snapshot | undefined> {
  return cachedSnapshot<Snapshot>();
}

export async function readHalls(): Promise<Hall[]> {
  try {
    return await api<Hall[]>('/halls');
  } catch {
    return (await snap())?.halls ?? [];
  }
}

export async function readTables(): Promise<Table[]> {
  try {
    return await api<Table[]>('/tables?active=true');
  } catch {
    return (await snap())?.tables ?? [];
  }
}

export async function readOpenOrders(): Promise<Order[]> {
  try {
    return await api<Order[]>('/orders?open=true');
  } catch {
    return ((await snap())?.orders ?? []).filter((o) => o.status === 'open');
  }
}

export async function readHeldOrders(): Promise<Order[]> {
  try {
    return await api<Order[]>('/orders?status=held');
  } catch {
    return ((await snap())?.orders ?? []).filter((o) => o.status === 'held');
  }
}

export async function readCategories(): Promise<Category[]> {
  try {
    return await api<Category[]>('/categories');
  } catch {
    return (await snap())?.categories ?? [];
  }
}

export async function readProducts(): Promise<Product[]> {
  try {
    return await api<Product[]>('/products?active=true');
  } catch {
    return (await snap())?.products ?? [];
  }
}
