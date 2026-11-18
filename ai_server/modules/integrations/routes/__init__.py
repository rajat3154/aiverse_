from fastapi import APIRouter, Depends

from modules.authentication import require_gateway_secret
from modules.integrations.routes.connections import router as connections_router

router = APIRouter(dependencies=[Depends(require_gateway_secret)])
router.include_router(connections_router)
