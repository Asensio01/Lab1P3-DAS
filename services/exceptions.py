class DomainError(Exception):
    pass


class NotFoundError(DomainError):
    pass


class ValidationError(DomainError):
    pass


class AccountBlockedError(DomainError):
    pass


class InsufficientFundsError(DomainError):
    pass


class ConcurrencyConflictError(DomainError):
    pass


class FraudDetectedError(DomainError):
    pass
