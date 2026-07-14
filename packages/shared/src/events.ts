/**
 * Domain Event sozlesmesi — backend+frontend (Faz 2 WebSocket/sync) ortak kaynak.
 *
 * Kural: event adi `entity.action` ( or. 'order.created'). Her event ayni ZARF'i tasir;
 * yalnizca `payload` degisir. Yayinla/dinle mekanizmasi: EVENT_BUS.md.
 * Event katalogu ve dinleyiciler: DOMAIN_EVENTS.md.
 */
import { newId } from './id.js';

/** Tum domain event'lerin ortak zarfi. */
export interface DomainEvent<TName extends string = string, TPayload = unknown> {
  /** Bu event ornegi icin benzersiz ULID (idempotent isleme + izleme). */
  eventId: string;
  /** `entity.action` ( or. 'product.created'). */
  name: TName;
  /** Olusma ani (ISO 8601). */
  occurredAt: string;
  /** Kiracı/sube izolasyonu. */
  branchId: string;
  /** Islemi yapan kullanici (varsa). */
  actorId?: string;
  /** Kaynak cihaz (varsa; Waiter tableti vb.). */
  deviceId?: string;
  /** Iliskili islem zincirini baglar (or. requestId / clientOpId). */
  correlationId?: string;
  /** Event'e ozel veri. */
  payload: TPayload;
}

/** `createDomainEvent` icin ust veri (zarfi doldurur). */
export interface DomainEventMeta {
  branchId: string;
  actorId?: string;
  deviceId?: string;
  correlationId?: string;
}

/**
 * Zarfi standart sekilde uretir: eventId (ULID) + occurredAt otomatik doldurulur.
 * Yayincilar domain event'i her zaman bununla olusturur -> zarf tutarli kalir.
 */
export function createDomainEvent<TName extends string, TPayload>(
  name: TName,
  payload: TPayload,
  meta: DomainEventMeta,
): DomainEvent<TName, TPayload> {
  return {
    eventId: newId(),
    name,
    occurredAt: new Date().toISOString(),
    branchId: meta.branchId,
    ...(meta.actorId ? { actorId: meta.actorId } : {}),
    ...(meta.deviceId ? { deviceId: meta.deviceId } : {}),
    ...(meta.correlationId ? { correlationId: meta.correlationId } : {}),
    payload,
  };
}

/**
 * Bilinen domain event adlari. Modul geldikce buraya eklenir (DOMAIN_EVENTS.md ile senkron).
 * Su an: katalog (ilk uretici). Sipariş/ödeme/kasa vb. ilgili modul inşa edilirken eklenecek.
 */
export const DomainEventName = {
  ProductCreated: 'product.created',
  ProductUpdated: 'product.updated',
  ProductDeleted: 'product.deleted',
} as const;

export type DomainEventName = (typeof DomainEventName)[keyof typeof DomainEventName];

// --- Katalog event payload'lari ---
export interface ProductEventPayload {
  productId: string;
  name: string;
  categoryId: string;
  salePrice: number; // kurus
}
