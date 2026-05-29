/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isAdmin, syncRolesToFirestore } from './config';
import { getDoc, setDoc } from 'firebase/firestore';

// Mock firestore functions
vi.mock('firebase/firestore', async (importOriginal) => {
  const original = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...original,
    getFirestore: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
  };
});

describe('Firebase Auth Admin Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isAdmin', () => {
    it('returns true if the user role is admin', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'admin' }),
      } as any);

      const result = await isAdmin('admin-uid');
      expect(result).toBe(true);
    });

    it('returns false if the user role is not admin', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'user' }),
      } as any);

      const result = await isAdmin('user-uid');
      expect(result).toBe(false);
    });

    it('returns false if user document does not exist', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => false,
      } as any);

      const result = await isAdmin('ghost-uid');
      expect(result).toBe(false);
    });
  });

  describe('syncRolesToFirestore', () => {
    it('saves user role to firestore properly', async () => {
      vi.mocked(setDoc).mockResolvedValueOnce(undefined as any);

      await syncRolesToFirestore('test-uid', true);

      expect(setDoc).toHaveBeenCalled();
    });
  });
});
