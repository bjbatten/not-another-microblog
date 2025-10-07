import { supabase } from './supabase';

export async function createPost(userId: string, content: string, imageUrl?: string) {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      content,
      image_url: imageUrl || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePost(postId: string) {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) throw error;
}

export async function softDeletePost(postId: string, adminId: string) {
  const { error } = await supabase
    .from('posts')
    .update({
      is_deleted: true,
      deleted_by: adminId,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', postId);

  if (error) throw error;
}

export async function getHomeFeed(userId: string, cursor?: string, limit = 20) {
  const following = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  const followingIds = following.data?.map((f) => f.following_id) || [];
  followingIds.push(userId);

  if (followingIds.length === 0) {
    return [];
  }

  let query = supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id (
        id,
        handle,
        name,
        avatar_url
      )
    `)
    .in('user_id', followingIds)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function getUserPosts(userId: string, cursor?: string, limit = 20) {
  let query = supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id (
        id,
        handle,
        name,
        avatar_url
      ),
      likes:likes(count)
    `)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function getProfile(handle: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('handle', handle)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, updates: {
  name?: string;
  bio?: string;
  avatar_url?: string;
}) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function followUser(followerId: string, followingId: string) {
  const { data, error } = await supabase
    .from('follows')
    .insert({
      follower_id: followerId,
      following_id: followingId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function unfollowUser(followerId: string, followingId: string) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);

  if (error) throw error;
}

export async function isFollowing(followerId: string, followingId: string) {
  const { data, error } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function getFollowerCount(userId: string) {
  const { count, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId);

  if (error) throw error;
  return count || 0;
}

export async function getFollowingCount(userId: string) {
  const { count, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId);

  if (error) throw error;
  return count || 0;
}

export async function likePost(userId: string, postId: string) {
  const { data, error } = await supabase
    .from('likes')
    .insert({
      user_id: userId,
      post_id: postId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function unlikePost(userId: string, postId: string) {
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId);

  if (error) throw error;
}

export async function isPostLiked(userId: string, postId: string) {
  const { data, error } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function getLikeCount(postId: string) {
  const { count, error } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  if (error) throw error;
  return count || 0;
}

export function parseHashtags(content: string): string[] {
  const regex = /#(\w+)/g;
  const matches = content.match(regex);
  return matches ? matches.map(tag => tag.slice(1).toLowerCase()) : [];
}

export function parseMentions(content: string): string[] {
  const regex = /@(\w+)/g;
  const matches = content.match(regex);
  return matches ? matches.map(mention => mention.slice(1).toLowerCase()) : [];
}

export function parseUrls(content: string): string[] {
  const regex = /(https?:\/\/[^\s]+)/g;
  const matches = content.match(regex);
  return matches || [];
}

export async function getOrCreateHashtag(tag: string) {
  const normalizedTag = tag.toLowerCase();

  const { data: existing } = await supabase
    .from('hashtags')
    .select('*')
    .eq('tag', normalizedTag)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('hashtags')
    .insert({ tag: normalizedTag })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function uploadImage(file: File): Promise<string> {
  return URL.createObjectURL(file);
}
