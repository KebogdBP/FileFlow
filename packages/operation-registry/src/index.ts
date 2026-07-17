export type OperationDefinition = {
  id: string;
  displayName: string;
  executionMode: 'local' | 'cloud' | 'hybrid';
  supportedInputs: readonly string[];
  supportedOutputs: readonly string[];
};
export const operations: readonly OperationDefinition[] = [];
