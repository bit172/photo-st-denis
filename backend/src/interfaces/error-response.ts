import type MessageResponse from './message-response'

type ErrorResponse = {
  stack?: string
} & MessageResponse

export default ErrorResponse
