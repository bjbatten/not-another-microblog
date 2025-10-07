"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, User, LogOut, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';

export function Navigation() {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (!profile) return null;

  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl hidden sm:inline">Micro Blog</span>
            </Link>
            <div className="flex gap-2">
              <Link href="/">
                <Button
                  variant={pathname === '/' ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-2"
                >
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">Home</span>
                </Button>
              </Link>
              <Link href={`/${profile.handle}`}>
                <Button
                  variant={pathname === `/${profile.handle}` ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-2"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Profile</span>
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href={`/${profile.handle}`} className="flex items-center gap-2 hover:opacity-80">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback>{profile.name[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="font-medium hidden sm:inline">@{profile.handle}</span>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
