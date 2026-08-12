import { addAuditLog } from './localDb';

export async function generateUniqueId(db: any, objectType: string, objectReference: string): Promise<string> {
  // Generate 9 digit numeric ID
  const uniqueId = Math.floor(100000000 + Math.random() * 900000000).toString();

  addAuditLog({
    adminId: 'system',
    action: 'ID_RESERVED',
    targetType: objectType,
    targetId: objectReference,
    reason: `Reserved ID ${uniqueId}`,
  });

  return uniqueId;
}
