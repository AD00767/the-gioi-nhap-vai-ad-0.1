import { getAllCharacters, getAllPrompts, getFollowerCount, updateUser } from './localDb';

export interface CreatorStats {
  characterCount: number;
  promptCount: number;
  followerCount: number;
}

export async function getExactCreatorStats(creatorId: string): Promise<CreatorStats> {
  if (!creatorId) {
    return { characterCount: 0, promptCount: 0, followerCount: 0 };
  }

  const allChars = getAllCharacters();
  const characterCount = allChars.filter(c => c.creatorId === creatorId).length;

  const allPrompts = getAllPrompts();
  const promptCount = allPrompts.filter(p => p.authorId === creatorId).length;

  const followerCount = getFollowerCount(creatorId);

  updateUser(creatorId, {
    followerCount,
  });

  return { characterCount, promptCount, followerCount };
}
