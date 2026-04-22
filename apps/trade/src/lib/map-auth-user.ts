import { z } from 'zod';
import type { AuthUser } from '@/store/slices/auth.slice';

const authUserApiSchema = z.object({
  id: z.string(),
  custId: z.string(),
  fullName: z.string(),
  email: z.union([z.string(), z.null()]).optional(),
  role: z.string().transform((r) => (r === 'admin' ? 'admin' : 'user')),
});

export function mapAuthUserPayload(raw: unknown): AuthUser | null {
  const parsed = authUserApiSchema.safeParse(raw);
  if (!parsed.success) return null;
  const d = parsed.data;
  return {
    id: d.id,
    custId: d.custId,
    fullName: d.fullName,
    email: d.email ?? null,
    role: d.role,
  };
}
