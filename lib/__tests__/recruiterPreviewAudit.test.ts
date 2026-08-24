import { describe, it, expect, vi } from 'vitest';
import { logAuditEvent } from '../recruiterPreviewAudit';

describe('logAuditEvent', () => {
  it('inserts audit row with correct fields', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          error: null,
        })),
      })),
    };

    await logAuditEvent(
      mockSupabase as any,
      'user-123',
      'lead-456',
      'sections_updated'
    );

    expect(mockSupabase.from).toHaveBeenCalledWith('recruiter_preview_audit');
  });

  it('throws on database error', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          error: new Error('db error'),
        })),
      })),
    };

    await expect(
      logAuditEvent(mockSupabase as any, 'user-123', 'lead-456', 'sections_updated')
    ).rejects.toThrow('db error');
  });
});
