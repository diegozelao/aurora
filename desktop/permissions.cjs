const trusted = (url) => { try { return new URL(url).origin === 'https://test.ddtech.cloud'; } catch { return false; } };
function check(permission, origin) {
  return trusted(origin) && ['media', 'display-capture', 'fullscreen'].includes(permission);
}
function request(permission, origin, details = {}, approvedDevices = false) {
  if (!trusted(origin)) return false;
  // Electron 40 reports display capture as media with no device mediaTypes.
  // Device capture requires an additional user confirmation in the main process.
  if (permission === 'media') return Array.isArray(details.mediaTypes) && (details.mediaTypes.length === 0 || (approvedDevices && details.mediaTypes.every(type => ['audio', 'video'].includes(type))));
  return ['display-capture', 'fullscreen', 'clipboard-sanitized-write'].includes(permission);
}
module.exports = { check, request };
