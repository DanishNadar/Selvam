class UpstreamDataError(Exception):
    def __init__(self, message: str, provider: str | None = None, errors: list[str] | None = None):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.errors = errors or []
