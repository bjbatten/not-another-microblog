/*
  # Micro Blog Database Schema

  ## Overview
  Complete schema for a Blog-like social media platform with authentication,
  posts, follows, likes, and admin moderation capabilities.

  ## New Tables

  ### `profiles`
  User profile information and settings
  - `id` (uuid, primary key) - Links to auth.users
  - `handle` (text, unique) - Username/handle (@username)
  - `name` (text) - Display name
  - `bio` (text) - User biography
  - `avatar_url` (text) - Profile picture URL
  - `is_admin` (boolean) - Admin flag for moderation
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last profile update

  ### `posts`
  User-generated posts/tweets
  - `id` (uuid, primary key) - Unique post identifier
  - `user_id` (uuid, foreign key) - Post author
  - `content` (text) - Post text (max 280 chars enforced in app)
  - `image_url` (text) - Optional image attachment
  - `is_deleted` (boolean) - Soft delete flag for admin moderation
  - `deleted_by` (uuid) - Admin who deleted the post
  - `deleted_at` (timestamptz) - Deletion timestamp
  - `created_at` (timestamptz) - Post creation timestamp

  ### `follows`
  User following relationships
  - `id` (uuid, primary key) - Unique follow relationship ID
  - `follower_id` (uuid, foreign key) - User doing the following
  - `following_id` (uuid, foreign key) - User being followed
  - `created_at` (timestamptz) - When follow relationship was created
  - Unique constraint on (follower_id, following_id)

  ### `likes`
  Post likes/favorites
  - `id` (uuid, primary key) - Unique like ID
  - `user_id` (uuid, foreign key) - User who liked
  - `post_id` (uuid, foreign key) - Post being liked
  - `created_at` (timestamptz) - When like was created
  - Unique constraint on (user_id, post_id)

  ### `hashtags`
  Extracted hashtags from posts
  - `id` (uuid, primary key) - Unique hashtag ID
  - `tag` (text, unique) - The hashtag text (without #)
  - `created_at` (timestamptz) - First use timestamp

  ### `post_hashtags`
  Junction table for posts and hashtags
  - `post_id` (uuid, foreign key) - Post containing hashtag
  - `hashtag_id` (uuid, foreign key) - Referenced hashtag
  - Primary key on (post_id, hashtag_id)

  ### `mentions`
  User mentions in posts
  - `id` (uuid, primary key) - Unique mention ID
  - `post_id` (uuid, foreign key) - Post containing mention
  - `user_id` (uuid, foreign key) - User being mentioned
  - `created_at` (timestamptz) - Mention timestamp

  ### `link_previews`
  Open Graph metadata cache for URLs
  - `id` (uuid, primary key) - Unique preview ID
  - `url` (text, unique) - Original URL
  - `title` (text) - OG title
  - `description` (text) - OG description
  - `image_url` (text) - OG image
  - `created_at` (timestamptz) - Cache timestamp

  ### `post_links`
  Junction table for posts and link previews
  - `post_id` (uuid, foreign key) - Post containing link
  - `link_preview_id` (uuid, foreign key) - Associated preview
  - Primary key on (post_id, link_preview_id)

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Policies ensure users can only modify their own data
  - Admin-only policies for soft deletion
  - Public read access for non-deleted posts
  - Authenticated-only write access

  ## Indexes
  - Performance indexes on frequently queried columns
  - Foreign key indexes for efficient joins
  - Unique constraints for data integrity
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text UNIQUE NOT NULL,
  name text NOT NULL,
  bio text DEFAULT '',
  avatar_url text,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT handle_length CHECK (char_length(handle) >= 3 AND char_length(handle) <= 30),
  CONSTRAINT handle_format CHECK (handle ~ '^[a-zA-Z0-9_]+$')
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  image_url text,
  is_deleted boolean DEFAULT false,
  deleted_by uuid REFERENCES profiles(id),
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT content_length CHECK (char_length(content) > 0 AND char_length(content) <= 280)
);

-- Follows table
CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id),
  CONSTRAINT unique_follow UNIQUE (follower_id, following_id)
);

-- Likes table
CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_like UNIQUE (user_id, post_id)
);

-- Hashtags table
CREATE TABLE IF NOT EXISTS hashtags (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT tag_format CHECK (tag ~ '^[a-zA-Z0-9_]+$')
);

-- Post-Hashtags junction table
CREATE TABLE IF NOT EXISTS post_hashtags (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  hashtag_id uuid NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, hashtag_id)
);

-- Mentions table
CREATE TABLE IF NOT EXISTS mentions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Link previews table
CREATE TABLE IF NOT EXISTS link_previews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  url text UNIQUE NOT NULL,
  title text,
  description text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- Post-Links junction table
CREATE TABLE IF NOT EXISTS post_links (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  link_preview_id uuid NOT NULL REFERENCES link_previews(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, link_preview_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_is_deleted ON posts(is_deleted);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_user ON mentions(user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_post ON mentions(post_id);
CREATE INDEX IF NOT EXISTS idx_hashtags_tag ON hashtags(tag);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_links ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Posts policies
CREATE POLICY "Non-deleted posts are viewable by everyone"
  ON posts FOR SELECT
  USING (is_deleted = false);

CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can soft-delete any post"
  ON posts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Users can delete their own posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Follows policies
CREATE POLICY "Follows are viewable by everyone"
  ON follows FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can follow others"
  ON follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow others"
  ON follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- Likes policies
CREATE POLICY "Likes are viewable by everyone"
  ON likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can like posts"
  ON likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts"
  ON likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Hashtags policies
CREATE POLICY "Hashtags are viewable by everyone"
  ON hashtags FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create hashtags"
  ON hashtags FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Post-Hashtags policies
CREATE POLICY "Post hashtags are viewable by everyone"
  ON post_hashtags FOR SELECT
  USING (true);

CREATE POLICY "Post authors can manage hashtags"
  ON post_hashtags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_id
      AND posts.user_id = auth.uid()
    )
  );

-- Mentions policies
CREATE POLICY "Mentions are viewable by everyone"
  ON mentions FOR SELECT
  USING (true);

CREATE POLICY "Post authors can create mentions"
  ON mentions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_id
      AND posts.user_id = auth.uid()
    )
  );

-- Link previews policies
CREATE POLICY "Link previews are viewable by everyone"
  ON link_previews FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create link previews"
  ON link_previews FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Post-Links policies
CREATE POLICY "Post links are viewable by everyone"
  ON post_links FOR SELECT
  USING (true);

CREATE POLICY "Post authors can manage links"
  ON post_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_id
      AND posts.user_id = auth.uid()
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update profiles.updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();