import {
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import * as localDb from './localDb';

export function getCollectionName(refOrQuery: any): string {
  try {
    if (!refOrQuery) return '';
    if (typeof refOrQuery === 'string') return refOrQuery;
    if (refOrQuery.path) return refOrQuery.path.split('/')[0];
    if (refOrQuery.id && !refOrQuery.parent) return refOrQuery.id;
    if (refOrQuery._query?.path?.segments?.length > 0) return refOrQuery._query.path.segments[0];
    if (refOrQuery._path?.segments?.length > 0) return refOrQuery._path.segments[0];
  } catch (e) {
    console.log("getCollectionName error:", e);
  }
  return '';
}

export function getDocId(docRef: any): string {
  try {
    if (!docRef) return '';
    if (typeof docRef === 'string') return docRef;
    if (docRef.id) return docRef.id;
    if (docRef._key?.path?.segments?.length > 0) {
      const segs = docRef._key.path.segments;
      return segs[segs.length - 1];
    }
  } catch (e) {
    console.log("getDocId error:", e);
  }
  return '';
}

export function findLocalCollection(colName: string): any[] {
  switch (colName) {
    case 'users':
      return localDb.getAllUsers();
    case 'characters':
      return localDb.getAllCharacters();
    case 'prompts':
      return localDb.getAllPrompts();
    case 'feedbacks':
      return localDb.getAllFeedbacks();
    case 'comments':
      return localDb.getAllComments();
    case 'bookmarks':
      return localDb.getAllBookmarks();
    case 'follows':
      return localDb.getAllFollows();
    case 'notifications':
      return localDb.getAllNotifications();
    case 'reports':
      return localDb.getAllReports();
    case 'audit_logs':
      return localDb.getAllAuditLogs();
    case 'creator_requests':
      return localDb.getAllCreatorRequests();
    case 'creator_appeals':
      return localDb.getAllCreatorAppeals();
    case 'support_tickets':
      return localDb.getAllSupportTickets();
    case 'moderator_invites':
      return localDb.getAllModeratorInvites();
    case 'character_likes':
    case 'likes':
      return localDb.getAllLikes();
    default:
      return [];
  }
}

export function makeQuerySnapshot(items: any[]) {
  const docs = items.map(item => ({
    id: item.id || item.uid || 'doc_' + Math.random().toString(36).substring(2, 7),
    exists: () => true,
    data: () => ({ ...item }),
    get: (field: string) => item[field],
    ref: { id: item.id || item.uid }
  }));

  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach: (callback: (doc: any) => void) => docs.forEach(callback),
    map: (callback: (doc: any) => any) => docs.map(callback)
  };
}

export function makeDocSnapshot(id: string, item: any | null) {
  return {
    id: id || item?.id || item?.uid || '',
    exists: () => !!item,
    data: () => (item ? { ...item } : null),
    get: (field: string) => item?.[field]
  };
}

// Memory cache to prevent redundant reads and save quota
const memoryCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Global state to track quota status
export let isQuotaExceeded = false;
export const onQuotaExceeded = (callback: (status: boolean) => void) => {
  quotaCallbacks.push(callback);
};
const quotaCallbacks: ((status: boolean) => void)[] = [];

function setQuotaExceeded(status: boolean) {
  if (isQuotaExceeded === status) return;
  isQuotaExceeded = status;
  quotaCallbacks.forEach(cb => cb(status));
}

export async function safeGetDocs(queryOrRef: any): Promise<any> {
  const colName = getCollectionName(queryOrRef);
  const queryStr = queryOrRef?._query ? JSON.stringify(queryOrRef._query) : (queryOrRef?.id || 'default');
  const cacheKey = `docs:${colName}:${queryStr}`;

  // Check cache first
  if (memoryCache[cacheKey] && (Date.now() - memoryCache[cacheKey].timestamp) < CACHE_DURATION) {
    console.log(`[Firestore Cache] Using cached docs for ${colName}`);
    return memoryCache[cacheKey].data;
  }

  try {
    const snap = await getDocs(queryOrRef);
    
    // Update cache
    memoryCache[cacheKey] = {
      data: snap,
      timestamp: Date.now()
    };

    // Sync to localDb for future fallbacks
    try {
      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return { id: d.id, ...(data || {}) };
      });
      if (colName === 'users') {
        items.forEach(item => localDb.updateUser(item.id, item));
      } else if (colName === 'characters') {
        items.forEach(item => localDb.updateCharacter(item.id, item));
      } else if (colName === 'prompts') {
        items.forEach(item => localDb.updatePrompt(item.id, item));
      } else if (colName === 'feedbacks') {
        items.forEach(item => localDb.updateFeedback(item.id, item));
      } else if (colName === 'creator_requests') {
        items.forEach(item => localDb.updateCreatorRequest(item.id, item));
      }
    } catch (syncErr) {
      console.log("Background sync to localDb failed:", syncErr);
    }

    return snap;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const isQuotaError = errorMsg.includes('Quota') || errorMsg.includes('limit exceeded') || errorMsg.includes('resource-exhausted') || errorMsg.includes('unavailable');
    
    if (isQuotaError) {
      console.warn("[Firestore Safe Wrapper] Connection unavailable or Quota limit exceeded! Falling back to local data.");
      setQuotaExceeded(true);
    } else {
      console.log("[Firestore Safe Wrapper] getDocs failed, fallback to localDb:", errorMsg);
    }

    try {
      const items = findLocalCollection(colName);
      const fallbackSnap = makeQuerySnapshot(items);
      return fallbackSnap;
    } catch (innerErr) {
      console.error("[Firestore Safe Wrapper] getDocs fallback error:", innerErr);
      return makeQuerySnapshot([]);
    }
  }
}

export async function safeGetDoc(docRef: any): Promise<any> {
  const colName = getCollectionName(docRef);
  const docId = docRef.id || getDocId(docRef);
  const cacheKey = `doc:${colName}:${docId}`;

  // Check cache
  if (memoryCache[cacheKey] && (Date.now() - memoryCache[cacheKey].timestamp) < CACHE_DURATION) {
    console.log(`[Firestore Cache] Using cached doc for ${colName}/${docId}`);
    return memoryCache[cacheKey].data;
  }

  try {
    const snap = await getDoc(docRef);
    
    // Update cache
    memoryCache[cacheKey] = {
      data: snap,
      timestamp: Date.now()
    };

    if (snap.exists()) {
      // Sync to local
      try {
        const data = snap.data() as any;
        const item = { id: snap.id, ...(data || {}) };
        if (colName === 'users') localDb.updateUser(snap.id, item);
        else if (colName === 'characters') localDb.updateCharacter(snap.id, item);
        else if (colName === 'prompts') localDb.updatePrompt(snap.id, item);
        else if (colName === 'feedbacks') localDb.updateFeedback(snap.id, item);
      } catch (syncErr) {
        console.log("Background sync to localDb failed:", syncErr);
      }
      return snap;
    }

    const items = findLocalCollection(colName);
    const item = items.find(i => (i.id || i.uid) === docId);
    if (item) return makeDocSnapshot(docId, item);
    return snap;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const isQuotaError = errorMsg.includes('Quota') || errorMsg.includes('limit exceeded') || errorMsg.includes('resource-exhausted') || errorMsg.includes('unavailable');
    
    if (isQuotaError) {
      console.warn(`[Firestore Safe Wrapper] getDoc Connection unavailable or Quota hit for ${colName}/${docId}`);
      setQuotaExceeded(true);
    } else {
      console.log("[Firestore Safe Wrapper] getDoc failed, fallback to localDb:", errorMsg);
    }

    try {
      const items = findLocalCollection(colName);
      const item = items.find(i => (i.id || i.uid) === docId);
      return makeDocSnapshot(docId, item);
    } catch (innerErr) {
      console.error("[Firestore Safe Wrapper] getDoc fallback error:", innerErr);
      return makeDocSnapshot('', null);
    }
  }
}

export async function safeAddDoc(colRef: any, data: any): Promise<any> {
  const colName = getCollectionName(colRef);
  try {
    const docRef = await addDoc(colRef, data);
    try {
      if (colName === 'feedbacks') {
        localDb.createFeedback({ ...data, id: docRef.id });
      } else if (colName === 'prompts') {
        localDb.createPrompt({ ...data, id: docRef.id });
      } else if (colName === 'characters') {
        localDb.createCharacter({ ...data, id: docRef.id });
      } else if (colName === 'comments') {
        localDb.createComment({ ...data, id: docRef.id });
      } else if (colName === 'notifications') {
        localDb.addNotification({ ...data, id: docRef.id });
      } else if (colName === 'reports') {
        localDb.createReport({ ...data, id: docRef.id });
      } else if (colName === 'bookmarks') {
        localDb.createBookmark({ ...data, id: docRef.id });
      } else if (colName === 'follows') {
        localDb.createFollow({ ...data, id: docRef.id });
      } else if (colName === 'creator_requests') {
        localDb.createCreatorRequest({ ...data, id: docRef.id });
      } else if (colName === 'creator_appeals') {
        localDb.createCreatorAppeal({ ...data, id: docRef.id });
      } else if (colName === 'support_tickets') {
        localDb.createSupportTicket({ ...data, id: docRef.id });
      }
    } catch (localErr) {
      console.log("Local sync failed after Firestore add:", localErr);
    }
    return docRef;
  } catch (err: any) {
    console.log("[Firestore Safe Wrapper] addDoc failed, fallback local ID:", err?.message || err);
    const newId = colName + '_' + Math.random().toString(36).substring(2, 9);
    
    // Add to localDb if possible
    if (colName === 'feedbacks') {
      localDb.createFeedback({ ...data, id: newId });
    } else if (colName === 'prompts') {
      localDb.createPrompt({ ...data, id: newId });
    } else if (colName === 'characters') {
      localDb.createCharacter({ ...data, id: newId });
    } else if (colName === 'comments') {
      localDb.createComment({ ...data, id: newId });
    } else if (colName === 'notifications') {
      localDb.addNotification({ ...data, id: newId });
    } else if (colName === 'reports') {
      localDb.createReport({ ...data, id: newId });
    } else if (colName === 'bookmarks') {
      localDb.createBookmark({ ...data, id: newId });
    } else if (colName === 'follows') {
      localDb.createFollow({ ...data, id: newId });
    } else if (colName === 'creator_requests') {
      localDb.createCreatorRequest({ ...data, id: newId });
    } else if (colName === 'creator_appeals') {
      localDb.createCreatorAppeal({ ...data, id: newId });
    } else if (colName === 'support_tickets') {
      localDb.createSupportTicket({ ...data, id: newId });
    }

    return { id: newId };
  }
}

export async function safeUpdateDoc(docRef: any, data: any): Promise<any> {
  const colName = getCollectionName(docRef);
  const docId = getDocId(docRef);

  try {
    await updateDoc(docRef, data);
  } catch (err: any) {
    console.log("[Firestore Safe Wrapper] updateDoc failed, fallback local update:", err?.message || err);
  }

  // Always sync localDb to ensure UI state remains consistent even when Firestore errors
  if (colName === 'feedbacks') {
    localDb.updateFeedback(docId, data);
  } else if (colName === 'prompts') {
    localDb.updatePrompt(docId, data);
  } else if (colName === 'characters') {
    localDb.updateCharacter(docId, data);
  } else if (colName === 'users') {
    localDb.updateUser(docId, data);
  } else if (colName === 'comments') {
    localDb.updateComment(docId, data);
  } else if (colName === 'creator_requests') {
    localDb.updateCreatorRequest(docId, data);
  }
}

export async function safeDeleteDoc(docRef: any): Promise<any> {
  const colName = getCollectionName(docRef);
  const docId = getDocId(docRef);

  try {
    await deleteDoc(docRef);
  } catch (err: any) {
    console.log("[Firestore Safe Wrapper] deleteDoc failed, fallback local delete:", err?.message || err);
  }

  // Always sync localDb delete
  if (colName === 'feedbacks') {
    localDb.deleteFeedback(docId);
  } else if (colName === 'prompts') {
    localDb.deletePrompt(docId);
  } else if (colName === 'characters') {
    localDb.deleteCharacter(docId);
  } else if (colName === 'comments') {
    localDb.deleteComment(docId);
  } else if (colName === 'bookmarks') {
    localDb.deleteBookmark(docId);
  } else if (colName === 'follows') {
    localDb.deleteFollow(docId);
  }
}

export async function safeSetDoc(docRef: any, data: any, options?: any): Promise<any> {
  const colName = getCollectionName(docRef);
  const docId = getDocId(docRef);

  try {
    await setDoc(docRef, data, options);
  } catch (err: any) {
    console.log("[Firestore Safe Wrapper] setDoc failed, fallback local set:", err?.message || err);
  }

  if (colName === 'users') {
    localDb.updateUser(docId, data);
  } else if (colName === 'creator_requests') {
    localDb.updateCreatorRequest(docId, data);
  }
}
