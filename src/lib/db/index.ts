/**
 * Database barrel exports - maintains backward compatibility
 */

// Client utilities
export { getDb, initDb, generateId } from './client';

// Conversation types and functions
export type { DbMessage, Conversation } from './conversations';
export {
  createConversation,
  getConversations,
  getConversation,
  updateConversation,
  deleteConversation,
  saveMessage,
  hydrateMessage,
} from './conversations';

// Comparison types and functions
export type { DbPinnedComparison } from './comparisons';
export {
  getPinnedComparisons,
  getPinnedComparison,
  createPinnedComparison,
  updatePinnedComparison,
  deletePinnedComparison,
} from './comparisons';
