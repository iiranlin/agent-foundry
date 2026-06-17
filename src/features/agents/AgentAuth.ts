import { currentUser } from '@clerk/nextjs/server';
import { Env } from '@/libs/Env';

const LOCAL_AGENT_OWNER_ID = 'local-development-owner';

export const getAgentOwnerId = async () => {
  try {
    const user = await currentUser();

    if (user) {
      return user.id;
    }
  } catch (error) {
    if (Env.NODE_ENV === 'production') {
      throw error;
    }
  }

  if (Env.NODE_ENV === 'production') {
    return null;
  }

  return LOCAL_AGENT_OWNER_ID;
};
