import { DeserializerError, DeserializerReason } from 'binarytf/dist/lib/errors/DeserializerError';

/**
 * The MessageError class for deserializer errors
 * @since 0.7.0
 * @extends Error
 */
export class MessageError extends Error {

	/**
	 * The kind of error from BinaryTF's error.
	 * @since 0.7.0
	 */
	public kind: DeserializerReason;

	/**
	 * Constructs a MessageError instance.
	 * @since 0.7.0
	 * @param prefix The prefix indicating more information about the error.
	 * @param error The DeserializerError instance to wrap.
	 */
	public constructor(prefix: string, error: DeserializerError) {
		super(`${prefix}: ${error.message} [${error.kind}]`);
		this.kind = error.kind;
	}

}

/**
 * Creates an error.
 * @since 0.7.0
 * @param prefix The prefix indicating what the error is.
 * @param error The original error to wrap.
 * @internal
 * @private
 */
export function makeError(prefix: string, error: Error) {
	/* istanbul ignore else: Safe guard for edge cases. */
	if (error instanceof DeserializerError) return new MessageError(prefix, error);
	/* istanbul ignore next: Safe guard for edge cases. */
	return new Error(`${prefix}: ${error.message}`);
}
