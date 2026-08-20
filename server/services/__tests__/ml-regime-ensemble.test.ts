import { describe, expect, it } from 'vitest';
import { RegimeSpecificMLEnsemble } from '../ml-regime-ensemble';

describe('RegimeSpecificMLEnsemble', () => {
  it('implements the MLModel persistence contract', () => {
    const model = new RegimeSpecificMLEnsemble();
    const state = model.serialize();

    expect(state).toMatchObject({ isTrained: false });
    expect(() => model.deserialize(state)).not.toThrow();
  });
});
