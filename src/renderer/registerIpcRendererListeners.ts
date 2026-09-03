import { handleError } from 'src/errorHandling';
import { fyo } from 'src/initFyo';

export default function registerIpcRendererListeners() {
  ipc.registerMainProcessErrorListener(
    (_, error: unknown, more?: Record<string, unknown>) => {
      if (!(error instanceof Error)) {
        throw error;
      }

      if (!more) more = {};
      if (typeof more !== 'object') more = { more };
      more.isMainProcess = true;
      more.notifyUser ??= true;
      void handleError(true, error, more, !!more.notifyUser);
    }
  );

  ipc.registerConsoleLogListener((_, ...stuff: unknown[]) => {
    if (fyo.store.isDevelopment) {
      // eslint-disable-next-line no-console
      console.log(...stuff);
    }
  });
}
