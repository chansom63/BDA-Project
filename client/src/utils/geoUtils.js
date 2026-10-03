export function formatAltitude(altitudeFt) {
  if (!altitudeFt) return 'FL000';
  if (altitudeFt >= 18000) {
    return `FL${Math.round(altitudeFt / 100)}`;
  }
  return `${altitudeFt.toLocaleString()} ft`;
}

export function getAltitudeColor(altitudeFt) {
  if (altitudeFt >= 38000) return '#a855f7'; // High cruise (Purple)
  if (altitudeFt >= 30000) return '#06b6d4'; // Standard cruise (Cyan)
  if (altitudeFt >= 20000) return '#10b981'; // Mid cruise (Green)
  if (altitudeFt >= 10000) return '#f59e0b'; // Transition (Amber)
  return '#ef4444';                           // Low altitude / climb / descend (Red)
}

export function getSquawkBadge(squawk) {
  switch (squawk) {
    case '7700':
      return { label: '7700 MAYDAY', color: '#ef4444', isEmergency: true };
    case '7600':
      return { label: '7600 RADIO LOSS', color: '#f59e0b', isEmergency: true };
    case '7500':
      return { label: '7500 HIJACK', color: '#dc2626', isEmergency: true };
    default:
      return { label: `SQ ${squawk || '1200'}`, color: '#10b981', isEmergency: false };
  }
}
