import {
  checkIsFollowing as localCheckFollowing,
  toggleFollow as localToggleFollow,
  getFollowerCount as localGetFollowerCount,
} from './localDb';

export interface FollowResult {
  success: boolean;
  following: boolean;
  followerCount: number;
  message?: string;
}

export async function checkIsFollowing(followerId: string, creatorId: string): Promise<boolean> {
  return localCheckFollowing(followerId, creatorId);
}

export async function reconcileFollowerCount(creatorId: string): Promise<number> {
  return localGetFollowerCount(creatorId);
}

export async function getFollowerCount(creatorId: string): Promise<number> {
  return localGetFollowerCount(creatorId);
}

export async function toggleFollow(
  followerId: string,
  creatorId: string,
  followerInfo?: { displayName?: string; avatar?: string }
): Promise<FollowResult> {
  if (!followerId || !creatorId) {
    return { success: false, following: false, followerCount: 0, message: "Yêu cầu không hợp lệ." };
  }

  if (followerId === creatorId) {
    return { success: false, following: false, followerCount: 0, message: "Bạn không thể tự theo dõi chính mình!" };
  }

  const result = localToggleFollow(followerId, creatorId, followerInfo);

  return {
    success: true,
    following: result.following,
    followerCount: result.count,
    message: result.following ? "Đã theo dõi Creator!" : "Đã hủy theo dõi Creator.",
  };
}
