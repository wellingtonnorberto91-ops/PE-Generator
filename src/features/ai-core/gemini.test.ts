import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCriteriaWithMethodology } from './gemini';

// Mock the GoogleGenAI class and SDK models properly as a constructor
vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = {
      generateContent: vi.fn().mockResolvedValue({
        text: '["Critério de teste 1", "Critério de teste 2"]'
      })
    };
  }
  return {
    GoogleGenAI: MockGoogleGenAI
  };
});

describe('Sentry AI Pedagogical Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCriteriaWithMethodology', () => {
    it('returns generated criteria matching capabilities length', async () => {
      const capabilities = ['Capacidade A', 'Capacidade B'];
      
      const result = await generateCriteriaWithMethodology(null, capabilities);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toContain('capacidade A');
    });

    it('handles null file gracefully and generates standard professional criteria', async () => {
      const capabilities = ['Capacidade X', 'Capacidade Y'];
      
      const result = await generateCriteriaWithMethodology(null, capabilities);
      expect(result).toHaveLength(2);
    });
  });
});
