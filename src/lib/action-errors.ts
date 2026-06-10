import { reportError } from './monitor'

/** Map server/action errors to user-safe messages */
export function toActionError(error: unknown): Error {
  reportError('server-action', error)
  if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      return new Error('Your session expired. Please sign in again.')
    }
    return error
  }
  return new Error('Something went wrong. Please try again.')
}
