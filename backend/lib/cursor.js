/**
 * Cursor-based pagination utilities
 * Cursors are base64-encoded strings containing sort field value and ID
 */


export function encodeCursor(sortValue, id) {
  const value = sortValue instanceof Date ? sortValue.toISOString() : String(sortValue);
  const cursor = `${value}:${id}`;
  return Buffer.from(cursor).toString('base64');
}

export function decodeCursor(cursor) {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const [sortValue, id] = decoded.split(':');
    
    if (!sortValue || !id) {
      return null;
    }
    
    const dateValue = new Date(sortValue);
    const isDate = !isNaN(dateValue.getTime()) && sortValue.includes('T');
    
    return {
      sortValue: isDate ? dateValue : sortValue,
      id,
    };
  } catch (error) {
    return null;
  }
}

export function createCursorFromEntity(entity, sortBy = 'createdAt', idField = 'id') {
  const sortValue = entity[sortBy];
  const id = entity[idField];
  return encodeCursor(sortValue, id);
}

