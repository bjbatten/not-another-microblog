import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const sampleUsers = [
  {
    email: 'alice@example.com',
    password: 'password123',
    handle: 'alice_dev',
    name: 'Alice Johnson',
    bio: 'Full-stack developer | Coffee enthusiast | Building cool things',
    is_admin: true,
  },
  {
    email: 'bob@example.com',
    password: 'password123',
    handle: 'bob_designer',
    name: 'Bob Smith',
    bio: 'UI/UX Designer | Making the web beautiful',
  },
  {
    email: 'charlie@example.com',
    password: 'password123',
    handle: 'charlie_tech',
    name: 'Charlie Brown',
    bio: 'Tech blogger | Startup founder | Always learning',
  },
  {
    email: 'diana@example.com',
    password: 'password123',
    handle: 'diana_data',
    name: 'Diana Prince',
    bio: 'Data scientist | ML engineer | AI enthusiast',
  },
];

const samplePosts = [
  {
    content: 'Just launched my new project! Check it out at https://example.com #webdev #launch',
  },
  {
    content: 'What are your favorite @alice_dev tools for development? Looking for recommendations!',
  },
  {
    content: 'Beautiful sunset today. Sometimes you need to step away from the screen. 🌅',
  },
  {
    content: 'Hot take: TypeScript is the best thing that happened to JavaScript. Fight me. #typescript #javascript',
  },
  {
    content: 'Just finished a great book on system design. Highly recommend it to all @charlie_tech!',
  },
  {
    content: 'Coffee + Code = Productivity ☕️ #coding #motivation',
  },
  {
    content: 'Working on a new machine learning model. The results are looking promising! #AI #machinelearning',
  },
  {
    content: 'Pro tip: Always write tests before you deploy. Saved me so many times! #bestpractices',
  },
  {
    content: 'What is everyone working on this weekend? #weekendproject',
  },
  {
    content: 'Design is not just what it looks like. Design is how it works. - Steve Jobs',
  },
];

async function seed() {
  console.log('Starting seed...');

  const userIds: string[] = [];

  for (const user of sampleUsers) {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: user.email,
        password: user.password,
      });

      if (authError) {
        console.error(`Error creating user ${user.email}:`, authError.message);
        continue;
      }

      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id,
          handle: user.handle,
          name: user.name,
          bio: user.bio,
          is_admin: user.is_admin || false,
        });

        if (profileError) {
          console.error(`Error creating profile for ${user.email}:`, profileError.message);
        } else {
          console.log(`Created user: ${user.email}`);
          userIds.push(authData.user.id);
        }
      }
    } catch (error: any) {
      console.error(`Error with user ${user.email}:`, error.message);
    }
  }

  console.log(`Created ${userIds.length} users`);

  await new Promise((resolve) => setTimeout(resolve, 2000));

  const postPromises = userIds.flatMap((userId, userIndex) =>
    samplePosts.slice(0, 3 + userIndex).map(async (post) => {
      try {
        const { error } = await supabase.from('posts').insert({
          user_id: userId,
          content: post.content,
        });

        if (error) {
          console.error(`Error creating post:`, error.message);
        }
      } catch (error: any) {
        console.error(`Error creating post:`, error.message);
      }
    })
  );

  await Promise.all(postPromises);
  console.log('Created sample posts');

  for (let i = 0; i < userIds.length; i++) {
    for (let j = 0; j < userIds.length; j++) {
      if (i !== j && Math.random() > 0.5) {
        try {
          await supabase.from('follows').insert({
            follower_id: userIds[i],
            following_id: userIds[j],
          });
        } catch (error) {
        }
      }
    }
  }

  console.log('Created follow relationships');

  const { data: allPosts } = await supabase.from('posts').select('id, user_id');

  if (allPosts) {
    for (const post of allPosts) {
      for (const userId of userIds) {
        if (userId !== post.user_id && Math.random() > 0.7) {
          try {
            await supabase.from('likes').insert({
              user_id: userId,
              post_id: post.id,
            });
          } catch (error) {
          }
        }
      }
    }
  }

  console.log('Created likes');
  console.log('Seed completed successfully!');
  console.log('\nSample accounts:');
  sampleUsers.forEach((user) => {
    console.log(`  Email: ${user.email} | Password: ${user.password}`);
  });
}

seed().catch(console.error);
