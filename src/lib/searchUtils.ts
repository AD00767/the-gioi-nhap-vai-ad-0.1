import {
  getCharacterById,
  getPromptById,
  getUserById,
  getUserByNumericId,
  getAllCharacters,
  getAllPrompts,
  getAllUsers,
} from './localDb';

export interface IdSearchResult {
  isIdQuery: boolean;
  numericId?: string;
  typeHint?: string;
  error?: string;
}

export function parseIdQuery(queryText: string): IdSearchResult {
  const trimmed = queryText.trim();
  if (!trimmed) {
    return { isIdQuery: false };
  }

  const prefixes = [
    /^(character|prompt|creator|user|id|mã|mã số)s?[\/\s-:]+/i,
    /^(character|prompt|creator|user|id|mã|mã số)s?$/i
  ];

  let hasPrefix = false;
  let typeHint = '';

  for (const regex of prefixes) {
    const match = trimmed.match(regex);
    if (match) {
      hasPrefix = true;
      if (match[1]) {
        const word = match[1].toLowerCase();
        if (word === 'character') typeHint = 'character';
        else if (word === 'prompt') typeHint = 'prompt';
        else if (word === 'creator' || word === 'user') typeHint = 'creator';
        else typeHint = 'id';
      }
      break;
    }
  }

  const exact9Digits = trimmed.match(/\b([0-9]{9})\b/);
  if (exact9Digits) {
    const numId = exact9Digits[1];
    let foundHint = typeHint;
    if (!foundHint) {
      if (/character/i.test(trimmed)) foundHint = 'character';
      else if (/prompt/i.test(trimmed)) foundHint = 'prompt';
      else if (/(creator|user|tác giả)/i.test(trimmed)) foundHint = 'creator';
    }
    return {
      isIdQuery: true,
      numericId: numId,
      typeHint: foundHint || undefined
    };
  }

  const anyDigitsMatch = trimmed.match(/\b([0-9]+)\b/);
  if (anyDigitsMatch) {
    const digits = anyDigitsMatch[1];
    if (digits.length !== 9 && (hasPrefix || /^[0-9]+$/.test(trimmed))) {
      return {
        isIdQuery: true,
        error: "Mã ID không đúng định dạng (ID phải có đúng 9 chữ số)."
      };
    }
  }

  if (hasPrefix && !anyDigitsMatch) {
    return {
      isIdQuery: true,
      error: "Mã ID bị thiếu trong từ khóa tìm kiếm."
    };
  }

  if (/^(id|mã|mã số)$/i.test(trimmed)) {
    return {
      isIdQuery: true,
      error: "Mã ID bị thiếu trong từ khóa tìm kiếm."
    };
  }

  return { isIdQuery: false };
}

export interface ExactIdLookupResult {
  found: boolean;
  type: 'character' | 'prompt' | 'creator' | 'user';
  id: string;
  numericId: string;
  path: string;
  error?: string;
  result?: any;
}

export async function lookupIdInFirebase(numericId: string, typeHint?: string): Promise<ExactIdLookupResult | null> {
  // Check characters
  if (!typeHint || typeHint === 'character') {
    const chars = getAllCharacters();
    const match = chars.find(c => String(c.numericId) === numericId || c.id === numericId);
    if (match) {
      return {
        found: true,
        type: 'character',
        id: match.id,
        numericId,
        path: `/character/${match.id}`,
        result: match,
      };
    }
  }

  // Check prompts
  if (!typeHint || typeHint === 'prompt') {
    const prompts = getAllPrompts();
    const match = prompts.find(p => String(p.numericId) === numericId || p.id === numericId);
    if (match) {
      return {
        found: true,
        type: 'prompt',
        id: match.id,
        numericId,
        path: `/prompt/${match.id}`,
        result: match,
      };
    }
  }

  // Check creators/users
  if (!typeHint || typeHint === 'creator' || typeHint === 'user') {
    const users = getAllUsers();
    const match = users.find(u => String(u.numericId) === numericId || u.id === numericId);
    if (match) {
      return {
        found: true,
        type: match.creatorStatus ? 'creator' : 'user',
        id: match.id,
        numericId,
        path: `/creator/${match.id}`,
        result: match,
      };
    }
  }

  return null;
}
