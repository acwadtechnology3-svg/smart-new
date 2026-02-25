export const getDriverImageUrl = (relativePath?: string | null) => {
  if (!relativePath) return undefined;

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const imageBaseEnv = import.meta.env.VITE_DRIVER_IMAGE_BASE as string | undefined;

  // If VITE_DRIVER_IMAGE_BASE is set, use it directly; otherwise strip trailing /api
  const base = imageBaseEnv || apiBase.replace(/\/api$/, '');

  // Ensure single slash between base and path
  // normalize windows-style paths
  const normalizedPath = (relativePath.startsWith('/') ? relativePath.slice(1) : relativePath).replace(/\\/g, '/');
  return `${base}/${normalizedPath}`;
};
