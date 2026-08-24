import { describe, it, expect } from 'vitest';
import { buildSectionResponse } from '../recruiterPreviewSections';

describe('buildSectionResponse', () => {
  it('includes only enabled sections', async () => {
    const lead = {
      id: 'lead-1',
      role_title: 'Engineer',
      resume_match_status: 'READY',
      resume_match_raw: { score: 85 },
      candidate_level: 'mid',
    };

    const result = await buildSectionResponse(lead, ['fitment']);

    expect(result.fitment).toBeDefined();
    expect(result.personality).toBeUndefined();
    expect(result.interview).toBeUndefined();
  });

  it('returns empty object for no sections', async () => {
    const lead = { id: 'lead-1', role_title: 'Engineer' };
    const result = await buildSectionResponse(lead, []);
    expect(result).toEqual({});
  });
});
