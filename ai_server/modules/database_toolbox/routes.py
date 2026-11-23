from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from configurations.databases.database import get_db
from modules.authentication import get_current_user_id, require_gateway_secret
from modules.database_toolbox.schemas import ConnectionBody, ConnectionResponse, ConnectionTestRequest, ConnectionTestResponse
from modules.database_toolbox.service import database_connection_service as service, to_response

router = APIRouter(prefix="/api/database-connections", tags=["Database connections"], dependencies=[Depends(require_gateway_secret)])


@router.get("", response_model=list[ConnectionResponse])
async def list_connections(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    return [to_response(c) for c in await service.list(db, user_id)]


@router.post("", response_model=ConnectionResponse, status_code=201)
async def create_connection(body: ConnectionBody, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    return to_response(await service.create(db, user_id, body.name, body.slug, body.configuration))


@router.post("/test", response_model=ConnectionTestResponse)
async def test_connection(body: ConnectionTestRequest, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    result = await service.test(db, user_id, body.slug, body.configuration, body.connection_id)
    return {"success": result.success, "message": result.message, "error_code": result.error_code, "latency_ms": result.latency_ms}


@router.put("/{connection_id}", response_model=ConnectionResponse)
async def update_connection(connection_id: UUID, body: ConnectionBody, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    return to_response(await service.update(db, user_id, connection_id, body.name, body.slug, body.configuration))


@router.delete("/{connection_id}", status_code=204)
async def delete_connection(connection_id: UUID, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    await service.delete(db, user_id, connection_id)
