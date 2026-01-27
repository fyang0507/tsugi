import { getDb, generateId } from './client';

export interface DbPinnedComparison {
  id: string;
  name: string;
  left_conversation_id: string;
  right_conversation_id: string;
  left_title: string;
  right_title: string;
  created_at: number;
}

/**
 * Get all pinned comparisons
 */
export async function getPinnedComparisons(): Promise<DbPinnedComparison[]> {
  const client = getDb();
  const result = await client.execute(`
    SELECT id, name, left_conversation_id, right_conversation_id,
           left_title, right_title, created_at
    FROM pinned_comparisons
    ORDER BY created_at DESC
  `);

  return result.rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    left_conversation_id: row.left_conversation_id as string,
    right_conversation_id: row.right_conversation_id as string,
    left_title: row.left_title as string,
    right_title: row.right_title as string,
    created_at: row.created_at as number,
  }));
}

/**
 * Get a single pinned comparison by ID
 */
export async function getPinnedComparison(id: string): Promise<DbPinnedComparison | null> {
  const client = getDb();
  const result = await client.execute({
    sql: `SELECT id, name, left_conversation_id, right_conversation_id,
                 left_title, right_title, created_at
          FROM pinned_comparisons WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id as string,
    name: row.name as string,
    left_conversation_id: row.left_conversation_id as string,
    right_conversation_id: row.right_conversation_id as string,
    left_title: row.left_title as string,
    right_title: row.right_title as string,
    created_at: row.created_at as number,
  };
}

/**
 * Create a new pinned comparison
 */
export async function createPinnedComparison(data: {
  name: string;
  leftConversationId: string;
  rightConversationId: string;
  leftTitle: string;
  rightTitle: string;
}): Promise<DbPinnedComparison> {
  const client = getDb();
  const id = generateId();
  const now = Date.now();

  await client.execute({
    sql: `INSERT INTO pinned_comparisons
          (id, name, left_conversation_id, right_conversation_id, left_title, right_title, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, data.name, data.leftConversationId, data.rightConversationId,
           data.leftTitle, data.rightTitle, now],
  });

  return {
    id,
    name: data.name,
    left_conversation_id: data.leftConversationId,
    right_conversation_id: data.rightConversationId,
    left_title: data.leftTitle,
    right_title: data.rightTitle,
    created_at: now,
  };
}

/**
 * Update pinned comparison name
 */
export async function updatePinnedComparison(id: string, name: string): Promise<void> {
  const client = getDb();
  await client.execute({
    sql: `UPDATE pinned_comparisons SET name = ? WHERE id = ?`,
    args: [name, id],
  });
}

/**
 * Delete a pinned comparison
 */
export async function deletePinnedComparison(id: string): Promise<void> {
  const client = getDb();
  await client.execute({
    sql: `DELETE FROM pinned_comparisons WHERE id = ?`,
    args: [id],
  });
}
