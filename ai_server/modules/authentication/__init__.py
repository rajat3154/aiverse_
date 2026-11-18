from modules.authentication.gateway import require_gateway_secret
from modules.authentication.identity import get_current_user_id

__all__ = ["get_current_user_id", "require_gateway_secret"]
