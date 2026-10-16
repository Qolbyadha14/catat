export function isNameUnique(
  name: string,
  existingItems: { id: string; name: string; isArchived?: boolean }[],
  currentId?: string
): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  return !existingItems.some(
    (item) => !item.isArchived && item.id !== currentId && item.name.trim().toLowerCase() === normalized
  );
}
