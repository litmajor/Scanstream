export type Hyperparameters = Record<string, number | string | boolean>;

export function getHyperparameters(agent: any): Hyperparameters {
  return agent.hyperparameters || {};
}

export function setHyperparameters(agent: any, params: Hyperparameters) {
  agent.hyperparameters = { ...agent.hyperparameters, ...params };
}

export function validateParams(params: Hyperparameters, schema: Record<string, (v: any) => boolean>): boolean {
  return Object.entries(schema).every(([key, validate]) => validate(params[key]));
}
