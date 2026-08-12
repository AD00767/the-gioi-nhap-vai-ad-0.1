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

export async function safeGetDocs(queryOrRef: any): Promise<any> {
  try {
    const snap = await getDocs(queryOrRef);
    return snap;
  } catch (err: any) {
    console.log("[Firestore Safe Wrapper] getDocs failed, fallback to localDb:", err?.message || err);
    try {
      const colName = getCollectionName(queryOrRef);
      const items = findLocalCollection(colName);
      return makeQuerySnapshot(items);
    } catch (innerErr) {
      console.error("[Firestore Safe Wrapper] getDocs fallback error:", innerErr);
      return makeQuerySnapshot([]);
    }
  }
}

export async function safeGetDoc(docRef: any): Promise<any> {
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) return snap;
    const colName = getCollectionName(docRef);
    const docId = getDocId(docRef);
    const items = findLocalCollection(colName);
    const item = items.find(i => (i.id || i.uid) === docId);
    if (item) return makeDocSnapshot(docId, item);
    return snap;
  } catch (err: any) {
    console.log("[Firestore Safe Wrapper] getDoc failed, fallback to localDb:", err?.message || err);
    try {
      const colName = getCollectionName(docRef);
      const docId = getDocId(docRef);
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
    if (colName === 'users') {
      localDb.updateUser(docId, data);
    }
  }
}
