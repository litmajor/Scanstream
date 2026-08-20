import type { TruthEngine } from './aggregator/truth-engine';

export interface SharedServiceMap {
  truthEngine: TruthEngine;
}

const services: Partial<SharedServiceMap> = {};

export function getSharedService<K extends keyof SharedServiceMap>(
  name: K,
): SharedServiceMap[K] | undefined {
  return services[name];
}

export function setSharedService<K extends keyof SharedServiceMap>(
  name: K,
  service: SharedServiceMap[K] | null | undefined,
): void {
  if (service === null || service === undefined) {
    delete services[name];
    return;
  }
  services[name] = service;
}

export function clearSharedService<K extends keyof SharedServiceMap>(name: K): void {
  delete services[name];
}
