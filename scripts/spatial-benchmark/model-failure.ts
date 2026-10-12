// Provider evidence of a declared model budget failure, never a repair hint.
export class ModelBudgetFailure extends Error {
  readonly category = "output-token-budget";
}
