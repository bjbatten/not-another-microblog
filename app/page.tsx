"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { CreatePost } from '@/components/CreatePost';
import { Post } from '@/components/Post';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface PostWithProfile {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user_id: string;
  profiles: {
    id: string;
    handle: string;
    name: string;
    avatar_url: string | null;
  };
}

export default function HomePage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [likesMap, setLikesMap] = useState<Record<string, { count: number; isLiked: boolean }>>({});

  useEffect(() => {
    if (!authLoading && !profile) {
      router.push('/login');
    }
  }, [authLoading, profile, router]);

  const fetchPosts = async (cursor?: string) => {
    if (!profile) return;

    try {
      const following = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', profile.id);

      const followingIds = following.data?.map((f) => f.following_id) || [];
      followingIds.push(profile.id);

      let query = supabase
        .from('posts')
        .select(`
          id,
          content,
          image_url,
          created_at,
          user_id,
          profiles!inner (
            id,
            handle,
            name,
            avatar_url
          )
        `)
        .in('user_id', followingIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const newPosts = data as any[];
        if (cursor) {
          setPosts((prev) => [...prev, ...newPosts]);
        } else {
          setPosts(newPosts);
        }

        if (newPosts.length < 20) {
          setHasMore(false);
        }

        const postIds = newPosts.map((p) => p.id);
        const [likeCounts, userLikes] = await Promise.all([
          supabase
            .from('likes')
            .select('post_id', { count: 'exact' })
            .in('post_id', postIds),
          supabase
            .from('likes')
            .select('post_id')
            .eq('user_id', profile.id)
            .in('post_id', postIds),
        ]);

        const likeCountMap: Record<string, number> = {};
        if (likeCounts.data) {
          for (const postId of postIds) {
            const count = likeCounts.data.filter((l) => l.post_id === postId).length;
            likeCountMap[postId] = count;
          }
        }

        const userLikedSet = new Set(userLikes.data?.map((l) => l.post_id));

        const newLikesMap: Record<string, { count: number; isLiked: boolean }> = {};
        for (const postId of postIds) {
          newLikesMap[postId] = {
            count: likeCountMap[postId] || 0,
            isLiked: userLikedSet.has(postId),
          };
        }

        setLikesMap((prev) => ({ ...prev, ...newLikesMap }));
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchPosts();
    }
  }, [profile]);

  const handleLoadMore = () => {
    if (posts.length > 0 && !loadingMore) {
      setLoadingMore(true);
      const lastPost = posts[posts.length - 1];
      fetchPosts(lastPost.created_at);
    }
  };

  const handlePostCreated = () => {
    setHasMore(true);
    fetchPosts();
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <main className="container mx-auto max-w-2xl px-4 py-6">
        <div className="space-y-4">
          <CreatePost onPostCreated={handlePostCreated} />
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg mb-2">No posts yet</p>
              <p className="text-muted-foreground text-sm">
                Follow some users or create your first post!
              </p>
            </div>
          ) : (
            <>
              {posts.map((post) => (
                <Post
                  key={post.id}
                  post={post}
                  initialLikeCount={likesMap[post.id]?.count || 0}
                  initialIsLiked={likesMap[post.id]?.isLiked || false}
                  onDelete={() => handlePostDeleted(post.id)}
                />
              ))}
              {hasMore && (
                <div className="flex justify-center py-4">
                  <Button onClick={handleLoadMore} disabled={loadingMore} variant="outline">
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load more'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
