"use client";

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Heart, Trash2, AlertCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { likePost, unlikePost, deletePost, softDeletePost } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface PostProps {
  post: {
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
  };
  initialLikeCount: number;
  initialIsLiked: boolean;
  onDelete?: () => void;
}

export function Post({ post, initialLikeCount, initialIsLiked, onDelete }: PostProps) {
  const { profile } = useAuth();
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwnPost = profile?.id === post.user_id;
  const isAdmin = profile?.is_admin;

  const handleLike = async () => {
    if (!profile || liking) return;

    setLiking(true);
    const optimisticLiked = !isLiked;
    const optimisticCount = isLiked ? likeCount - 1 : likeCount + 1;

    setIsLiked(optimisticLiked);
    setLikeCount(optimisticCount);

    try {
      if (isLiked) {
        await unlikePost(profile.id, post.id);
      } else {
        await likePost(profile.id, post.id);
      }
    } catch (error) {
      setIsLiked(!optimisticLiked);
      setLikeCount(isLiked ? likeCount : likeCount);
    } finally {
      setLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!profile || deleting) return;

    setDeleting(true);
    try {
      if (isOwnPost) {
        await deletePost(post.id);
      } else if (isAdmin) {
        await softDeletePost(post.id, profile.id);
      }
      onDelete?.();
    } catch (error) {
      console.error('Failed to delete post:', error);
    } finally {
      setDeleting(false);
    }
  };

  const renderContent = () => {
    const parts = [];
    const text = post.content;
    const regex = /(#\w+|@\w+|https?:\/\/[^\s]+)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      const matched = match[0];
      if (matched.startsWith('#')) {
        parts.push(
          <span key={match.index} className="text-blue-500 hover:underline cursor-pointer">
            {matched}
          </span>
        );
      } else if (matched.startsWith('@')) {
        const handle = matched.slice(1);
        parts.push(
          <Link key={match.index} href={`/${handle}`} className="text-blue-500 hover:underline">
            {matched}
          </Link>
        );
      } else if (matched.startsWith('http')) {
        parts.push(
          <a
            key={match.index}
            href={matched}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            {matched}
          </a>
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  return (
    <Card className="p-4 hover:bg-slate-50 transition-colors">
      <div className="flex gap-3">
        <Link href={`/${post.profiles.handle}`}>
          <Avatar className="h-12 w-12">
            <AvatarImage src={post.profiles.avatar_url || undefined} />
            <AvatarFallback>{post.profiles.name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/${post.profiles.handle}`} className="font-semibold hover:underline">
              {post.profiles.name}
            </Link>
            <Link href={`/${post.profiles.handle}`} className="text-muted-foreground text-sm">
              @{post.profiles.handle}
            </Link>
            <span className="text-muted-foreground text-sm">·</span>
            <span className="text-muted-foreground text-sm">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-base whitespace-pre-wrap break-words mb-3">{renderContent()}</p>
          {post.image_url && (
            <img
              src={post.image_url}
              alt="Post attachment"
              className="rounded-lg max-h-96 object-cover mb-3"
            />
          )}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className={`gap-2 ${isLiked ? 'text-red-500' : 'text-muted-foreground'}`}
              onClick={handleLike}
              disabled={!profile || liking}
            >
              <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
              <span>{likeCount}</span>
            </Button>
            {(isOwnPost || isAdmin) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                    {isAdmin && !isOwnPost ? <AlertCircle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {isAdmin && !isOwnPost ? 'Remove this post?' : 'Delete this post?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {isAdmin && !isOwnPost
                        ? 'This action will hide the post from all users. This cannot be undone.'
                        : 'This will permanently delete your post. This cannot be undone.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-500 hover:bg-red-600">
                      {deleting ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
