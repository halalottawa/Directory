export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isFirestoreQuotaErrorClient(err: unknown): boolean {
  if (!err) return false;
  const code = (err as any)?.code;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    code === 'resource-exhausted' ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('resource-exhausted')
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (isFirestoreQuotaErrorClient(error)) {
    console.warn(`[Firestore Quota Fallback] Quota reached during ${operationType} on ${path || 'unknown'}`);
    if (
      operationType === OperationType.CREATE ||
      operationType === OperationType.UPDATE ||
      operationType === OperationType.DELETE ||
      operationType === OperationType.WRITE
    ) {
      import('sonner')
        .then(({ toast }) => {
          toast.error('Daily database quota reached. Please try again after the quota resets.');
        })
        .catch(() => {});
    }
    return;
  }

  let currentUser: any = null;
  try {
    currentUser = (globalThis as any).__FIREBASE_AUTH_INSTANCE__?.currentUser ?? null;
  } catch {
    currentUser = null;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo: currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
