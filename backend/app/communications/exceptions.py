class CommunicationError(RuntimeError):
    retryable = False
    temporary = False
    notify_administrator = False
    mark_message_failed = True


class ConnectorNotFoundError(CommunicationError):
    pass


class ConnectorConfigurationError(CommunicationError):
    notify_administrator = True


class ConnectorAuthenticationError(CommunicationError):
    notify_administrator = True


class ConnectorRateLimitError(CommunicationError):
    retryable = True
    temporary = True
    mark_message_failed = False


class ConnectorTemporaryError(CommunicationError):
    retryable = True
    temporary = True
    mark_message_failed = False


class ConnectorPermanentError(CommunicationError):
    pass


class MessageValidationError(CommunicationError):
    pass
