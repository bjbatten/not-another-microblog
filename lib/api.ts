import { supabase } from './supabase';

/* ------------------------- CREATE / DELETE POSTS ------------------------- */

export async function createPost(userId: string, content: string, imageUrl?: string) {
  // 1. Create the post
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      content,
      image_url: imageUrl || null,
    })
    .select()
    .single();

  if (postError) throw postError;

  // 2. Fire-and-forget enrichment (hashtags, mentions, urls)
  await Promise.allSettled([
    linkHashtags(post.id, content),
    insertMentions(post.id, content),
    linkUrls(post.id, content),
  ]);

  return post;
}

export async function deletePost(postId: string) {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
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

/* ------------------------------ HOME FEED ------------------------------- */

export async function getHomeFeed(userId: string, cursor?: string, limit = 20) {
  const following = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  const followingIds = following.data?.map((f) => f.following_id) || [];
  followingIds.push(userId);

  if (followingIds.length === 0) return [];

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

  if (cursor) query = query.lt('created_at', cursor);

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

  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/* ------------------------------- PROFILES ------------------------------- */

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

/* ---------------------------- FOLLOWS / LIKES --------------------------- */

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

/* ---------------------- HASHTAGS / MENTIONS / LINKS ---------------------- */

export function parseHashtags(content: string): string[] {
  const regex = /#(\w+)/g;
  const matches = content.match(regex);
  return matches ? matches.map((tag) => tag.slice(1).toLowerCase()) : [];
}

export function parseMentions(content: string): string[] {
  const regex = /@(\w+)/g;
  const matches = content.match(regex);
  return matches ? matches.map((m) => m.slice(1).toLowerCase()) : [];
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

async function linkHashtags(postId: string, content: string) {
  const tags = Array.from(new Set(parseHashtags(content)));
  if (tags.length === 0) return;

  const hashtagRows = await Promise.all(tags.map((t) => getOrCreateHashtag(t)));
  const rows = hashtagRows.map((h) => ({ post_id: postId, hashtag_id: h.id }));

  const { error } = await supabase
    .from('post_hashtags')
    .upsert(rows, { onConflict: 'post_id,hashtag_id', ignoreDuplicates: true });

  if (error) console.error('post_hashtags error:', error.message);
}

async function insertMentions(postId: string, content: string) {
  const handles = Array.from(new Set(parseMentions(content)));
  if (handles.length === 0) return;

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, handle')
    .in('handle', handles);

  if (error) {
    console.error('mentions profiles error:', error.message);
    return;
  }
  if (!profiles?.length) return;

  const rows = profiles.map((p) => ({ post_id: postId, user_id: p.id }));
  const { error: insertErr } = await supabase.from('mentions').insert(rows);
  if (insertErr) console.error('mentions insert error:', insertErr.message);
}

async function linkUrls(postId: string, content: string) {
  const urls = Array.from(new Set(parseUrls(content)));
  if (urls.length === 0) return;

  const previewIds: string[] = [];

  for (const url of urls) {
    const { data: existing } = await supabase
      .from('link_previews')
      .select('id')
      .eq('url', url)
      .maybeSingle();

    if (existing) {
      previewIds.push(existing.id);
      continue;
    }

    const { data: created, error } = await supabase
      .from('link_previews')
      .insert({ url })
      .select('id')
      .single();

    if (error) {
      console.error('link_previews insert error:', error.message);
      continue;
    }
    previewIds.push(created.id);
  }

  if (previewIds.length === 0) return;

  const rows = previewIds.map((id) => ({ post_id: postId, link_preview_id: id }));
  const { error } = await supabase
    .from('post_links')
    .upsert(rows, { onConflict: 'post_id,link_preview_id', ignoreDuplicates: true });

  if (error) console.error('post_links upsert error:', error.message);
}

/* ------------------------------ UPLOAD IMAGE ----------------------------- */

export async function uploadImage(file: File): Promise<string> {
  return URL.createObjectURL(file);
}
