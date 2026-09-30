import { prisma } from './prisma.js';

export async function logActivity(input: {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  meta?: Record<string, unknown>;
}) {
  await prisma.activityLog.create({
    data: {
      userId: input.userId || null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId || null,
      meta: JSON.stringify(input.meta || {}),
    },
  });
}
