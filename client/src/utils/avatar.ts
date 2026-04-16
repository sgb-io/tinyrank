export function generateAvatar(seed: string, size = 32): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#82E0AA', '#F8C471', '#EC7063', '#5DADE2', '#A3E4D7',
  ];
  
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  
  const colorIndex = Math.abs(hash) % colors.length;
  const color = colors[colorIndex];
  const initial = seed.charAt(0).toUpperCase();
  
  const secondHash = Math.abs(hash >> 4) % colors.length;
  const bgColor = colors[secondHash] + '33';
  
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${bgColor}"/><circle cx="${size/2}" cy="${size/2}" r="${size/2-2}" fill="${color}"/><text x="${size/2}" y="${size/2 + size*0.12}" text-anchor="middle" font-size="${size * 0.45}" font-family="Arial, sans-serif" font-weight="bold" fill="white">${initial}</text></svg>`)}`;
}
