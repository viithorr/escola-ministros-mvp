const DEFAULT_TIMEOUT_MS = 8000;

export class RequestTimeoutError extends Error {
  constructor(message = "A requisicao excedeu o tempo limite.") {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new RequestTimeoutError()), timeoutMs);
    }),
  ]);
}

export function getServiceUnavailableMessage() {
  return "O sistema esta indisponivel agora. Tente novamente em alguns minutos.";
}
