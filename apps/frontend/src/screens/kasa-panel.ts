// Aktif oturum query durumundan hangi panelin gosterilecegine karar ver.
// 404 (oturum kapali/yok) -> acilis formu; react-query hata aninda eski
// session.data'yi tuttugu icin 404 bu bayati veriyi EZMELI (yoksa kapaniste
// hala "Beklenen Nakit" gorunur). Bu karar KasaScreen'in kritik bug'iydi.
export function pickKasaPanel(q: {
  isError: boolean;
  errorStatus?: number | undefined;
  hasData: boolean;
}): 'open' | 'active' | null {
  if (q.isError && q.errorStatus === 404) return 'open';
  if (q.hasData) return 'active';
  return null;
}
