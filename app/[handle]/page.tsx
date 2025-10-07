"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { Post } from '@/components/Post';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Loader2, UserPlus, UserMinus, Edit } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { followUser, unfollowUser, getFollowerCount, getFollowingCount, isFollowing } from '@/lib/api';
import { EditProfileDialog } from '@/components/EditProfileDialog';

interface Profile {
  id: string;
  handle: string;
  name: string;
  bio: string;
  avatar_url: string | null;
  created_at: string;
}

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

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const handle = params.handle as string;
  const { profile: currentProfile, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [likesMap, setLikesMap] = useState<Record<string, { count: number; isLiked: boolean }>>({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const isOwnProfile = currentProfile?.handle === handle;

  useEffect(() => {
    if (!authLoading && !currentProfile) {
      router.push('/login');
    }
  }, [authLoading, currentProfile, router]);

  useEffect(() => {
    if (currentProfile) {
      fetchProfile();
    }
  }, [handle, currentProfile]);

  const fetchProfile = async () => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('handle', handle)
        .maybeSingle();

      if (!profileData) {
        router.push('/');
        return;
      }

      setProfile(profileData);

      const [followers, following, isFollowingData] = await Promise.all([
        getFollowerCount(profileData.id),
        getFollowingCount(profileData.id),
        currentProfile ? isFollowing(currentProfile.id, profileData.id) : Promise.resolve(false),
      ]);

      setFollowerCount(followers);
      setFollowingCount(following);
      setIsFollowingUser(isFollowingData);

      await fetchPosts(profileData.id);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async (userId: string, cursor?: string) => {
    if (!currentProfile) return;

    try {
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
        .eq('user_id', userId)
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
            .eq('user_id', currentProfile.id)
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
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (posts.length > 0 && !loadingMore && profile) {
      setLoadingMore(true);
      const lastPost = posts[posts.length - 1];
      fetchPosts(profile.id, lastPost.created_at);
    }
  };

  const handleFollow = async () => {
    if (!currentProfile || !profile || followLoading) return;

    setFollowLoading(true);
    const optimisticFollowing = !isFollowingUser;
    const optimisticCount = isFollowingUser ? followerCount - 1 : followerCount + 1;

    setIsFollowingUser(optimisticFollowing);
    setFollowerCount(optimisticCount);

    try {
      if (isFollowingUser) {
        await unfollowUser(currentProfile.id, profile.id);
      } else {
        await followUser(currentProfile.id, profile.id);
      }
    } catch (error) {
      setIsFollowingUser(!optimisticFollowing);
      setFollowerCount(isFollowingUser ? followerCount : followerCount);
    } finally {
      setFollowLoading(false);
    }
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

  if (!profile || !currentProfile) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <main className="container mx-auto max-w-2xl px-4 py-6">
        <Card className="p-6 mb-4">
          <div className="flex items-start justify-between mb-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-2xl">{profile.name[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            {isOwnProfile ? (
              <Button onClick={() => setEditDialogOpen(true)} size="sm" variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            ) : (
              <Button
                onClick={handleFollow}
                disabled={followLoading}
                size="sm"
                variant={isFollowingUser ? 'outline' : 'default'}
              >
                {isFollowingUser ? (
                  <>
                    <UserMinus className="h-4 w-4 mr-2" />
                    Unfollow
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Follow
                  </>
                )}
              </Button>
            )}
          </div>
          <h1 className="text-2xl font-bold mb-1">{profile.name}</h1>
          <p className="text-muted-foreground mb-3">@{profile.handle}</p>
          {profile.bio && <p className="mb-4">{profile.bio}</p>}
          <div className="flex gap-6 text-sm">
            <div>
              <span className="font-semibold">{followingCount}</span>{' '}
              <span className="text-muted-foreground">Following</span>
            </div>
            <div>
              <span className="font-semibold">{followerCount}</span>{' '}
              <span className="text-muted-foreground">Followers</span>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold px-1">Posts</h2>
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No posts yet</p>
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
      <EditProfileDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        profile={profile}
        onProfileUpdated={fetchProfile}
      />
    </div>
  );
}
