const DEFAULT_TIMEOUT_MS = 8000;

export class RequestTimeoutError extends Error {
  constructor(message = "A requisicao excedeu o tempo limite.") {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

export function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new RequestTimeoutError());
    }, timeoutMs);

    Promise.resolve(promise)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function getServiceUnavailableMessage() {
  return "O sistema esta indisponivel agora. Tente novamente em alguns minutos.";
}
