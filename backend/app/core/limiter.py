from typing import Any

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter: Any = Limiter(key_func=get_remote_address)
