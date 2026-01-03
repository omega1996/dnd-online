/**
 * Builds a full URL for API requests
 * @param {string} serverUrl - Base server URL (empty string for relative paths)
 * @param {string} path - API path (should start with /)
 * @returns {string} Full URL
 */
export function buildApiUrl(serverUrl, path) {
  if (!serverUrl) {
    // Use relative path (nginx will proxy)
    return path.startsWith('/') ? path : `/${path}`;
  }
  // Normalize serverUrl: remove trailing slash
  const normalizedServerUrl = serverUrl.replace(/\/+$/, '');
  // Normalize path: ensure it starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  // Use absolute URL
  return `${normalizedServerUrl}${normalizedPath}`;
}

/**
 * Builds a full URL for static assets (images, etc.)
 * Always uses relative paths so nginx can proxy them correctly
 * Also normalizes old URLs that might contain localhost or http://
 * @param {string} serverUrl - Base server URL (not used for assets, kept for compatibility)
 * @param {string} assetPath - Asset path (should start with /)
 * @returns {string} Relative URL (nginx will proxy to server)
 */
export function buildAssetUrl(serverUrl, assetPath) {
  // If assetPath is already a full URL (contains ://), normalize it to relative path
  if (assetPath && assetPath.includes('://')) {
    // Extract path from full URL (e.g., http://localhost:3001/uploads/file.jpg -> /uploads/file.jpg)
    try {
      const url = new URL(assetPath);
      assetPath = url.pathname;
    } catch (e) {
      // If URL parsing fails, try to extract path manually
      const match = assetPath.match(/\/uploads\/[^\/]+/);
      if (match) {
        assetPath = match[0];
      }
    }
  }
  
  // Always use relative paths for assets so nginx can proxy them
  // This ensures files are always accessible regardless of server URL configuration
  return assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
}
