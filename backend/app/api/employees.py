from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.sales import EmployeeCreate, EmployeeRead, EmployeeUpdate
from app.services.employees import (
    EmployeeNotFoundError,
    EmployeeValidationError,
    create_employee,
    get_employee,
    list_employees,
    update_employee,
)


router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("", response_model=list[EmployeeRead], operation_id="list_employees")
def get_employees(
    active_only: bool = Query(default=True),
    organization_id: int | None = Query(default=None),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[EmployeeRead]:
    return list_employees(
        db,
        active_only=active_only,
        organization_id=organization_id,
        q=q,
    )


@router.post(
    "",
    response_model=EmployeeRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_employee",
)
def post_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
) -> EmployeeRead:
    try:
        item = create_employee(db, payload)
    except EmployeeValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    db.commit()
    return item


@router.get(
    "/{employee_id}",
    response_model=EmployeeRead,
    operation_id="get_employee",
)
def get_employee_by_id(
    employee_id: int,
    db: Session = Depends(get_db),
) -> EmployeeRead:
    try:
        return get_employee(db, employee_id)
    except EmployeeNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.patch(
    "/{employee_id}",
    response_model=EmployeeRead,
    operation_id="update_employee",
)
def patch_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
) -> EmployeeRead:
    try:
        item = update_employee(db, employee_id, payload)
    except EmployeeNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except EmployeeValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    db.commit()
    return item
