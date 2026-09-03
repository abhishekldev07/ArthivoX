import { t } from 'fyo';
import type { Doc } from 'fyo/model/doc';
import { BaseError } from 'fyo/utils/errors';
import { ErrorLog } from 'fyo/utils/types';
import { truncate } from 'lodash';
import { showDialog } from 'src/utils/interactive';
import { fyo } from './initFyo';
import router from './router';
import { getErrorMessage, stringifyCircular } from './utils';
import type { DialogOptions, ToastOptions } from './utils/types';

function shouldNotStore(error: Error) {
  return !((error as BaseError).shouldStore ?? true);
}

export async function sendError(errorLogObj: ErrorLog) {
  if (!errorLogObj.stack) return;
  errorLogObj.more ??= {};
  errorLogObj.more.path ??= router.currentRoute.value.fullPath;
  if (fyo.store.isDevelopment) {
    // eslint-disable-next-line no-console
    console.error('[ArthivoX]', errorLogObj);
  }
}

function getToastProps(errorLogObj: ErrorLog): ToastOptions {
  return { message: errorLogObj.name ?? t`Error`, type: 'error' };
}

export function getErrorLogObject(error: Error, more: Record<string, unknown>): ErrorLog {
  const { name, stack, message, cause } = error;
  if (cause) more.cause = cause;
  const errorLogObj = { name, stack, message, more };
  fyo.errorLog.push(errorLogObj);
  return errorLogObj;
}

export async function handleError(logToConsole: boolean, error: Error, more: Record<string, unknown> = {}, notifyUser = true) {
  if (logToConsole) console.error(error);
  if (shouldNotStore(error)) return;
  const errorLogObj = getErrorLogObject(error, more);
  await sendError(errorLogObj);
  if (notifyUser) {
    const { showToast } = await import('src/utils/interactive');
    showToast(getToastProps(errorLogObj));
  }
}

export async function handleErrorWithDialog(error: unknown, doc?: Doc, reportError?: boolean, dontThrow?: boolean) {
  if (!(error instanceof Error)) return;
  const errorMessage = getErrorMessage(error, doc);
  await handleError(false, error, { errorMessage, doc });
  const options: DialogOptions = { title: getErrorLabel(error), detail: errorMessage, type: 'error' };
  if (reportError) {
    options.detail = truncate(String(options.detail), { length: 512 });
    options.buttons = [{ label: t`Close`, action() { return null; }, isPrimary: true, isEscape: true }];
  }
  await showDialog(options);
  if (dontThrow) {
    if (fyo.store.isDevelopment) console.error(error);
    return;
  }
  throw error;
}

export async function showErrorDialog(title?: string, content?: string) {
  title ??= t`Error`;
  content ??= t`Something went wrong. Please review the error details and try again.`;
  await ipc.showError(title, content);
}

export function getErrorHandled<T extends (...args: any[]) => Promise<any>>(func: T) {
  type Return = ReturnType<T> extends Promise<infer P> ? P : true;
  return async function errorHandled(...args: Parameters<T>): Promise<Return> {
    try { return (await func(...args)) as Return; }
    catch (error) { await handleError(false, error as Error, { functionName: func.name, functionArgs: args }); throw error; }
  };
}

export function getErrorHandledSync<T extends (...args: any[]) => any>(func: T) {
  return function errorHandledSync(...args: Parameters<T>) {
    try { return func(...args) as ReturnType<T>; }
    catch (error) { void handleError(false, error as Error, { functionName: func.name, functionArgs: args }); }
  };
}

export function reportIssue(errorLogObj?: ErrorLog) {
  if (errorLogObj) console.error('[ArthivoX error report]', stringifyCircular(errorLogObj));
}

function getErrorLabel(error: Error) {
  const name = error.name;
  if (!name || name === 'BaseError') return t`Error`;
  if (name === 'ValidationError') return t`Validation Error`;
  if (name === 'NotFoundError') return t`Not Found`;
  if (name === 'ForbiddenError') return t`Forbidden Error`;
  if (name === 'DuplicateEntryError') return t`Duplicate Entry`;
  if (name === 'LinkValidationError') return t`Link Validation Error`;
  if (name === 'MandatoryError') return t`Mandatory Error`;
  if (name === 'DatabaseError') return t`Database Error`;
  if (name === 'CannotCommitError') return t`Cannot Commit Error`;
  return t`Error`;
}
